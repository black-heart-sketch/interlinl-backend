const mongoose = require('mongoose');
const Video = require('../models/Video');
const Course = require('../isolated/models/Course');
const ChapterLearningCanvas = require('../isolated/models/ChapterLearningCanvas');
const CourseExam = require('../isolated/models/CourseExam');
const CourseExamAttempt = require('../isolated/models/CourseExamAttempt');
const { GoogleGenAI } = require('@google/genai');

const dotenv = require('dotenv');

dotenv.config({ override: true });

function extractValidJSON(str) {
  // Remove triple backticks and optional language specifier
  return str.replace(/```(?:json)?\s*([\s\S]*?)\s*```/, '$1').trim();
}

function extractJsonArray(str) {
  const cleaned = extractValidJSON(String(str || ''));
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw error;
  }
}

function normalizeMcqs(mcqs) {
  const list = Array.isArray(mcqs) ? mcqs : mcqs?.questions;
  if (!Array.isArray(list)) {
    throw new Error('Quiz response is not an array.');
  }

  return list.map((question, questionIndex) => {
    const rawOptions = Array.isArray(question.options) ? question.options.slice(0, 4) : [];
    const correctIndex = String(question.correctAnswer ?? question.answer ?? '');

    const options = rawOptions.map((option, optionIndex) => {
      const optionText = typeof option === 'string' ? option : option.text;
      const isCorrectFromOption = typeof option === 'object' && option?.isCorrect === true;
      const isCorrectFromIndex = correctIndex === String(optionIndex);

      return {
        _id: option._id || `q${questionIndex + 1}_o${optionIndex + 1}`,
        text: optionText || `Option ${optionIndex + 1}`,
        isCorrect: isCorrectFromOption || isCorrectFromIndex
      };
    });

    if (options.length !== 4) {
      throw new Error(`Question ${questionIndex + 1} does not have exactly 4 options.`);
    }

    if (!options.some((option) => option.isCorrect)) {
      options[0].isCorrect = true;
    }

    return {
      _id: question._id || question.id || `generated_q_${questionIndex + 1}_${Date.now()}`,
      questionText: question.questionText || question.prompt || question.question || `Question ${questionIndex + 1}`,
      options
    };
  });
}

function normalizeCourseExam(rawExam) {
  const exam = rawExam?.exam || rawExam || {};
  const mcqSource = exam.mcqs || exam.mcqQuestions || [];
  const structuredSource = exam.structuredQuestions || exam.structured || [];

  const mcqs = normalizeMcqs(mcqSource).map((question) => ({
    questionText: question.questionText,
    options: question.options.map((option) => ({
      text: option.text,
      isCorrect: option.isCorrect
    })),
    explanation: question.explanation || question.rationale || ''
  }));

  const structuredQuestions = (Array.isArray(structuredSource) ? structuredSource : []).map((question, index) => ({
    prompt: question.prompt || question.questionText || question.question || `Structured question ${index + 1}`,
    expectedAnswer: question.expectedAnswer || question.answer || '',
    gradingGuide: question.gradingGuide || question.rubric || question.rationale || '',
    points: Number(question.points || 10)
  })).filter((question) => question.prompt);

  return {
    title: exam.title || 'Final Course Exam',
    instructions: exam.instructions || 'Answer all questions carefully. Use complete sentences for structured questions.',
    mcqs,
    structuredQuestions
  };
}

const buildCourseExamContext = async (courseId) => {
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new Error('A valid courseId is required.');
  }

  const course = await Course.findById(courseId)
    .populate({
      path: 'sections',
      options: { sort: { order: 1 } },
      select: 'title description order resources videoTranscript isLocked isPreviewable videos',
      populate: {
        path: 'videos',
        model: 'Video',
        select: 'title description duration markers vimeoVideoId'
      }
    })
    .populate('studyLanguage', 'name')
    .lean();

  if (!course) {
    throw new Error('Course not found.');
  }

  return {
    course: {
      id: course._id,
      title: course.title,
      description: course.description,
      category: course.category,
      difficulty: course.difficulty,
      studyLanguage: course.studyLanguage?.name || course.studyLanguage
    },
    attachments: course.attachments || [],
    chapters: (course.sections || []).map((section, sectionIndex) => ({
      id: section._id,
      order: section.order || sectionIndex + 1,
      title: section.title,
      description: section.description,
      resources: section.resources || [],
      transcript: section.videoTranscript || null,
      videos: (section.videos || []).map((video, videoIndex) => ({
        id: video._id,
        order: videoIndex + 1,
        title: video.title,
        description: video.description,
        duration: video.duration,
        notions: video.markers || []
      }))
    }))
  };
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const getCanvasDocument = async ({ courseId, sectionId }) => {
  if (!mongoose.Types.ObjectId.isValid(courseId) || !mongoose.Types.ObjectId.isValid(sectionId)) {
    throw new Error('Valid courseId and sectionId are required.');
  }

  return ChapterLearningCanvas.findOneAndUpdate(
    { course: courseId, section: sectionId },
    { $setOnInsert: { course: courseId, section: sectionId } },
    { new: true, upsert: true }
  );
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

let geminiClient;

const getGeminiClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  return geminiClient;
};

const callGemini = async ({ prompt, temperature = 0.35, maxOutputTokens = 1800, responseMimeType }) => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      temperature,
      maxOutputTokens,
      ...(responseMimeType ? { responseMimeType } : {})
    }
  });

  return response.text || '';
};

const generateMcqController = async (req, res) => {
  const {
    notionId,
    notionDescription,
    notionTitle,
    videoId,
    courseContext,
    courseTitle,
    courseDescription,
    attempt = 1,
    lang = 'en',
    // previouslyAskedQuestionIds = []
  } = req.body;

  if (!notionId && !notionDescription && !notionTitle) {
    return res
      .status(400)
      .json({ message: 'Either notionId, notionTitle or notionDescription is required.' });
  }

  let effectiveNotionTitle = notionTitle;
  let effectiveNotionDescription = notionDescription;
  let effectiveCourseTitle = courseTitle;
  let effectiveCourseDescription = courseDescription;

  // Optional: fetch marker details by videoId + notionId if missing
  if (notionId && videoId && (!effectiveNotionTitle || !effectiveNotionDescription)) {
    if (mongoose.Types.ObjectId.isValid(videoId)) {
      try {
        const video = await Video.findById(videoId);
        if (video) {
          const marker = video.markers.id(notionId);
          if (marker) {
            if (!effectiveNotionTitle) effectiveNotionTitle = marker.title;
            if (!effectiveNotionDescription) effectiveNotionDescription = marker.description;
          }
        }
      } catch (err) {
        console.error('DB marker lookup error:', err);
      }
    }
  }

  // Fallback notion title/description to each other if one is missing
  if (!effectiveNotionTitle) effectiveNotionTitle = effectiveNotionDescription;
  if (!effectiveNotionDescription) effectiveNotionDescription = effectiveNotionTitle;

  // Optional: fetch course details if missing
  if (courseContext && (!effectiveCourseTitle || !effectiveCourseDescription)) {
    if (mongoose.Types.ObjectId.isValid(courseContext)) {
      try {
        const course = await Course.findById(courseContext);
        if (course) {
          if (!effectiveCourseTitle) effectiveCourseTitle = course.title;
          if (!effectiveCourseDescription) effectiveCourseDescription = course.description;
        }
      } catch (err) {
        console.error('DB course lookup error:', err);
      }
    }
  }

  // Provide ultimate fallback values if still missing
  if (!effectiveNotionTitle && !effectiveNotionDescription) {
    return res
      .status(400)
      .json({ message: 'Notion title or description is required.' });
  }
  if (!effectiveCourseTitle) {
    effectiveCourseTitle = courseContext || 'General Course';
  }

  try {
    const languageNames = {
      en: 'English',
      fr: 'French',
      de: 'German',
      it: 'Italian'
    };
    const userLanguage = languageNames[lang.split('-')[0].toLowerCase()] || 'English';

    // Construct prompt
    const prompt = `You are an expert instructor.
We are creating a quiz for the following course and notion:

Course Title: "${effectiveCourseTitle}"
Course Description: "${effectiveCourseDescription || 'N/A'}"

Notion Title: "${effectiveNotionTitle}"
Notion Description: "${effectiveNotionDescription || 'N/A'}"

Based on the above context and notion, generate exactly 24 unique multiple-choice questions.

CRITICAL LANGUAGE REQUIREMENT:
The questions, instructions, and choices must be written entirely in ${userLanguage} (e.g., if ${userLanguage} is French, write all questions and options in French. If ${userLanguage} is German, write in German. If ${userLanguage} is Italian, write in Italian).
For example:
- If testing a language concept like German vocabulary (e.g., Notion: "good morning in German") and the user language is French, the question itself must be formulated in French (e.g., "Qu'est-ce que 'bonjour' en allemand ?" or "Comment dit-on 'bonjour' en allemand ?") and the options must be the German choices (e.g., "Guten Morgen", "Guten Tag", etc.).
- If testing a general concept and the user language is French, both the question and the options must be in French.

Each question must have exactly 4 options with exactly one correct option.

Important response formatting rules:
1. Return ONLY a raw JSON array of objects. Do not include markdown code blocks like \`\`\`json or \`\`\`.
2. The output must be strictly valid JSON that can be parsed directly with JSON.parse().
3. Do not include any invalid escape sequences in JSON strings (such as backslashes not followed by a valid character like ", \\, /, b, f, n, r, t, or u).
4. If you need to use quotes inside a string, escape them with a single backslash like \\" or use single quotes.

JSON Schema format:
[
  {
    "_id": "unique_string_id_1",
    "questionText": "Question text in ${userLanguage}...",
    "options": [
      { "text": "Option A...", "isCorrect": false },
      { "text": "Option B...", "isCorrect": true },
      { "text": "Option C...", "isCorrect": false },
      { "text": "Option D...", "isCorrect": false }
    ]
  },
  ...
]`;

    const rawResponse = await callGemini({
      prompt,
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json'
    });

    const allMcqs = normalizeMcqs(extractJsonArray(rawResponse));
    if (!Array.isArray(allMcqs) || allMcqs.length === 0) {
      throw new Error('Invalid AI response format');
    }

    res.status(200).json({ questions: allMcqs });
  } catch (err) {
    console.error('AI generation error:', err);
    res
      .status(500)
      .json({ message: 'Failed to generate questions. Please try again later.' });
  }
};

const courseAssistantController = async (req, res) => {
  try {
    const {
      question,
      context = {},
      history = [],
      lang = 'en',
      responseFormat
    } = req.body;

    if (!question || !String(question).trim()) {
      return res.status(400).json({ message: 'Question is required.' });
    }

    const languageNames = {
      en: 'English',
      fr: 'French',
      de: 'German',
      it: 'Italian'
    };
    const userLanguage = languageNames[String(lang).split('-')[0].toLowerCase()] || 'English';

    const compactHistory = Array.isArray(history)
      ? history.slice(-6).map((item) => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: String(item.content || '').slice(0, 1200)
      }))
      : [];

    const prompt = `You are Institute Einsteins' course learning assistant.

Answer the learner using ONLY the course context below. If the answer is not in the context, say that clearly and suggest what to review.

RESPONSE STYLE REQUIREMENTS:
1. Reply in ${userLanguage}.
2. Use clear formatting with short headings.
3. Use bullet points, numbered steps, and concise point-by-point explanations.
4. When useful, include:
   - "Quick answer"
   - "Key points"
   - "Example"
   - "What to review next"
5. Do not write long dense paragraphs.
6. Be helpful, friendly, and direct.

COURSE CONTEXT:
${JSON.stringify(context, null, 2)}

LEARNER QUESTION:
${question}`;

    const historyText = compactHistory.length
      ? `\nRECENT CHAT HISTORY:\n${compactHistory.map((item) => `${item.role.toUpperCase()}: ${item.content}`).join('\n\n')}\n`
      : '';

    if (responseFormat === 'chapterCanvasJson') {
      const focus = context?.selectedFocus;
      const moduleId = focus?.id || context?.currentChapter?.id || context?.currentVideo?.id || context?.course?.id || 'current-module';
      const title = focus?.title || context?.currentChapter?.title || context?.currentVideo?.title || context?.course?.title || 'Current lesson';
      const level = context?.course?.level || context?.course?.category || 'General learner';
      const objective = focus?.description || context?.currentChapter?.description || context?.currentVideo?.description || context?.course?.description || question;

      const canvasPrompt = `You are Institute Einsteins' senior instructor. Create production-quality educational content for a language learning platform. Be precise, practical, and learner-focused. Do not invent facts outside the supplied course context. Return strict JSON only with keys: overview, concepts, workflow, pitfalls, professionalChecklist, mentorPrompt, assessment. Keep overview under 120 words. concepts must be an array of 3 objects with title and explanation under 55 words each. workflow must be an array of 4 concise ordered step strings. pitfalls must be an array of 3 realistic mistake strings. professionalChecklist must be an array of 4 observable completion criteria strings. assessment must be an array of 5 multiple-choice questions generated from the lesson. Each assessment item must have id, prompt, options, correctAnswer, and rationale. options must contain exactly 4 answer choices. correctAnswer must be the string index of the correct option: "0", "1", "2", or "3". Reply content must be in ${userLanguage}.

Module ${moduleId}: ${title}. Level: ${level}. Objective: ${objective}
Active focus: ${focus ? JSON.stringify(focus, null, 2) : 'Whole chapter'}

Use this full course context, including chapter videos, resources, notions or markers, transcripts, and attachments:
${JSON.stringify(context, null, 2)}`;

      const rawCanvas = await callGemini({
        prompt: canvasPrompt,
        temperature: 0.2,
        maxOutputTokens: 2400,
        responseMimeType: 'application/json'
      });

      let parsedCanvas;
      try {
        parsedCanvas = JSON.parse(extractValidJSON(rawCanvas));
      } catch (parseError) {
        console.warn('Unable to parse course canvas JSON:', parseError.message);
      }

      return res.status(200).json({ answer: rawCanvas, canvas: parsedCanvas });
    }

    const answer = await callGemini({
      prompt: `${historyText}\n${prompt}`,
      temperature: 0.35,
      maxOutputTokens: 1800
    });

    res.status(200).json({ answer });
  } catch (error) {
    console.error('Course assistant error:', error);
    res.status(500).json({ message: 'Unable to answer with the course assistant right now.' });
  }
};

const getChapterCanvasController = async (req, res) => {
  try {
    const { courseId, sectionId } = req.query;
    const doc = await getCanvasDocument({ courseId, sectionId });
    const today = startOfToday();
    const userId = String(req.user._id);
    const todayGenerations = doc.quizGenerations.filter((item) => (
      String(item.user) === userId && new Date(item.generatedAt) >= today
    ));
    const userProgress = doc.progress.find((item) => String(item.user) === userId);

    res.status(200).json({
      canvas: doc.canvas,
      focusCanvases: doc.focusCanvases || {},
      updatedAt: doc.updatedAt,
      completedItems: userProgress?.completedItems || [],
      quizGenerations: todayGenerations,
      quizGenerationCount: todayGenerations.length,
      quizGenerationLimit: 2,
      nextQuizResetAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      quizAttempts: doc.quizAttempts.filter((item) => String(item.user) === userId)
    });
  } catch (error) {
    console.error('Get chapter canvas error:', error);
    res.status(400).json({ message: error.message || 'Unable to load chapter learning canvas.' });
  }
};

const saveChapterProgressController = async (req, res) => {
  try {
    const { courseId, sectionId, completedItems = [] } = req.body;
    const doc = await getCanvasDocument({ courseId, sectionId });
    const userId = req.user._id;
    const existing = doc.progress.find((item) => String(item.user) === String(userId));

    if (existing) {
      existing.completedItems = Array.from(new Set(completedItems));
      existing.lastVisitedAt = new Date();
    } else {
      doc.progress.push({ user: userId, completedItems: Array.from(new Set(completedItems)), lastVisitedAt: new Date() });
    }

    await doc.save();
    res.status(200).json({ completedItems: existing?.completedItems || completedItems });
  } catch (error) {
    console.error('Save chapter progress error:', error);
    res.status(400).json({ message: error.message || 'Unable to save chapter progress.' });
  }
};

const generateChapterCanvasController = async (req, res) => {
  try {
    const {
      courseId,
      sectionId,
      context = {},
      focus = null,
      lang = 'en'
    } = req.body;
    const doc = await getCanvasDocument({ courseId, sectionId });
    const languageNames = { en: 'English', fr: 'French', de: 'German', it: 'Italian' };
    const userLanguage = languageNames[String(lang).split('-')[0].toLowerCase()] || 'English';
    const moduleId = focus?.id || context?.currentChapter?.id || context?.currentVideo?.id || context?.course?.id || 'current-module';
    const title = focus?.title || context?.currentChapter?.title || context?.currentVideo?.title || context?.course?.title || 'Current lesson';
    const level = context?.course?.level || context?.course?.category || 'General learner';
    const objective = focus?.description || context?.currentChapter?.description || context?.currentVideo?.description || context?.course?.description || 'Build a practical chapter learning path.';
    const canvasPrompt = `You are Institute Einsteins' senior instructor. Create production-quality educational content for a language learning platform. Be precise, practical, and learner-focused. Return strict JSON only with keys: overview, concepts, workflow, pitfalls, professionalChecklist, mentorPrompt, assessment. Keep overview under 120 words. concepts must be an array of 3 objects with title and explanation under 55 words each. workflow must be an array of 4 concise ordered step strings. pitfalls must be an array of 3 realistic mistake strings. professionalChecklist must be an array of 4 observable completion criteria strings. assessment must be an array of 5 multiple-choice questions generated from the lesson. Each assessment item must have id, prompt, options, correctAnswer, and rationale. options must contain exactly 4 answer choices. correctAnswer must be "0", "1", "2", or "3". Reply content must be in ${userLanguage}.

Module ${moduleId}: ${title}. Level: ${level}. Objective: ${objective}
Active focus: ${focus ? JSON.stringify(focus, null, 2) : 'Whole chapter'}
Full course context:
${JSON.stringify({ ...context, selectedFocus: focus }, null, 2)}`;

    const rawCanvas = await callGemini({ prompt: canvasPrompt, temperature: 0.2, maxOutputTokens: 2400, responseMimeType: 'application/json' });
    const parsedCanvas = JSON.parse(extractValidJSON(rawCanvas));

    if (focus?.id) {
      doc.focusCanvases.set(focus.id, parsedCanvas);
    } else {
      doc.canvas = parsedCanvas;
    }
    doc.updatedBy = req.user._id;
    if (!doc.generatedBy) doc.generatedBy = req.user._id;
    await doc.save();

    res.status(200).json({ canvas: parsedCanvas, updatedAt: doc.updatedAt, focus });
  } catch (error) {
    console.error('Generate chapter canvas error:', error);
    res.status(500).json({ message: 'Unable to generate chapter learning canvas.' });
  }
};

const generateChapterPracticeQuizController = async (req, res) => {
  try {
    const { courseId, sectionId, context = {}, lang = 'en' } = req.body;
    const doc = await getCanvasDocument({ courseId, sectionId });
    const today = startOfToday();
    const userId = String(req.user._id);
    const todayGenerations = doc.quizGenerations.filter((item) => (
      String(item.user) === userId && new Date(item.generatedAt) >= today
    ));

    if (todayGenerations.length >= 2) {
      return res.status(429).json({
        message: 'Daily quiz generation limit reached.',
        quizGenerationCount: todayGenerations.length,
        quizGenerationLimit: 2,
        nextQuizResetAt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      });
    }

    const languageNames = { en: 'English', fr: 'French', de: 'German', it: 'Italian' };
    const userLanguage = languageNames[String(lang).split('-')[0].toLowerCase()] || 'English';
    const prompt = `You are Institute Einsteins' senior assessment designer. Generate exactly 24 multiple-choice questions for the whole chapter. Use all videos, notions/markers, resources, transcripts, and attachments. Return only a strict JSON array. Each item must have _id, questionText, and options. options must contain exactly 4 objects with text and isCorrect, with exactly one correct option. Write all question text and choices in ${userLanguage}.

Course context:
${JSON.stringify(context, null, 2)}`;

    const rawResponse = await callGemini({ prompt, temperature: 0.2, maxOutputTokens: 4096, responseMimeType: 'application/json' });
    const questions = normalizeMcqs(extractJsonArray(rawResponse)).slice(0, 24);
    const generation = { user: req.user._id, generatedAt: new Date(), questions };
    doc.quizGenerations.push(generation);
    await doc.save();
    const savedGeneration = doc.quizGenerations[doc.quizGenerations.length - 1];

    res.status(201).json({
      generationId: savedGeneration._id,
      questions,
      quizGenerationCount: todayGenerations.length + 1,
      quizGenerationLimit: 2,
      nextQuizResetAt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
    });
  } catch (error) {
    console.error('Generate chapter practice quiz error:', error);
    res.status(500).json({ message: 'Unable to generate chapter practice quiz.' });
  }
};

const submitChapterPracticeQuizController = async (req, res) => {
  try {
    const { courseId, sectionId, generationId, answers = {} } = req.body;
    const doc = await getCanvasDocument({ courseId, sectionId });
    const generation = doc.quizGenerations.id(generationId);
    if (!generation || String(generation.user) !== String(req.user._id)) {
      return res.status(404).json({ message: 'Quiz generation not found.' });
    }

    let correct = 0;
    generation.questions.forEach((question) => {
      const selected = answers[question._id];
      const right = question.options.find((option) => option.isCorrect);
      if (right && (selected === right._id || selected === right.text)) correct++;
    });

    const score = generation.questions.length ? Math.round((correct / generation.questions.length) * 100) : 0;
    const attempt = {
      user: req.user._id,
      generationId: generation._id,
      score,
      passed: score >= 60,
      answers,
      submittedAt: new Date()
    };
    doc.quizAttempts.push(attempt);
    await doc.save();

    res.status(200).json({ score, passed: attempt.passed, correct, total: generation.questions.length });
  } catch (error) {
    console.error('Submit chapter practice quiz error:', error);
    res.status(500).json({ message: 'Unable to submit chapter practice quiz.' });
  }
};

const getCourseExamController = async (req, res) => {
  try {
    const { courseId } = req.params;
    const exam = await CourseExam.findOne({ course: courseId }).lean();

    if (exam && exam.status !== 'published') {
      const isStaff = req.user && ['teacher', 'admin', 'superadmin', 'advisor'].includes(req.user.role);
      if (!isStaff) {
        return res.status(200).json({ exam: null });
      }
    }

    res.status(200).json({ exam });
  } catch (error) {
    console.error('Get course exam error:', error);
    res.status(500).json({ message: 'Unable to load the course exam.' });
  }
};

const generateCourseExamController = async (req, res) => {
  try {
    const { courseId, lang = 'en', revisionPrompt = '', existingExam = null } = req.body;
    const context = await buildCourseExamContext(courseId);
    const languageNames = { en: 'English', fr: 'French', de: 'German', it: 'Italian' };
    const userLanguage = languageNames[String(lang).split('-')[0].toLowerCase()] || 'English';

    const prompt = `You are Institute Einsteins' senior academic examiner. Create a professional final course exam for a language learning platform.

Use the full course context: every chapter, video, notion/marker, resource, transcript, and attachment. The exam must test the learner's understanding across the whole course, not just one chapter.

Return strict JSON only with keys: title, instructions, mcqs, structuredQuestions.

Rules:
1. Write all visible learner content in ${userLanguage}.
2. mcqs must contain exactly 20 questions.
3. Each MCQ must have questionText, options, and explanation.
4. options must contain exactly 4 objects with text and isCorrect, with exactly one correct option.
5. structuredQuestions must contain exactly 6 questions.
6. Each structured question must have prompt, expectedAnswer, gradingGuide, and points.
7. Do not promise grades, certificates, or outcomes.
8. Questions should be clear, exam-ready, and practical.

${existingExam ? `Existing exam to revise:\n${JSON.stringify(existingExam, null, 2)}\n` : ''}
${revisionPrompt ? `Instructor revision request:\n${revisionPrompt}\n` : ''}

Course context:
${JSON.stringify(context, null, 2)}`;

    const rawResponse = await callGemini({
      prompt,
      temperature: revisionPrompt ? 0.25 : 0.2,
      maxOutputTokens: 7000,
      responseMimeType: 'application/json'
    });

    const parsed = JSON.parse(extractValidJSON(rawResponse));
    const normalized = normalizeCourseExam(parsed);

    const exam = await CourseExam.findOneAndUpdate(
      { course: courseId },
      {
        $set: {
          ...normalized,
          generatedBy: req.user._id,
          updatedBy: req.user._id
        },
        ...(revisionPrompt ? { $push: { aiRevisionNotes: revisionPrompt } } : {})
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ exam });
  } catch (error) {
    console.error('Generate course exam error:', error);
    res.status(500).json({ message: error.message || 'Unable to generate the course exam.' });
  }
};

const updateCourseExamController = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, instructions, mcqs = [], structuredQuestions = [], status = 'draft' } = req.body;
    const normalized = normalizeCourseExam({ title, instructions, mcqs, structuredQuestions });

    const exam = await CourseExam.findOneAndUpdate(
      { course: courseId },
      {
        ...normalized,
        status,
        updatedBy: req.user._id
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ exam });
  } catch (error) {
    console.error('Update course exam error:', error);
    res.status(500).json({ message: error.message || 'Unable to save the course exam.' });
  }
};

const submitCourseExamController = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { mcqAnswers = {}, structuredAnswers = {} } = req.body;
    const exam = await CourseExam.findOne({ course: courseId, status: 'published' });

    if (!exam) {
      return res.status(404).json({ message: 'Published exam not found.' });
    }

    let correctMcqs = 0;
    exam.mcqs.forEach((question) => {
      const selected = mcqAnswers[String(question._id)];
      const correct = question.options.find((option) => option.isCorrect);
      if (correct && String(correct._id) === String(selected)) correctMcqs += 1;
    });

    const totalMcqs = exam.mcqs.length;
    const mcqScore = totalMcqs ? Math.round((correctMcqs / totalMcqs) * 100) : 0;

    const attempt = await CourseExamAttempt.create({
      course: courseId,
      exam: exam._id,
      user: req.user._id,
      mcqAnswers,
      structuredAnswers,
      mcqScore,
      correctMcqs,
      totalMcqs
    });

    res.status(201).json({ attempt, mcqScore, correctMcqs, totalMcqs });
  } catch (error) {
    console.error('Submit course exam error:', error);
    res.status(500).json({ message: 'Unable to submit the course exam.' });
  }
};

module.exports = {
  generateMcqController,
  courseAssistantController,
  getChapterCanvasController,
  saveChapterProgressController,
  generateChapterCanvasController,
  generateChapterPracticeQuizController,
  submitChapterPracticeQuizController,
  getCourseExamController,
  generateCourseExamController,
  updateCourseExamController,
  submitCourseExamController
};

const { GoogleGenAI } = require('@google/genai');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_RETRY_ATTEMPTS = Number(process.env.GEMINI_RETRY_ATTEMPTS || 3);

let geminiClient;

const logAIExam = (step, meta = {}) => {
  console.log(`[AI Exam Service] ${step}`, {
    timestamp: new Date().toISOString(),
    ...meta
  });
};

const logAIExamError = (step, error, meta = {}) => {
  console.error(`[AI Exam Service] ${step}`, {
    timestamp: new Date().toISOString(),
    message: error?.message,
    code: error?.code || error?.cause?.code,
    stack: error?.stack,
    ...meta
  });
};

const getGeminiClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    logAIExam('Gemini client missing API key');
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  if (!geminiClient) {
    logAIExam('Creating Gemini client', {
      model: GEMINI_MODEL,
      retryAttempts: GEMINI_RETRY_ATTEMPTS
    });
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  return geminiClient;
};

const extractValidJSON = (str) => {
  return String(str || '').replace(/```(?:json)?\s*([\s\S]*?)\s*```/, '$1').trim();
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableGeminiError = (error) => {
  const code = error?.cause?.code || error?.code;
  return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)
    || /fetch failed|network|timeout|socket|reset/i.test(error?.message || '');
};

const callGeminiJson = async ({ prompt, temperature = 0.25, maxOutputTokens = 8000 }) => {
  logAIExam('Preparing Gemini JSON request', {
    model: GEMINI_MODEL,
    temperature,
    maxOutputTokens,
    promptLength: prompt.length,
    retryAttempts: GEMINI_RETRY_ATTEMPTS
  });

  const ai = getGeminiClient();

  for (let attempt = 1; attempt <= GEMINI_RETRY_ATTEMPTS; attempt += 1) {
    const startedAt = Date.now();
    logAIExam('Gemini request attempt started', {
      attempt,
      maxAttempts: GEMINI_RETRY_ATTEMPTS
    });

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          temperature,
          maxOutputTokens,
          responseMimeType: 'application/json'
        }
      });

      const text = response.text || '';
      const jsonText = extractValidJSON(text);
      logAIExam('Gemini request attempt succeeded', {
        attempt,
        durationMs: Date.now() - startedAt,
        responseLength: text.length,
        extractedJsonLength: jsonText.length
      });

      try {
        const parsed = JSON.parse(jsonText);
        logAIExam('Gemini JSON parsed', {
          attempt,
          topLevelKeys: Object.keys(parsed || {})
        });
        return parsed;
      } catch (parseError) {
        logAIExamError('Gemini JSON parse failed', parseError, {
          attempt,
          responsePreview: jsonText.slice(0, 500)
        });
        throw parseError;
      }
    } catch (error) {
      const shouldRetry = attempt < GEMINI_RETRY_ATTEMPTS && isRetryableGeminiError(error);
      logAIExamError('Gemini request attempt failed', error, {
        attempt,
        maxAttempts: GEMINI_RETRY_ATTEMPTS,
        shouldRetry,
        durationMs: Date.now() - startedAt
      });

      if (!shouldRetry) {
        if (isRetryableGeminiError(error)) {
          logAIExam('Gemini request exhausted retry attempts', {
            attempts: GEMINI_RETRY_ATTEMPTS
          });
          throw new Error('AI provider connection failed after retries. Please try again in a moment.');
        }
        if (error instanceof SyntaxError) {
          throw new Error('AI provider returned invalid JSON. Please regenerate the exam.');
        }
        throw error;
      }

      const delayMs = 500 * attempt;
      logAIExam('Waiting before Gemini retry', {
        attempt,
        delayMs
      });
      await sleep(delayMs);
    }
  }

  throw new Error('AI provider request failed.');
};

const normalizeGeneratedExam = (raw, blueprint) => {
  const sections = Array.isArray(raw.sections) ? raw.sections : [];
  logAIExam('Normalizing generated exam', {
    title: raw.title,
    rawSectionCount: sections.length,
    blueprintSectionCount: blueprint.sections?.length || 0
  });

  return {
    title: raw.title || `${blueprint.examFamily} ${blueprint.level} Mock Exam`,
    instructions: raw.instructions || 'Complete all sections under exam conditions.',
    sections: sections.map((section, index) => ({
      key: section.key || blueprint.sections[index]?.key || `section_${index + 1}`,
      title: section.title || blueprint.sections[index]?.title || `Section ${index + 1}`,
      type: section.type || blueprint.sections[index]?.type || 'reading',
      durationMinutes: Number(section.durationMinutes || blueprint.sections[index]?.durationMinutes || 30),
      maxScore: Number(section.maxScore || blueprint.sections[index]?.maxScore || 25),
      instructions: section.instructions || blueprint.sections[index]?.instructions || '',
      content: section.content || {},
      questions: Array.isArray(section.questions) ? section.questions : [],
      answerKey: section.answerKey || {},
      rubric: section.rubric || blueprint.sections[index]?.rubric || {}
    }))
  };
};

const generateMockExam = async ({ blueprint, adminPrompt = '' }) => {
  logAIExam('Generate mock exam started', {
    blueprintId: blueprint._id,
    examFamily: blueprint.examFamily,
    level: blueprint.level,
    languageName: blueprint.languageName,
    sectionCount: blueprint.sections?.length || 0,
    hasAdminPrompt: Boolean(adminPrompt)
  });

  const prompt = `You are an expert official language certification examiner.

Generate one complete mock exam as strict JSON for this exam blueprint.
Do not include markdown. Do not include commentary outside JSON.

The exam must simulate a real official session as closely as possible.
Create all sections required by the blueprint.
For objective questions include answerKey. For writing/speaking include detailed rubrics.
Listening sections should include listening scripts and questions; audio can be generated later from the scripts.
All learner-facing exam content must be in the target exam language where appropriate.

Return JSON with this shape:
{
  "title": "...",
  "instructions": "...",
  "sections": [
    {
      "key": "...",
      "title": "...",
      "type": "listening|reading|writing|speaking",
      "durationMinutes": 30,
      "maxScore": 25,
      "instructions": "...",
      "content": { "passages": [], "listeningScripts": [], "prompts": [] },
      "questions": [
        { "id": "q1", "type": "mcq|true_false|short_answer|essay|speaking_prompt", "prompt": "...", "options": [] }
      ],
      "answerKey": { "q1": "..." },
      "rubric": { "criteria": [] }
    }
  ]
}

Blueprint:
${JSON.stringify(blueprint, null, 2)}

Admin generation note:
${adminPrompt || 'No extra instruction.'}`;

  logAIExam('Generate mock exam prompt built', {
    promptLength: prompt.length
  });

  const raw = await callGeminiJson({ prompt, temperature: 0.22, maxOutputTokens: 12000 });
  logAIExam('Generate mock exam raw payload received', {
    title: raw.title,
    sectionCount: Array.isArray(raw.sections) ? raw.sections.length : 0
  });

  const normalized = normalizeGeneratedExam(raw, blueprint);
  logAIExam('Generate mock exam completed', {
    title: normalized.title,
    sectionCount: normalized.sections.length
  });
  return normalized;
};

const regenerateMockExamSection = async ({ generatedExam, blueprint, sectionKey, adminPrompt = '' }) => {
  const existingSection = (generatedExam.sections || []).find((section) => section.key === sectionKey);
  const blueprintSection = (blueprint.sections || []).find((section) => section.key === sectionKey);

  if (!existingSection && !blueprintSection) {
    throw new Error('Section not found in this generated exam or blueprint.');
  }

  const prompt = `You are an expert official language certification examiner.

Regenerate exactly one section of this mock exam as strict JSON.
Do not include markdown. Do not include commentary outside JSON.

Keep the section key and type stable. Include learner-facing content, questions, answerKey, and rubrics where appropriate.

Return JSON with this shape:
{
  "key": "...",
  "title": "...",
  "type": "listening|reading|writing|speaking",
  "durationMinutes": 30,
  "maxScore": 25,
  "instructions": "...",
  "content": { "passages": [], "listeningScripts": [], "prompts": [] },
  "questions": [],
  "answerKey": {},
  "rubric": { "criteria": [] }
}

Blueprint section:
${JSON.stringify(blueprintSection || {}, null, 2)}

Existing section to replace:
${JSON.stringify(existingSection || {}, null, 2)}

Full exam context:
${JSON.stringify({
  title: generatedExam.title,
  examFamily: generatedExam.examFamily,
  level: generatedExam.level,
  instructions: generatedExam.instructions
}, null, 2)}

Admin regeneration note:
${adminPrompt || 'No extra instruction.'}`;

  const raw = await callGeminiJson({ prompt, temperature: 0.24, maxOutputTokens: 8000 });
  return {
    key: raw.key || sectionKey,
    title: raw.title || blueprintSection?.title || existingSection?.title || sectionKey,
    type: raw.type || blueprintSection?.type || existingSection?.type || 'reading',
    durationMinutes: Number(raw.durationMinutes || blueprintSection?.durationMinutes || existingSection?.durationMinutes || 30),
    maxScore: Number(raw.maxScore || blueprintSection?.maxScore || existingSection?.maxScore || 25),
    instructions: raw.instructions || blueprintSection?.instructions || existingSection?.instructions || '',
    content: raw.content || {},
    questions: Array.isArray(raw.questions) ? raw.questions : [],
    answerKey: raw.answerKey || {},
    rubric: raw.rubric || blueprintSection?.rubric || existingSection?.rubric || {}
  };
};

const correctMockExamAttempt = async ({ generatedExam, attempt }) => {
  const prompt = `You are an expert CEFR language examiner.

Correct this student's full mock exam attempt using the generated exam answer keys and rubrics.
Return strict JSON only. Do not include markdown.

Return JSON with this shape:
{
  "overallScore": 0,
  "maxScore": 100,
  "percentage": 0,
  "result": "likely_pass|borderline|likely_fail",
  "levelEstimate": "A1|A2|B1|B2|C1|C2",
  "sections": [
    {
      "key": "...",
      "score": 0,
      "maxScore": 25,
      "feedback": "...",
      "strengths": [],
      "weaknesses": [],
      "recommendations": []
    }
  ],
  "globalFeedback": "...",
  "studyPlan": []
}

Generated exam:
${JSON.stringify(generatedExam, null, 2)}

Student attempt:
${JSON.stringify(attempt, null, 2)}`;

  return callGeminiJson({ prompt, temperature: 0.15, maxOutputTokens: 8000 });
};

module.exports = {
  correctMockExamAttempt,
  generateMockExam,
  regenerateMockExamSection
};

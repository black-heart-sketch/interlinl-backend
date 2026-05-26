const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const LibraryItem = require('../models/LibraryItem');
const translationService = require('../services/translationService');

// Helper to recalculate study language specific progress
async function recalculateProgress(userId) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.studyLanguage) return;

    // Count total library items for this language
    const totalItems = await LibraryItem.countDocuments({ studyLanguage: user.studyLanguage });
    if (totalItems === 0) return;

    // Count completed library items that belong to this language
    const completedItems = await LibraryItem.countDocuments({
      _id: { $in: user.completedLibraryItems },
      studyLanguage: user.studyLanguage
    });

    const progressPercentage = Math.round((completedItems / totalItems) * 100);

    // Update progress in StudentProfile
    await StudentProfile.findOneAndUpdate(
      { userId: user._id },
      { progress: progressPercentage },
      { new: true }
    );
  } catch (error) {
    console.error('Error updating progress:', error.message);
  }
}

// Get quiz for a library item
exports.getQuizByLibraryItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const lang = req.query.lang;
    const cacheKey = `quiz:item:${itemId}`;

    const quiz = await Quiz.findOne({ libraryItem: itemId });
    
    if (!quiz) {
      return res.status(404).json({ message: 'No quiz found for this library item.' });
    }

    // Hide correct answers from students when serving the quiz!
    const sanitizedQuiz = {
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      libraryItem: quiz.libraryItem,
      questions: quiz.questions.map(q => ({
        _id: q._id,
        questionText: q.questionText,
        options: q.options
      }))
    };

    const translatedQuiz = await translationService.getCachedOrTranslated(cacheKey, lang, () => sanitizedQuiz);
    res.status(200).json(translatedQuiz);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Submit responses and grade them
exports.submitQuizAttempt = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { answers } = req.body; // Array of selected option indices corresponding to questions in order

    const quiz = await Quiz.findOne({ libraryItem: itemId });
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    if (!answers || !Array.isArray(answers) || answers.length !== quiz.questions.length) {
      return res.status(400).json({ message: 'Invalid or incomplete answers provided.' });
    }

    let correctCount = 0;
    const gradedQuestions = quiz.questions.map((q, idx) => {
      const selectedIndex = answers[idx];
      const isCorrect = selectedIndex === q.correctOptionIndex;
      if (isCorrect) correctCount++;
      return {
        questionId: q._id,
        questionText: q.questionText,
        selectedOption: q.options[selectedIndex] || 'None',
        correctOption: q.options[q.correctOptionIndex],
        isCorrect,
        explanation: q.explanation
      };
    });

    const totalQuestions = quiz.questions.length;
    const score = Math.round((correctCount / totalQuestions) * 100);
    const passed = score >= 70; // 70% threshold

    // Save attempt
    const attempt = new QuizAttempt({
      userId: req.user._id,
      quizId: quiz._id,
      score,
      correctCount,
      totalQuestions,
      passed
    });
    await attempt.save();

    // Auto mark library item as complete if student passed
    if (passed) {
      const user = await User.findById(req.user._id);
      if (user && !user.completedLibraryItems.includes(itemId)) {
        user.completedLibraryItems.push(itemId);
        await user.save();
        await recalculateProgress(user._id);
      }
    }

    res.status(200).json(await translationService.getCachedOrTranslated(`attempt:${req.user._id}:${itemId}:${Date.now()}`, req.query.lang, () => ({
      score,
      correctCount,
      totalQuestions,
      passed,
      gradedQuestions
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new quiz (Admins & Teachers)
exports.createQuiz = async (req, res) => {
  try {
    const { title, description, libraryItem, questions } = req.body;

    if (!title || !libraryItem || !questions || questions.length === 0) {
      return res.status(400).json({ message: 'Title, library item, and questions are required.' });
    }

    // Ensure library item exists
    const item = await LibraryItem.findById(libraryItem);
    if (!item) {
      return res.status(404).json({ message: 'Library item not found.' });
    }

    // Check if quiz already exists for this library item
    let quiz = await Quiz.findOne({ libraryItem });
    if (quiz) {
      // Update existing
      quiz.title = title;
      quiz.description = description;
      quiz.questions = questions;
    } else {
      // Create new
      quiz = new Quiz({
        title,
        description,
        libraryItem,
        questions
      });
    }

    await quiz.save();
    await translationService.invalidateCache(`quiz:item:${libraryItem}`);
    res.status(201).json({ message: 'Quiz created/updated successfully.', quiz });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.recalculateProgress = recalculateProgress;

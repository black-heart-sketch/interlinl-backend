const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getQuizByLibraryItem,
  submitQuizAttempt,
  createQuiz
} = require('../controllers/quizController');

// Retrieve quiz associated with a library item
router.get('/item/:itemId', protect, getQuizByLibraryItem);

// Grade and submit student quiz responses
router.post('/item/:itemId/submit', protect, submitQuizAttempt);

// Create or update quizzes (Admins & Teachers)
router.post('/', protect, authorize('superadmin', 'admin', 'teacher'), createQuiz);

module.exports = router;

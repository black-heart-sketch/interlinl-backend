const express = require('express');
const {
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
} = require('../controllers/aiController');
const { isAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/generate-mcq', isAuth, generateMcqController);
router.post('/course-assistant', isAuth, courseAssistantController);
router.get('/chapter-canvas', isAuth, getChapterCanvasController);
router.post('/chapter-canvas', isAuth, generateChapterCanvasController);
router.post('/chapter-canvas/progress', isAuth, saveChapterProgressController);
router.post('/chapter-canvas/practice-quiz', isAuth, generateChapterPracticeQuizController);
router.post('/chapter-canvas/practice-quiz/submit', isAuth, submitChapterPracticeQuizController);
router.get('/courses/:courseId/exam', isAuth, getCourseExamController);
router.post('/courses/exam/generate', isAuth, generateCourseExamController);
router.put('/courses/:courseId/exam', isAuth, updateCourseExamController);
router.post('/courses/:courseId/exam/submit', isAuth, submitCourseExamController);

module.exports = router;

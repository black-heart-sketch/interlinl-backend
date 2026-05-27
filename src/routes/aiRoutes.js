const express = require('express');
const interlinkAi = require('../controllers/interlinkAiController');
const { isAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/generate-report', isAuth, interlinkAi.generateReport);
router.post('/review-report', isAuth, interlinkAi.reviewReport);
router.post('/task-suggestions', isAuth, interlinkAi.taskSuggestions);
router.post('/performance-analysis', isAuth, interlinkAi.performanceAnalysis);
router.post('/final-summary', isAuth, interlinkAi.finalSummary);
router.post('/chat', isAuth, interlinkAi.chat);

module.exports = router;

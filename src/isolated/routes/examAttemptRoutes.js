const express = require('express');
const controller = require('../controllers/aiMockExamController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.patch('/:attemptId/save', controller.saveAttempt);
router.post('/:attemptId/submit', controller.submitAttempt);
router.get('/:attemptId/result', controller.getAttemptResult);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const controller = require('../controllers/evaluationController');

router.post('/', protect, authorize('supervisor', 'teacher', 'advisor', 'admin', 'superadmin'), controller.createEvaluation);
router.get('/', protect, controller.getEvaluations);
router.get('/:internId', protect, controller.getEvaluationByIntern);
router.post('/ai-analysis', protect, controller.aiAnalysis);

module.exports = router;

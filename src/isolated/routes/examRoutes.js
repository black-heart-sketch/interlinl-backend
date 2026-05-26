const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', examController.getExams);
router.post('/:id/start', examController.startAttempt);
router.post('/:id/submit', examController.submitAttempt);

router.use(authorize('admin', 'superadmin'));
router.post('/', examController.createExam);
router.put('/:id', examController.updateExam);
router.delete('/:id', examController.deleteExam);

module.exports = router;

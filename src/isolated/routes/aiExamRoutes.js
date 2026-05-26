const express = require('express');
const controller = require('../controllers/aiMockExamController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/blueprints', controller.getBlueprints);
router.post('/blueprints', authorize('admin', 'superadmin'), controller.createBlueprint);
router.put('/blueprints/:id', authorize('admin', 'superadmin'), controller.updateBlueprint);

router.post('/generate', authorize('admin', 'superadmin'), controller.generateExam);
router.get('/generated', authorize('admin', 'superadmin', 'teacher', 'advisor'), controller.getGeneratedExams);
router.get('/:examId', authorize('admin', 'superadmin', 'teacher', 'advisor'), controller.getGeneratedExam);
router.patch('/:examId/approve', authorize('admin', 'superadmin'), controller.approveGeneratedExam);
router.patch('/:examId/regenerate-section/:sectionKey', authorize('admin', 'superadmin'), controller.regenerateSection);

module.exports = router;

const express = require('express');
const router = express.Router();
const controller = require('../controllers/studentProjectController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadMultiple } = require('../middleware/multer');

router.get('/', protect, controller.listProjects);
router.post('/', protect, authorize('student', 'admin', 'superadmin'), uploadMultiple([{ name: 'attachments', maxCount: 5 }]), controller.createProject);
router.get('/:id', protect, controller.getProject);
router.patch('/:id/validate', protect, authorize('admin', 'superadmin', 'manager'), controller.validateProject);
router.patch('/:id/timeline/:itemId', protect, controller.updateTimelineItem);

module.exports = router;

const express = require('express');
const router = express.Router();
const internshipApplicationController = require('../controllers/internshipApplicationController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, authorize('admin', 'superadmin', 'manager', 'supervisor'), internshipApplicationController.getApplications);
router.post('/', protect, internshipApplicationController.createApplication);
router.get('/:id', protect, internshipApplicationController.getApplicationById);
router.patch('/:id/approve', protect, authorize('admin', 'superadmin', 'manager'), internshipApplicationController.approveApplication);
router.patch('/:id/reject', protect, authorize('admin', 'superadmin', 'manager'), internshipApplicationController.rejectApplication);

module.exports = router;

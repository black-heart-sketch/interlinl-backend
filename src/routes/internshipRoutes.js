const express = require('express');
const router = express.Router();
const internshipController = require('../controllers/internshipController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/me', protect, internshipController.getMyInternship);
router.get('/', protect, authorize('admin', 'superadmin', 'manager', 'supervisor'), internshipController.getInternships);
router.patch('/:id', protect, authorize('admin', 'superadmin', 'supervisor'), internshipController.updateInternship);

module.exports = router;

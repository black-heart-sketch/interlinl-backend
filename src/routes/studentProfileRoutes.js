const express = require('express');
const router = express.Router();
const profileController = require('../controllers/studentProfileController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/me', profileController.getMyProfile);
router.post('/', profileController.createStudentProfile); // Typically created by admin or on registration

// Admin routes
router.get('/', authorize('admin', 'superadmin', 'advisor'), profileController.getStudentProfiles);
router.get('/:id', authorize('admin', 'superadmin', 'advisor'), profileController.getStudentProfileById);
router.put('/:id', authorize('admin', 'superadmin', 'advisor'), profileController.updateStudentProfile);
router.delete('/:id', authorize('admin', 'superadmin'), profileController.deleteStudentProfile);

module.exports = router;

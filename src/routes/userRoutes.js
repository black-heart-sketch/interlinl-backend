const express = require('express');
const { getUsers, deleteUser, createUser, validateUser, updateUser, updateProfile, getUserAccessSummary } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/multer');

const router = express.Router();

router.route('/')
  .get(protect, authorize('superadmin', 'admin', 'advisor', 'teacher', 'supervisor', 'manager'), getUsers)
  .post(protect, authorize('superadmin', 'admin'), createUser);

router.put('/profile', protect, uploadSingle('avatar'), updateProfile);

router.get('/:id/access-summary', protect, authorize('superadmin', 'admin', 'manager'), getUserAccessSummary);

router.route('/:id')
  .put(protect, authorize('superadmin', 'admin'), updateUser)
  .delete(protect, authorize('superadmin', 'admin'), deleteUser);

router.patch('/:id/validate', protect, authorize('superadmin', 'admin'), validateUser);

module.exports = router;

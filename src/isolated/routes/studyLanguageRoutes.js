const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/authMiddleware');
const {
  getStudyLanguages,
  createStudyLanguage,
  updateStudyLanguage,
  deleteStudyLanguage
} = require('../controllers/studyLanguageController');

// Public — for registration form dropdown
router.get('/', getStudyLanguages);

// Admin only
router.post('/', protect, authorize('superadmin', 'admin'), createStudyLanguage);
router.put('/:id', protect, authorize('superadmin', 'admin'), updateStudyLanguage);
router.delete('/:id', protect, authorize('superadmin', 'admin'), deleteStudyLanguage);

module.exports = router;

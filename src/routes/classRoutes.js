const express = require('express');
const { getClasses, createClass, updateClass, deleteClass } = require('../controllers/classController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
  .get(getClasses)
  .post(protect, authorize('superadmin', 'admin'), createClass);

router.route('/:id')
  .put(protect, authorize('superadmin', 'admin'), updateClass)
  .delete(protect, authorize('superadmin', 'admin'), deleteClass);

module.exports = router;

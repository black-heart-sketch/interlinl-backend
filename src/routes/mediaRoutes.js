const express = require('express');
const { createMedia, getMedia, deleteMedia } = require('../controllers/mediaController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/multer');

const router = express.Router();

router.route('/')
  .get(protect, authorize('superadmin', 'admin', 'advisor', 'teacher'), getMedia)
  .post(protect, authorize('superadmin', 'admin'), uploadSingle('file'), createMedia);

router.route('/:id')
  .delete(protect, authorize('superadmin', 'admin'), deleteMedia);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadMultiple } = require('../middleware/multer');
const {
  getLibraryItems,
  createLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
  toggleLibraryItemComplete,
  streamLibraryFile
} = require('../controllers/libraryController');

const uploadFields = uploadMultiple([
  { name: 'file', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]);

// Students can read; admins manage
router.get('/stream/:filename', protect, streamLibraryFile);
router.get('/', protect, getLibraryItems);
router.patch('/:id/toggle-complete', protect, toggleLibraryItemComplete);
router.post('/', protect, authorize('superadmin', 'admin'), uploadFields, createLibraryItem);
router.put('/:id', protect, authorize('superadmin', 'admin'), uploadFields, updateLibraryItem);
router.delete('/:id', protect, authorize('superadmin', 'admin'), deleteLibraryItem);


module.exports = router;

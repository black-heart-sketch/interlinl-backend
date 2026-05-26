const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getLiveClasses,
  createLiveClass,
  updateLiveClass,
  deleteLiveClass,
  getJoinToken,
  getLoungeToken,
  transcribeAudio
} = require('../controllers/liveClassController');

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// All endpoints require authentication
router.use(protect);

// Get list of classes (students can view)
router.get('/', getLiveClasses);

// Generate token to join a room
router.get('/:meetingId/token', getJoinToken);

// Generate token to join a lounge
router.get('/lounge/:roomId/token', getLoungeToken);

// Transcribe audio chunk (students or teachers can trigger this depending on design)
router.post('/:meetingId/transcribe', upload.single('audio'), transcribeAudio);

// Admin only endpoints
router.post('/', authorize('superadmin', 'admin'), createLiveClass);
router.put('/:id', authorize('superadmin', 'admin'), updateLiveClass);
router.delete('/:id', authorize('superadmin', 'admin'), deleteLiveClass);

module.exports = router;

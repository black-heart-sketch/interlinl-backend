const express = require('express');
const { createEvent, getEvents, deleteEvent, updateEvent } = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadMultiple } = require('../middleware/multer');

const router = express.Router();

router.route('/')
  .get(protect, authorize('superadmin', 'admin', 'advisor', 'teacher'), getEvents)
  .post(
    protect, 
    authorize('superadmin', 'admin'), 
    uploadMultiple([{ name: 'image', maxCount: 1 }, { name: 'speakerImages', maxCount: 10 }]), 
    createEvent
  );

router.route('/:id')
  .put(
    protect,
    authorize('superadmin', 'admin'),
    uploadMultiple([{ name: 'image', maxCount: 1 }, { name: 'speakerImages', maxCount: 10 }]),
    updateEvent
  )
  .delete(protect, authorize('superadmin', 'admin'), deleteEvent);

module.exports = router;

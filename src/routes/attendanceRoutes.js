const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const controller = require('../controllers/attendanceController');

router.post('/check-in', protect, controller.checkIn);
router.post('/check-out', protect, controller.checkOut);
router.post('/mark', protect, authorize('supervisor', 'teacher', 'advisor', 'admin', 'superadmin', 'manager'), controller.markAttendance);
router.get('/', protect, controller.getAttendance);
router.get('/:internId', protect, controller.getAttendanceByIntern);

module.exports = router;

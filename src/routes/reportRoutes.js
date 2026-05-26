const express = require('express');
const router = express.Router();
const rc = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/authMiddleware');

const PRIVILEGED = ['supervisor', 'teacher', 'advisor', 'admin', 'superadmin', 'manager'];

router.get('/', protect, rc.getReports);
router.post('/', protect, rc.createReport);
router.get('/:id', protect, rc.getReportById);
router.patch('/:id', protect, rc.updateReport);
router.patch('/:id/review', protect, authorize(...PRIVILEGED), rc.reviewReport);
router.delete('/:id', protect, rc.deleteReport);

module.exports = router;

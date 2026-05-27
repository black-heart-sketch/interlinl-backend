const express = require('express');
const router = express.Router();
const rc = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadMultiple } = require('../middleware/multer');

const PRIVILEGED = ['supervisor', 'teacher', 'advisor', 'admin', 'superadmin', 'manager'];

router.get('/', protect, rc.getReports);
router.post('/', protect, uploadMultiple([{ name: 'attachments', maxCount: 5 }]), rc.createReport);
router.post('/generate-ai', protect, rc.generateAiReport);
router.get('/:id', protect, rc.getReportById);
router.patch('/:id', protect, uploadMultiple([{ name: 'attachments', maxCount: 5 }]), rc.updateReport);
router.patch('/:id/review', protect, authorize(...PRIVILEGED), rc.reviewReport);
router.delete('/:id', protect, rc.deleteReport);

module.exports = router;

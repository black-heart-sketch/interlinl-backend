const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const controller = require('../controllers/certificateController');

router.get('/', protect, controller.listCertificates);
router.get('/verify/:certificateNumber', controller.verifyCertificate);
router.post('/generate/:internshipId', protect, authorize('admin', 'superadmin', 'manager'), controller.generateCertificate);
router.patch('/:id/approve', protect, authorize('admin', 'superadmin', 'manager'), controller.approveCertificate);
router.get('/:id', protect, controller.getCertificate);

module.exports = router;

const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadMultiple } = require('../middleware/multer');

router.use(protect);
router.use(authorize('admin', 'superadmin'));

router.post('/', uploadMultiple([{ name: 'logo', maxCount: 1 }, { name: 'agreementFile', maxCount: 1 }]), partnerController.createPartner);
router.get('/', partnerController.getPartners);
router.get('/:id', partnerController.getPartnerById);
router.put('/:id', uploadMultiple([{ name: 'logo', maxCount: 1 }, { name: 'agreementFile', maxCount: 1 }]), partnerController.updatePartner);
router.delete('/:id', partnerController.deletePartner);

module.exports = router;

const express = require('express');
const router = express.Router();
const testimonialController = require('../controllers/testimonialController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadMultiple } = require('../middleware/multer');

router.use(protect);
router.use(authorize('admin', 'superadmin'));

router.post('/', uploadMultiple([{ name: 'photo', maxCount: 1 }, { name: 'internalValidationDoc', maxCount: 1 }]), testimonialController.createTestimonial);
router.get('/', testimonialController.getTestimonials);
router.get('/:id', testimonialController.getTestimonialById);
router.put('/:id', uploadMultiple([{ name: 'photo', maxCount: 1 }, { name: 'internalValidationDoc', maxCount: 1 }]), testimonialController.updateTestimonial);
router.delete('/:id', testimonialController.deleteTestimonial);

module.exports = router;

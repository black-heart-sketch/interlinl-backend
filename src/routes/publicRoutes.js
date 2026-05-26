const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Public endpoints (no authentication required)
router.get('/programs', publicController.getPublishedPrograms);
router.get('/programs/:slug', publicController.getProgramBySlug);
router.get('/partners', publicController.getActivePartners);
router.get('/testimonials', publicController.getVerifiedTestimonials);
router.get('/events', publicController.getPublishedEvents);
router.get('/gallery', publicController.getLiveGallery);
router.post('/contact', publicController.submitContactForm);

module.exports = router;

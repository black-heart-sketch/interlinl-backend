const Program = require('../models/Program');
const Partner = require('../models/Partner');
const Testimonial = require('../models/Testimonial');
const Lead = require('../models/Lead');
const Event = require('../models/Event');
const MediaAsset = require('../models/MediaAsset');
const translationService = require('../services/translationService');

const getPublishedPrograms = async (req, res) => {
  try {
    const lang = req.query.lang;
    const cacheKey = 'programs:published';
    const data = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
      Program.find({ isPublished: true }).sort({ createdAt: -1 })
    );
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching programs', error: error.message });
  }
};

const getProgramBySlug = async (req, res) => {
  try {
    const lang = req.query.lang;
    const cacheKey = `program:slug:${req.params.slug}`;
    const data = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
      Program.findOne({ slug: req.params.slug, isPublished: true })
    );
    if (!data) return res.status(404).json({ message: 'Program not found' });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching program', error: error.message });
  }
};

const getActivePartners = async (req, res) => {
  try {
    const lang = req.query.lang;
    const cacheKey = 'partners:active';
    const data = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
      Partner.find({ status: 'active', publicVisible: true }).sort({ createdAt: -1 })
    );
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching partners', error: error.message });
  }
};

const getVerifiedTestimonials = async (req, res) => {
  try {
    const lang = req.query.lang;
    const cacheKey = 'testimonials:verified';
    const data = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
      Testimonial.find({ verified: true, published: true }).sort({ createdAt: -1 })
    );
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching testimonials', error: error.message });
  }
};

const submitContactForm = async (req, res) => {
  try {
    const { fullName, email, phone, interest, message } = req.body;
    
    // Validate required fields
    if (!fullName || !email) {
      return res.status(400).json({ message: 'Full name and email are required.' });
    }

    // Create a new Lead
    const newLead = new Lead({
      fullName,
      email,
      phone,
      interest,
      source: 'website_contact',
      status: 'new'
    });

    if (message) {
      newLead.notes.push({ content: message });
    }

    await newLead.save();

    res.status(201).json({ message: 'Contact form submitted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error submitting contact form', error: error.message });
  }
};

const getPublishedEvents = async (req, res) => {
  try {
    const lang = req.query.lang;
    const cacheKey = 'events:published';
    const data = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
      Event.find({ status: { $ne: 'Draft' } }).sort({ date: 1 })
    );
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching events', error: error.message });
  }
};

const getLiveGallery = async (req, res) => {
  try {
    const lang = req.query.lang;
    const cacheKey = 'gallery:live';
    const data = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
      MediaAsset.find({ type: 'photo', status: 'Live' }).sort({ createdAt: -1 }).limit(12)
    );
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching gallery', error: error.message });
  }
};

module.exports = {
  getPublishedPrograms,
  getProgramBySlug,
  getActivePartners,
  getVerifiedTestimonials,
  submitContactForm,
  getPublishedEvents,
  getLiveGallery
};

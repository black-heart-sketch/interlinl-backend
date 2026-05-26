const Testimonial = require('../models/Testimonial');
const { moveFile } = require('../middleware/multer');
const path = require('path');
const translationService = require('../services/translationService');

// Helper to map DB testimonial object to frontend-expected keys
const mapTestimonialToResponse = (testimonial) => {
  if (!testimonial) return null;
  const obj = testimonial.toObject ? testimonial.toObject() : testimonial;
  return {
    ...obj,
    authorName: obj.studentName,
    content: obj.story,
    programId: obj.program,
    isVerified: obj.verified
  };
};

// Helper to map frontend-expected keys to Mongoose schema keys
const mapRequestToSchema = (body) => {
  const mapped = { ...body };
  if (body.authorName !== undefined) mapped.studentName = body.authorName;
  if (body.content !== undefined) mapped.story = body.content;
  if (body.programId !== undefined) mapped.program = body.programId;
  
  const verifiedVal = body.isVerified ?? body.verified;
  if (verifiedVal !== undefined) {
    mapped.verified = (verifiedVal === 'true' || verifiedVal === true);
  }
  
  // Default published to true so testimonials render on the public landing page
  mapped.published = true;
  return mapped;
};

const createTestimonial = async (req, res) => {
  try {
    const mappedBody = mapRequestToSchema(req.body);
    
    let photo = req.body.photo || '';
    let internalValidationDoc = req.body.internalValidationDoc || '';

    if (req.processedFiles && req.processedFiles.length > 0) {
      const finalDir = path.join(__dirname, '../../assets/images/media');
      
      const photoFile = req.processedFiles.find(f => f.fieldName === 'photo');
      if (photoFile) {
        const finalPath = path.join(finalDir, photoFile.fileName);
        await moveFile(photoFile.path, finalPath);
        photo = `/media/${photoFile.fileName}`;

        if (photoFile.thumbnailPath) {
          const finalThumbPath = path.join(finalDir, photoFile.thumbnailFilename);
          await moveFile(photoFile.thumbnailPath, finalThumbPath);
        }
      }

      const docFile = req.processedFiles.find(f => f.fieldName === 'internalValidationDoc');
      if (docFile) {
        const finalPath = path.join(finalDir, docFile.fileName);
        await moveFile(docFile.path, finalPath);
        internalValidationDoc = `/media/${docFile.fileName}`;

        if (docFile.thumbnailPath) {
          const finalThumbPath = path.join(finalDir, docFile.thumbnailFilename);
          await moveFile(docFile.thumbnailPath, finalThumbPath);
        }
      }
    }

    const testimonialData = {
      ...mappedBody,
      photo,
      internalValidationDoc
    };

    const testimonial = new Testimonial(testimonialData);
    await testimonial.save();
    await translationService.invalidateCache('testimonial');
    res.status(201).json(mapTestimonialToResponse(testimonial));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getTestimonials = async (req, res) => {
  try {
    const lang = req.query.lang;
    const cacheKey = 'testimonials:all';
    const mapped = await translationService.getCachedOrTranslated(cacheKey, lang, async () => {
      const testimonials = await Testimonial.find().sort({ createdAt: -1 });
      return testimonials.map(mapTestimonialToResponse);
    });
    res.status(200).json(mapped);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTestimonialById = async (req, res) => {
  try {
    const lang = req.query.lang;
    const cacheKey = `testimonial:${req.params.id}`;
    const mapped = await translationService.getCachedOrTranslated(cacheKey, lang, async () => {
      const testimonial = await Testimonial.findById(req.params.id);
      return mapTestimonialToResponse(testimonial);
    });
    if (!mapped) return res.status(404).json({ message: 'Testimonial not found' });
    res.status(200).json(mapped);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateTestimonial = async (req, res) => {
  try {
    const mappedBody = mapRequestToSchema(req.body);
    const existing = await Testimonial.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Testimonial not found' });

    let photo = req.body.photo !== undefined ? req.body.photo : existing.photo;
    let internalValidationDoc = req.body.internalValidationDoc !== undefined ? req.body.internalValidationDoc : existing.internalValidationDoc;

    if (req.processedFiles && req.processedFiles.length > 0) {
      const finalDir = path.join(__dirname, '../../assets/images/media');
      
      const photoFile = req.processedFiles.find(f => f.fieldName === 'photo');
      if (photoFile) {
        const finalPath = path.join(finalDir, photoFile.fileName);
        await moveFile(photoFile.path, finalPath);
        photo = `/media/${photoFile.fileName}`;

        if (photoFile.thumbnailPath) {
          const finalThumbPath = path.join(finalDir, photoFile.thumbnailFilename);
          await moveFile(photoFile.thumbnailPath, finalThumbPath);
        }
      }

      const docFile = req.processedFiles.find(f => f.fieldName === 'internalValidationDoc');
      if (docFile) {
        const finalPath = path.join(finalDir, docFile.fileName);
        await moveFile(docFile.path, finalPath);
        internalValidationDoc = `/media/${docFile.fileName}`;

        if (docFile.thumbnailPath) {
          const finalThumbPath = path.join(finalDir, docFile.thumbnailFilename);
          await moveFile(docFile.thumbnailPath, finalThumbPath);
        }
      }
    }

    const testimonialData = {
      ...mappedBody,
      photo,
      internalValidationDoc
    };

    const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, testimonialData, { new: true });
    await translationService.invalidateCache('testimonial');
    res.status(200).json(mapTestimonialToResponse(testimonial));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteTestimonial = async (req, res) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
    if (!testimonial) return res.status(404).json({ message: 'Testimonial not found' });
    await translationService.invalidateCache('testimonial');
    res.status(200).json({ message: 'Testimonial deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createTestimonial,
  getTestimonials,
  getTestimonialById,
  updateTestimonial,
  deleteTestimonial
};

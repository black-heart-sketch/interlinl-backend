const Partner = require('../models/Partner');
const { moveFile } = require('../middleware/multer');
const path = require('path');
const translationService = require('../services/translationService');

// Helper to map and sanitize request body parameters
const sanitizePartnerBody = (body) => {
  const mapped = { ...body };

  // Convert publicVisible to a boolean
  if (body.publicVisible !== undefined) {
    mapped.publicVisible = (body.publicVisible === 'true' || body.publicVisible === true);
  }

  // Convert studentsPlaced to a number
  if (body.studentsPlaced !== undefined) {
    mapped.studentsPlaced = Number(body.studentsPlaced) || 0;
  }

  return mapped;
};

const createPartner = async (req, res) => {
  try {
    const sanitizedBody = sanitizePartnerBody(req.body);
    
    let logo = req.body.logo || '';
    let agreementFiles = [];

    // Parse agreementFiles if provided as stringified JSON or array
    if (req.body.agreementFiles) {
      try {
        agreementFiles = typeof req.body.agreementFiles === 'string'
          ? JSON.parse(req.body.agreementFiles)
          : req.body.agreementFiles;
      } catch (err) {
        console.error('Error parsing agreementFiles:', err);
      }
    }

    if (req.processedFiles && req.processedFiles.length > 0) {
      const finalDir = path.join(__dirname, '../../assets/images/media');
      
      // Process Logo File
      const logoFile = req.processedFiles.find(f => f.fieldName === 'logo');
      if (logoFile) {
        const finalPath = path.join(finalDir, logoFile.fileName);
        await moveFile(logoFile.path, finalPath);
        logo = `/media/${logoFile.fileName}`;

        if (logoFile.thumbnailPath) {
          const finalThumbPath = path.join(finalDir, logoFile.thumbnailFilename);
          await moveFile(logoFile.thumbnailPath, finalThumbPath);
        }
      }

      // Process Agreement File
      const docFile = req.processedFiles.find(f => f.fieldName === 'agreementFile');
      if (docFile) {
        const finalPath = path.join(finalDir, docFile.fileName);
        await moveFile(docFile.path, finalPath);
        const agreementUrl = `/media/${docFile.fileName}`;
        agreementFiles = [{ name: docFile.originalName || 'Accord de Placement', url: agreementUrl }];

        if (docFile.thumbnailPath) {
          const finalThumbPath = path.join(finalDir, docFile.thumbnailFilename);
          await moveFile(docFile.thumbnailPath, finalThumbPath);
        }
      }
    }

    const partnerData = {
      ...sanitizedBody,
      logo,
      agreementFiles
    };

    const partner = new Partner(partnerData);
    await partner.save();
    await translationService.invalidateCache('partner');
    res.status(201).json(partner);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getPartners = async (req, res) => {
  try {
    const lang = req.query.lang;
    const cacheKey = 'partners:all';
    const partners = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
      Partner.find().sort({ createdAt: -1 })
    );
    res.status(200).json(partners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPartnerById = async (req, res) => {
  try {
    const lang = req.query.lang;
    const cacheKey = `partner:${req.params.id}`;
    const partner = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
      Partner.findById(req.params.id)
    );
    if (!partner) return res.status(404).json({ message: 'Partner not found' });
    res.status(200).json(partner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updatePartner = async (req, res) => {
  try {
    const existing = await Partner.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Partner not found' });

    const sanitizedBody = sanitizePartnerBody(req.body);
    
    let logo = req.body.logo !== undefined ? req.body.logo : existing.logo;
    let agreementFiles = existing.agreementFiles || [];

    // Parse agreementFiles if provided as stringified JSON or array
    if (req.body.agreementFiles !== undefined) {
      try {
        agreementFiles = typeof req.body.agreementFiles === 'string'
          ? JSON.parse(req.body.agreementFiles)
          : req.body.agreementFiles;
      } catch (err) {
        console.error('Error parsing agreementFiles in update:', err);
      }
    }

    if (req.processedFiles && req.processedFiles.length > 0) {
      const finalDir = path.join(__dirname, '../../assets/images/media');
      
      // Process Logo File
      const logoFile = req.processedFiles.find(f => f.fieldName === 'logo');
      if (logoFile) {
        const finalPath = path.join(finalDir, logoFile.fileName);
        await moveFile(logoFile.path, finalPath);
        logo = `/media/${logoFile.fileName}`;

        if (logoFile.thumbnailPath) {
          const finalThumbPath = path.join(finalDir, logoFile.thumbnailFilename);
          await moveFile(logoFile.thumbnailPath, finalThumbPath);
        }
      }

      // Process Agreement File
      const docFile = req.processedFiles.find(f => f.fieldName === 'agreementFile');
      if (docFile) {
        const finalPath = path.join(finalDir, docFile.fileName);
        await moveFile(docFile.path, finalPath);
        const agreementUrl = `/media/${docFile.fileName}`;
        agreementFiles = [{ name: docFile.originalName || 'Accord de Placement', url: agreementUrl }];

        if (docFile.thumbnailPath) {
          const finalThumbPath = path.join(finalDir, docFile.thumbnailFilename);
          await moveFile(docFile.thumbnailPath, finalThumbPath);
        }
      }
    }

    const partnerData = {
      ...sanitizedBody,
      logo,
      agreementFiles
    };

    const partner = await Partner.findByIdAndUpdate(req.params.id, partnerData, { new: true });
    await translationService.invalidateCache('partner');
    res.status(200).json(partner);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deletePartner = async (req, res) => {
  try {
    const partner = await Partner.findByIdAndDelete(req.params.id);
    if (!partner) return res.status(404).json({ message: 'Partner not found' });
    await translationService.invalidateCache('partner');
    res.status(200).json({ message: 'Partner deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createPartner,
  getPartners,
  getPartnerById,
  updatePartner,
  deletePartner
};

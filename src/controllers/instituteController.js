const asyncHandler = require('express-async-handler');
const Institute = require('../models/Institute');
const { moveFile } = require('../middleware/multer');
const path = require('path');
const translationService = require('../services/translationService');

// @desc    Create a new institute
// @route   POST /api/institutes
// @access  Private/Admin
const createInstitute = asyncHandler(async (req, res) => {
  const { name, location, description, admins } = req.body;
  
  let logo, background;

  // Handle uploaded files
  if (req.processedFiles) {
    const assetsPath = path.join(__dirname, '../../assets');
    
    if (req.processedFiles.logo) {
      const file = req.processedFiles.logo[0];
      const finalPath = path.join(assetsPath, 'images/institutes', file.fileName);
      await moveFile(file.path, finalPath);
      logo = file.fileName;

      // Move generated thumbnail if it exists
      if (file.thumbnailPath) {
        const finalThumbPath = path.join(assetsPath, 'images/institutes', file.thumbnailFilename);
        await moveFile(file.thumbnailPath, finalThumbPath);
      }
    }
    
    if (req.processedFiles.background) {
      const file = req.processedFiles.background[0];
      const finalPath = path.join(assetsPath, 'images/institutes', file.fileName);
      await moveFile(file.path, finalPath);
      background = file.fileName;

      // Move generated thumbnail if it exists
      if (file.thumbnailPath) {
        const finalThumbPath = path.join(assetsPath, 'images/institutes', file.thumbnailFilename);
        await moveFile(file.thumbnailPath, finalThumbPath);
      }
    }
  }

  const institute = await Institute.create({
    name,
    location,
    description,
    logo,
    background,
    admins: admins ? JSON.parse(admins) : []
  });

  await translationService.invalidateCache('institute');
  res.status(201).json(institute);
});

// @desc    Get all institutes
// @route   GET /api/institutes
// @access  Public
const getInstitutes = asyncHandler(async (req, res) => {
  const lang = req.query.lang;
  const cacheKey = 'institutes:all';
  const institutes = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
    Institute.find({}).populate('admins', 'firstName lastName email')
  );
  res.json(institutes);
});

// @desc    Get institute by ID
// @route   GET /api/institutes/:id
// @access  Public
const getInstituteById = asyncHandler(async (req, res) => {
  const lang = req.query.lang;
  const cacheKey = `institute:${req.params.id}`;
  const institute = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
    Institute.findById(req.params.id).populate('admins', 'firstName lastName email')
  );
  
  if (institute) {
    res.json(institute);
  } else {
    res.status(404);
    throw new Error('Institute not found');
  }
});

// @desc    Update institute
// @route   PUT /api/institutes/:id
// @access  Private/Admin
const updateInstitute = asyncHandler(async (req, res) => {
  const institute = await Institute.findById(req.params.id);

  if (institute) {
    institute.name = req.body.name || institute.name;
    institute.location = req.body.location || institute.location;
    institute.description = req.body.description || institute.description;
    
    if (req.body.admins) {
        institute.admins = JSON.parse(req.body.admins);
    }

    if (req.processedFiles) {
      const assetsPath = path.join(__dirname, '../../assets');
      
      if (req.processedFiles.logo) {
        const file = req.processedFiles.logo[0];
        const finalPath = path.join(assetsPath, 'images/institutes', file.fileName);
        await moveFile(file.path, finalPath);
        institute.logo = file.fileName;

        // Move generated thumbnail if it exists
        if (file.thumbnailPath) {
          const finalThumbPath = path.join(assetsPath, 'images/institutes', file.thumbnailFilename);
          await moveFile(file.thumbnailPath, finalThumbPath);
        }
      }
      
      if (req.processedFiles.background) {
        const file = req.processedFiles.background[0];
        const finalPath = path.join(assetsPath, 'images/institutes', file.fileName);
        await moveFile(file.path, finalPath);
        institute.background = file.fileName;

        // Move generated thumbnail if it exists
        if (file.thumbnailPath) {
          const finalThumbPath = path.join(assetsPath, 'images/institutes', file.thumbnailFilename);
          await moveFile(file.thumbnailPath, finalThumbPath);
        }
      }
    }

    const updatedInstitute = await institute.save();
    await translationService.invalidateCache('institute');
    res.json(updatedInstitute);
  } else {
    res.status(404);
    throw new Error('Institute not found');
  }
});

// @desc    Delete institute
// @route   DELETE /api/institutes/:id
// @access  Private/Admin
const deleteInstitute = asyncHandler(async (req, res) => {
  const institute = await Institute.findById(req.params.id);

  if (institute) {
    await institute.deleteOne();
    await translationService.invalidateCache('institute');
    res.json({ message: 'Institute removed' });
  } else {
    res.status(404);
    throw new Error('Institute not found');
  }
});

module.exports = {
  createInstitute,
  getInstitutes,
  getInstituteById,
  updateInstitute,
  deleteInstitute
};

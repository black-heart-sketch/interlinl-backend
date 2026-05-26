const asyncHandler = require('express-async-handler');
const Research = require('../models/Research');
const { moveFile } = require('../middleware/multer');
const path = require('path');
const translationService = require('../services/translationService');

// @desc    Create new research
// @route   POST /api/research
// @access  Private
const createResearch = asyncHandler(async (req, res) => {
  const { title, description, institute, authors } = req.body;
  
  let thumbnail, documents = [];

  if (req.processedFiles) {
    const assetsPath = path.join(__dirname, '../../assets');
    
    // Handle thumbnail
    if (req.processedFiles.thumbnail) {
      const file = req.processedFiles.thumbnail[0];
      const finalPath = path.join(assetsPath, 'images/research/thumbnail', file.fileName);
      await moveFile(file.path, finalPath);
      thumbnail = file.fileName;

      // Move generated thumbnail if it exists
      if (file.thumbnailPath) {
        const finalThumbPath = path.join(assetsPath, 'images/research/thumbnail', file.thumbnailFilename);
        await moveFile(file.thumbnailPath, finalThumbPath);
      }
    }
    
    // Handle multiple documents
    if (req.processedFiles.documents) {
      for (const file of req.processedFiles.documents) {
        const finalPath = path.join(assetsPath, 'documents/research', file.fileName);
        await moveFile(file.path, finalPath);
        documents.push(file.fileName);

        // Move generated thumbnail for each document if it exists
        if (file.thumbnailPath) {
          const finalThumbPath = path.join(assetsPath, 'documents/research', file.thumbnailFilename);
          await moveFile(file.thumbnailPath, finalThumbPath);
        }
      }
    }
  }

  const research = await Research.create({
    title,
    description,
    thumbnail,
    documents,
    institute,
    authors: authors ? JSON.parse(authors) : []
  });

  await translationService.invalidateCache('research');
  res.status(201).json(research);
});

// @desc    Get all research
// @route   GET /api/research
// @access  Public
const getResearch = asyncHandler(async (req, res) => {
  const lang = req.query.lang;
  const cacheKey = 'research:all';
  const research = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
    Research.find({})
      .populate('institute', 'name')
      .populate('authors', 'firstName lastName')
  );
  res.json(research);
});

// @desc    Get research by ID
// @route   GET /api/research/:id
// @access  Public
const getResearchById = asyncHandler(async (req, res) => {
  const lang = req.query.lang;
  const cacheKey = `research:${req.params.id}`;
  const research = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
    Research.findById(req.params.id)
      .populate('institute', 'name')
      .populate('authors', 'firstName lastName')
  );
  
  if (research) {
    res.json(research);
  } else {
    res.status(404);
    throw new Error('Research not found');
  }
});

// @desc    Update research
// @route   PUT /api/research/:id
// @access  Private
const updateResearch = asyncHandler(async (req, res) => {
  const research = await Research.findById(req.params.id);

  if (research) {
    research.title = req.body.title || research.title;
    research.description = req.body.description || research.description;
    research.institute = req.body.institute || research.institute;
    
    if (req.body.authors) {
      research.authors = JSON.parse(req.body.authors);
    }

    if (req.processedFiles) {
      const assetsPath = path.join(__dirname, '../../assets');
      
      if (req.processedFiles.thumbnail) {
        const file = req.processedFiles.thumbnail[0];
        const finalPath = path.join(assetsPath, 'images/research/thumbnail', file.fileName);
        await moveFile(file.path, finalPath);
        research.thumbnail = file.fileName;

        // Move generated thumbnail if it exists
        if (file.thumbnailPath) {
          const finalThumbPath = path.join(assetsPath, 'images/research/thumbnail', file.thumbnailFilename);
          await moveFile(file.thumbnailPath, finalThumbPath);
        }
      }
      
      if (req.processedFiles.documents) {
        for (const file of req.processedFiles.documents) {
          const finalPath = path.join(assetsPath, 'documents/research', file.fileName);
          await moveFile(file.path, finalPath);
          research.documents.push(file.fileName);

          // Move generated thumbnail for each document if it exists
          if (file.thumbnailPath) {
            const finalThumbPath = path.join(assetsPath, 'documents/research', file.thumbnailFilename);
            await moveFile(file.thumbnailPath, finalThumbPath);
          }
        }
      }
    }

    const updatedResearch = await research.save();
    await translationService.invalidateCache('research');
    res.json(updatedResearch);
  } else {
    res.status(404);
    throw new Error('Research not found');
  }
});

// @desc    Delete research
// @route   DELETE /api/research/:id
// @access  Private
const deleteResearch = asyncHandler(async (req, res) => {
  const research = await Research.findById(req.params.id);

  if (research) {
    await research.deleteOne();
    await translationService.invalidateCache('research');
    res.json({ message: 'Research removed' });
  } else {
    res.status(404);
    throw new Error('Research not found');
  }
});

module.exports = {
  createResearch,
  getResearch,
  getResearchById,
  updateResearch,
  deleteResearch
};

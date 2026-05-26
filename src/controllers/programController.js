const Program = require('../models/Program');
const { moveFile } = require('../middleware/multer');
const path = require('path');
const translationService = require('../services/translationService');

// Create
const createProgram = async (req, res) => {
  try {
    const { title, slug, category, level, duration, price, description, language, isPublished, objectives, prerequisites, outcomes } = req.body;
    
    let thumbnail, syllabus;

    if (req.processedFiles) {
      const assetsPath = path.join(__dirname, '../../assets');
      
      if (req.processedFiles.thumbnail) {
        const file = req.processedFiles.thumbnail[0];
        const finalPath = path.join(assetsPath, 'images/courses/thumbnails', file.fileName);
        await moveFile(file.path, finalPath);
        thumbnail = `/courses/images/${file.fileName}`;

        // Move generated thumbnail if it exists
        if (file.thumbnailPath) {
          const finalThumbPath = path.join(assetsPath, 'images/courses/thumbnails', file.thumbnailFilename);
          await moveFile(file.thumbnailPath, finalThumbPath);
        }
      }
      
      if (req.processedFiles.syllabus) {
        const file = req.processedFiles.syllabus[0];
        const finalPath = path.join(assetsPath, 'documents/courses/thumbnails', file.fileName);
        await moveFile(file.path, finalPath);
        syllabus = `/courses/docs/${file.fileName}`;

        // Move syllabus generated thumbnail if it exists
        if (file.thumbnailPath) {
          const finalThumbPath = path.join(assetsPath, 'documents/courses/thumbnails', file.thumbnailFilename);
          await moveFile(file.thumbnailPath, finalThumbPath);
        }
      }
    }

    const program = new Program({
      title,
      slug,
      category,
      level,
      duration,
      price: Number(price) || 0,
      description,
      language,
      isPublished: isPublished === 'true' || isPublished === true,
      objectives: objectives ? (Array.isArray(objectives) ? objectives : JSON.parse(objectives)) : [],
      prerequisites: prerequisites ? (Array.isArray(prerequisites) ? prerequisites : JSON.parse(prerequisites)) : [],
      outcomes: outcomes ? (Array.isArray(outcomes) ? outcomes : JSON.parse(outcomes)) : [],
      thumbnail,
      syllabus
    });

    await program.save();
    await translationService.invalidateCache('program');
    res.status(201).json(program);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Read All
const getPrograms = async (req, res) => {
  try {
    const lang = req.query.lang;
    const cacheKey = 'programs:all';
    const programs = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
      Program.find()
    );
    res.status(200).json(programs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Read One
const getProgramById = async (req, res) => {
  try {
    const lang = req.query.lang;
    const cacheKey = `program:${req.params.id}`;
    const program = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
      Program.findById(req.params.id)
    );
    if (!program) return res.status(404).json({ message: 'Program not found' });
    res.status(200).json(program);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update
const updateProgram = async (req, res) => {
  try {
    const program = await Program.findById(req.params.id);
    if (!program) return res.status(404).json({ message: 'Program not found' });

    // Update standard fields
    const fields = ['title', 'slug', 'category', 'level', 'duration', 'price', 'description', 'language', 'isPublished'];
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        if (f === 'price') {
          program.price = Number(req.body[f]) || 0;
        } else if (f === 'isPublished') {
          program.isPublished = req.body[f] === 'true' || req.body[f] === true;
        } else {
          program[f] = req.body[f];
        }
      }
    });

    // Handle parsed array fields if they are sent as strings
    if (req.body.objectives) {
      program.objectives = Array.isArray(req.body.objectives) ? req.body.objectives : JSON.parse(req.body.objectives);
    }
    if (req.body.prerequisites) {
      program.prerequisites = Array.isArray(req.body.prerequisites) ? req.body.prerequisites : JSON.parse(req.body.prerequisites);
    }
    if (req.body.outcomes) {
      program.outcomes = Array.isArray(req.body.outcomes) ? req.body.outcomes : JSON.parse(req.body.outcomes);
    }

    if (req.processedFiles) {
      const assetsPath = path.join(__dirname, '../../assets');
      
      if (req.processedFiles.thumbnail) {
        const file = req.processedFiles.thumbnail[0];
        const finalPath = path.join(assetsPath, 'images/courses/thumbnails', file.fileName);
        await moveFile(file.path, finalPath);
        program.thumbnail = `/courses/images/${file.fileName}`;

        // Move generated thumbnail if it exists
        if (file.thumbnailPath) {
          const finalThumbPath = path.join(assetsPath, 'images/courses/thumbnails', file.thumbnailFilename);
          await moveFile(file.thumbnailPath, finalThumbPath);
        }
      }
      
      if (req.processedFiles.syllabus) {
        const file = req.processedFiles.syllabus[0];
        const finalPath = path.join(assetsPath, 'documents/courses/thumbnails', file.fileName);
        await moveFile(file.path, finalPath);
        program.syllabus = `/courses/docs/${file.fileName}`;

        // Move syllabus generated thumbnail if it exists
        if (file.thumbnailPath) {
          const finalThumbPath = path.join(assetsPath, 'documents/courses/thumbnails', file.thumbnailFilename);
          await moveFile(file.thumbnailPath, finalThumbPath);
        }
      }
    }

    await program.save();
    await translationService.invalidateCache('program');
    res.status(200).json(program);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete
const deleteProgram = async (req, res) => {
  try {
    const program = await Program.findById(req.params.id);
    if (!program) return res.status(404).json({ message: 'Program not found' });
    await program.deleteOne();
    await translationService.invalidateCache('program');
    res.status(200).json({ message: 'Program deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createProgram,
  getPrograms,
  getProgramById,
  updateProgram,
  deleteProgram
};

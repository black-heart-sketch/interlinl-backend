const LibraryItem = require('../models/LibraryItem');
const { moveFile } = require('../middleware/multer');
const path = require('path');
const fs = require('fs');
const translationService = require('../services/translationService');

exports.getLibraryItems = async (req, res) => {
  try {
    const filter = {};
    if (req.query.studyLanguage) filter.studyLanguage = req.query.studyLanguage;
    if (req.query.type) filter.type = req.query.type;
    
    const lang = req.query.lang;
    const langCode = req.query.studyLanguage || 'all';
    const typeFilter = req.query.type || 'all';
    const cacheKey = `library:${langCode}:${typeFilter}`;

    const items = await translationService.getCachedOrTranslated(cacheKey, lang, () =>
      LibraryItem.find(filter)
        .populate('studyLanguage', 'name code')
        .populate('uploadedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
    );
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createLibraryItem = async (req, res) => {
  try {
    const { title, description, type, studyLanguage, course, isPrivate } = req.body;
    const finalDir = path.join(__dirname, '../../assets/library');
    let fileUrl = null;
    let thumbnail = null;

    if (req.processedFiles && req.processedFiles.length > 0) {
      const mainFile = req.processedFiles.find(f => f.fieldName === 'file');
      const thumbFile = req.processedFiles.find(f => f.fieldName === 'thumbnail');

      if (mainFile) {
        const finalPath = path.join(finalDir, mainFile.fileName);
        await moveFile(mainFile.path, finalPath);
        fileUrl = `/library/${mainFile.fileName}`;

        // Automatically use generated thumbnail if no custom thumbnail was provided
        if (!thumbFile && mainFile.thumbnailPath) {
          const finalThumbPath = path.join(finalDir, mainFile.thumbnailFilename);
          await moveFile(mainFile.thumbnailPath, finalThumbPath);
          thumbnail = `/library/${mainFile.thumbnailFilename}`;
        }
      }
      if (thumbFile) {
        const finalPath = path.join(finalDir, thumbFile.fileName);
        await moveFile(thumbFile.path, finalPath);
        thumbnail = `/library/${thumbFile.fileName}`;
      }
    }

    if (!fileUrl) return res.status(400).json({ message: 'A file is required for a library item' });

    const item = await LibraryItem.create({
      title, description, type, studyLanguage,
      course: course || null,
      fileUrl, thumbnail,
      isPrivate: isPrivate === 'true' || isPrivate === true,
      uploadedBy: req.user._id
    });
    await translationService.invalidateCache('library');
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateLibraryItem = async (req, res) => {
  try {
    const updates = { ...req.body };
    const finalDir = path.join(__dirname, '../../assets/library');

    if (req.processedFiles && req.processedFiles.length > 0) {
      const mainFile = req.processedFiles.find(f => f.fieldName === 'file');
      const thumbFile = req.processedFiles.find(f => f.fieldName === 'thumbnail');
      if (mainFile) {
        const finalPath = path.join(finalDir, mainFile.fileName);
        await moveFile(mainFile.path, finalPath);
        updates.fileUrl = `/library/${mainFile.fileName}`;

        // Automatically use generated thumbnail if no custom thumbnail was provided
        if (!thumbFile && mainFile.thumbnailPath) {
          const finalThumbPath = path.join(finalDir, mainFile.thumbnailFilename);
          await moveFile(mainFile.thumbnailPath, finalThumbPath);
          updates.thumbnail = `/library/${mainFile.thumbnailFilename}`;
        }
      }
      if (thumbFile) {
        const finalPath = path.join(finalDir, thumbFile.fileName);
        await moveFile(thumbFile.path, finalPath);
        updates.thumbnail = `/library/${thumbFile.fileName}`;
      }
    }

    if (req.body.isPrivate !== undefined) {
      updates.isPrivate = req.body.isPrivate === 'true' || req.body.isPrivate === true;
    }

    const item = await LibraryItem.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!item) return res.status(404).json({ message: 'Library item not found' });
    await translationService.invalidateCache('library');
    res.status(200).json(item);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteLibraryItem = async (req, res) => {
  try {
    await LibraryItem.findByIdAndDelete(req.params.id);
    await translationService.invalidateCache('library');
    res.status(200).json({ message: 'Library item deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Stream a protected library file.
 * Route: GET /api/library/stream/:filename
 * Requires authentication via protect middleware.
 */
exports.streamLibraryFile = async (req, res) => {
  try {
    // Sanitize: only allow plain filenames, no directory traversal
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.resolve(__dirname, '../../assets/library', safeFilename);

    // Ensure the resolved path is still inside the library directory
    const libraryDir = path.resolve(__dirname, '../../assets/library');
    if (!filePath.startsWith(libraryDir + path.sep) && filePath !== libraryDir) {
      return res.status(400).json({ message: 'Invalid filename' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found in library' });
    }

    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.toggleLibraryItemComplete = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const item = await LibraryItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Library item not found.' });
    }

    const User = require('../models/User');
    const StudentProfile = require('../models/StudentProfile');

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const index = user.completedLibraryItems.indexOf(id);
    let completed = false;

    if (index === -1) {
      user.completedLibraryItems.push(id);
      completed = true;
    } else {
      user.completedLibraryItems.splice(index, 1);
      completed = false;
    }

    await user.save();

    if (user.studyLanguage) {
      const totalItems = await LibraryItem.countDocuments({ studyLanguage: user.studyLanguage });
      if (totalItems > 0) {
        const completedItems = await LibraryItem.countDocuments({
          _id: { $in: user.completedLibraryItems },
          studyLanguage: user.studyLanguage
        });
        const progressPercentage = Math.round((completedItems / totalItems) * 100);

        await StudentProfile.findOneAndUpdate(
          { userId: user._id },
          { progress: progressPercentage },
          { new: true, upsert: true }
        );
      }
    }

    res.status(200).json({
      message: completed ? 'Resource marked as completed' : 'Resource marked as incomplete',
      completed,
      completedLibraryItems: user.completedLibraryItems
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


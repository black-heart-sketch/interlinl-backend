const MediaAsset = require('../models/MediaAsset');
const { moveFile } = require('../middleware/multer');
const path = require('path');

exports.createMedia = async (req, res) => {
  try {
    let url = req.body.url;

    if (req.processedFile) {
      const file = req.processedFile;
      const finalDir = path.join(__dirname, '../../assets/images/media');
      const finalPath = path.join(finalDir, file.fileName);
      await moveFile(file.path, finalPath);
      url = `/media/${file.fileName}`; // URL path mapped in index.js

      // Move generated thumbnail if it exists
      if (file.thumbnailPath) {
        const finalThumbPath = path.join(finalDir, file.thumbnailFilename);
        await moveFile(file.thumbnailPath, finalThumbPath);
      }
    }

    const media = await MediaAsset.create({
      title: req.body.title || req.body.title_fr,
      description: req.body.description || req.body.description_fr || '',
      type: req.body.type,
      status: req.body.status,
      url: url
    });
    res.status(201).json(media);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getMedia = async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    const media = await MediaAsset.find(filter).sort({ createdAt: -1 });
    res.status(200).json(media);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteMedia = async (req, res) => {
  try {
    await MediaAsset.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Media deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

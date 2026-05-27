const path = require('path');
const Service = require('../models/Service');
const Project = require('../models/Project');
const { moveFile } = require('../middleware/multer');

const slugify = (value) => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `item-${Date.now()}`;

const imageFromUpload = async (req, folder) => {
  if (!req.processedFile) return req.body.imageUrl || '';
  const finalDir = path.join(__dirname, `../assets/images/${folder}`);
  const finalPath = path.join(finalDir, req.processedFile.fileName);
  await moveFile(req.processedFile.path, finalPath);
  if (req.processedFile.thumbnailPath) {
    await moveFile(req.processedFile.thumbnailPath, path.join(finalDir, req.processedFile.thumbnailFilename));
  }
  return `/assets/images/${folder}/${req.processedFile.fileName}`;
};

const crud = (Model, folder) => ({
  list: async (req, res) => {
    const filter = req.query.public === 'true' ? { status: 'published' } : {};
    res.json(await Model.find(filter).sort({ order: 1, createdAt: -1 }));
  },
  create: async (req, res) => {
    const imageUrl = await imageFromUpload(req, folder);
    const item = await Model.create({ ...req.body, slug: req.body.slug || slugify(req.body.title), imageUrl });
    res.status(201).json(item);
  },
  update: async (req, res) => {
    const imageUrl = await imageFromUpload(req, folder);
    const payload = { ...req.body };
    if (imageUrl) payload.imageUrl = imageUrl;
    if (payload.title && !payload.slug) payload.slug = slugify(payload.title);
    const item = await Model.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!item) return res.status(404).json({ message: 'Content not found.' });
    res.json(item);
  },
  remove: async (req, res) => {
    await Model.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted.' });
  },
});

module.exports = { serviceController: crud(Service, 'services'), projectController: crud(Project, 'projects') };

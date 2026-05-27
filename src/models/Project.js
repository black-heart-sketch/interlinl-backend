const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    category: { type: String, default: 'Software' },
    technologies: [{ type: String }],
    imageUrl: { type: String, default: '' },
    projectUrl: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);

const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    category: { type: String, default: 'Technology' },
    icon: { type: String, default: 'fa-solid fa-gears' },
    imageUrl: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);

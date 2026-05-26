const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.Mixed }, // supports Number or 'new_xxx' strings
  name: { type: mongoose.Schema.Types.Mixed }, // String or { name: String } legacy object
  thumbnailName: { type: String },
  type: { type: String, enum: ['document', 'video', 'image', 'other'], default: 'document' },
  size: { type: Number },
  url: { type: String },       // served file URL path
  content: { type: String },   // base64 / blob URL (legacy compat)
  transcript: { type: String }, // transcript text or filename reference
});

const sectionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  isLocked: { type: Boolean, default: false },
  isPreviewable: { type: Boolean, default: false },
  published: { type: Boolean, default: false },
  order: { type: Number },
  priceIfLocked: { type: Number, default: 0, min: 0 },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  videos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
  resources: [resourceSchema],
  videoTranscript: resourceSchema
}, { timestamps: true });

const Section = mongoose.model('Section', sectionSchema);

module.exports = Section;

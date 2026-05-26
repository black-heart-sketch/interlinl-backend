const mongoose = require('mongoose');

const markerSchema = new mongoose.Schema({
  time: { type: Number, required: true }, // Time in seconds
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
});

const videoSchema = new mongoose.Schema({
  vimeoVideoId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  duration: { type: Number, min: 0 },
  thumbnailUrl: { type: String },
  markers: [markerSchema],
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
  url: { type: String }
}, { timestamps: true });

const Video = mongoose.model('Video', videoSchema);

module.exports = Video;

const mongoose = require('mongoose');

const libraryItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    type: { type: String, enum: ['course', 'document', 'video', 'audio'], required: true },
    fileUrl: { type: String, required: true },
    thumbnail: String,
    studyLanguage: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyLanguage', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isPrivate: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('LibraryItem', libraryItemSchema);

const mongoose = require('mongoose');
const crypto = require('crypto');

const courseSchema = new mongoose.Schema(
  {
    courseCode: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(4).toString('hex') // Generates a unique 8-character hex string
    },
    title: { type: String, required: true },
    description: String,
    thumbnail: String,
    syllabus: String,
    studyLanguage: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyLanguage' },
    institute: { type: mongoose.Schema.Types.ObjectId, ref: 'Institute' },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Fields from wowinvest
    category: { type: String, trim: true },
    difficulty: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'All Levels'],
      default: 'All Levels'
    },
    level: {
      type: String,
      enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'none'],
      default: 'none'
    },
    plan: {
      type: String,
      enum: ['Free', 'Freemium', 'Premium'],
      required: true,
      default: 'Free'
    },
    price: { type: Number, default: 0, min: 0 },
    paymentType: {
      type: String,
      enum: ['full', 'per_chapter'],
    },
    sections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Section' }],
    status: { type: String, enum: ['Draft', 'Archived', 'Pending Approval', 'Published'], default: 'Draft' },
    archivedAt: { type: Date },
    enrolledStudents: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0, min: 0, max: 100 },
    avgWatchTime: { type: Number, default: 0, min: 0, max: 100 },
    quizPassRate: { type: Number, default: 0, min: 0, max: 100 },
    attachments: [{
      id: { type: mongoose.Schema.Types.Mixed }, // Number or 'new_xxx' string
      name: { type: String },
      thumbnailName: { type: String },
      type: { type: String, enum: ['document', 'video', 'image', 'other'], default: 'document' },
      size: { type: Number },
      url: { type: String }, // served path e.g. /assets/documents/courses/:id/:filename
    }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);

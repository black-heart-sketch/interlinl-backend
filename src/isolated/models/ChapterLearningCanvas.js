const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    generationId: { type: mongoose.Schema.Types.ObjectId, required: true },
    score: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
    submittedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const quizGenerationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    generatedAt: { type: Date, default: Date.now },
    questions: { type: mongoose.Schema.Types.Mixed, default: [] }
  },
  { timestamps: true }
);

const progressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    completedItems: [{ type: String }],
    lastVisitedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const chapterLearningCanvasSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
    canvas: { type: mongoose.Schema.Types.Mixed, default: null },
    focusCanvases: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    quizGenerations: [quizGenerationSchema],
    quizAttempts: [quizAttemptSchema],
    progress: [progressSchema]
  },
  { timestamps: true }
);

chapterLearningCanvasSchema.index({ course: 1, section: 1 }, { unique: true });

module.exports = mongoose.model('ChapterLearningCanvas', chapterLearningCanvasSchema);

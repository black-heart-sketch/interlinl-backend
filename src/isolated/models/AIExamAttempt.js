const mongoose = require('mongoose');

const aiExamAttemptSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AIExamSession', required: true, index: true },
  generatedExam: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedMockExam', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['in_progress', 'submitted', 'graded'], default: 'in_progress', index: true },
  currentSectionKey: { type: String, trim: true },
  sectionAnswers: { type: mongoose.Schema.Types.Mixed, default: {} },
  startedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date },
  correction: { type: mongoose.Schema.Types.Mixed },
  correctedAt: { type: Date }
}, { timestamps: true });

aiExamAttemptSchema.index({ session: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('AIExamAttempt', aiExamAttemptSchema);

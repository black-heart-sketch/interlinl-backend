const mongoose = require('mongoose');

const examAttemptSchema = new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: { type: Map, of: Number, default: {} }, // map of questionIndex to selectedOptionIndex
  score: { type: Number, default: 0 },
  status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
  startedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date }
}, { timestamps: true });

// A student can only have one attempt per exam
examAttemptSchema.index({ exam: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('ExamAttempt', examAttemptSchema);

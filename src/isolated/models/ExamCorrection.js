const mongoose = require('mongoose');

const examCorrectionSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AIExamSession', required: true, index: true },
  attempt: { type: mongoose.Schema.Types.ObjectId, ref: 'AIExamAttempt', required: true, unique: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  generatedExam: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedMockExam', required: true },
  correction: { type: mongoose.Schema.Types.Mixed, required: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  releasedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('ExamCorrection', examCorrectionSchema);

const mongoose = require('mongoose');

const courseExamAttemptSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseExam', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mcqAnswers: { type: Map, of: String, default: {} },
    structuredAnswers: { type: Map, of: String, default: {} },
    mcqScore: { type: Number, default: 0, min: 0, max: 100 },
    correctMcqs: { type: Number, default: 0, min: 0 },
    totalMcqs: { type: Number, default: 0, min: 0 },
    submittedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('CourseExamAttempt', courseExamAttemptSchema);

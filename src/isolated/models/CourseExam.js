const mongoose = require('mongoose');

const mcqOptionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    isCorrect: { type: Boolean, default: false }
  },
  { _id: true }
);

const mcqQuestionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true, trim: true },
    options: {
      type: [mcqOptionSchema],
      validate: {
        validator: (options) => Array.isArray(options) && options.length === 4,
        message: 'Each MCQ question must have exactly 4 options.'
      }
    },
    explanation: { type: String, trim: true }
  },
  { _id: true }
);

const structuredQuestionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true, trim: true },
    expectedAnswer: { type: String, trim: true },
    gradingGuide: { type: String, trim: true },
    points: { type: Number, default: 10, min: 0 }
  },
  { _id: true }
);

const courseExamSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, unique: true, index: true },
    title: { type: String, default: 'Final Course Exam', trim: true },
    instructions: { type: String, trim: true },
    mcqs: [mcqQuestionSchema],
    structuredQuestions: [structuredQuestionSchema],
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    aiRevisionNotes: [{ type: String, trim: true }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('CourseExam', courseExamSchema);

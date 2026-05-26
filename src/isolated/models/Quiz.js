const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctOptionIndex: { type: Number, required: true }, // 0-indexed correct option
  explanation: String
});

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    libraryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryItem', required: true, unique: true },
    questions: [questionSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Quiz', quizSchema);

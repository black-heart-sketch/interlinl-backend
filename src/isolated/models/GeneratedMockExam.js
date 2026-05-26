const mongoose = require('mongoose');

const generatedMockExamSchema = new mongoose.Schema({
  blueprint: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamBlueprint', required: true, index: true },
  studyLanguage: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyLanguage', required: true, index: true },
  examFamily: { type: String, required: true, trim: true },
  level: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], required: true, index: true },
  title: { type: String, required: true, trim: true },
  instructions: { type: String, trim: true },
  sections: [{ type: mongoose.Schema.Types.Mixed }],
  status: { type: String, enum: ['draft', 'approved', 'archived'], default: 'draft' },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  aiPrompt: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('GeneratedMockExam', generatedMockExamSchema);

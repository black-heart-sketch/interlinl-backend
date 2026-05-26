const mongoose = require('mongoose');

const examBlueprintSectionSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  type: { type: String, enum: ['listening', 'reading', 'writing', 'speaking'], required: true },
  durationMinutes: { type: Number, required: true, min: 1 },
  maxScore: { type: Number, required: true, min: 1 },
  instructions: { type: String, trim: true },
  questionTypes: [{ type: String, trim: true }],
  rubric: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const examBlueprintSchema = new mongoose.Schema({
  studyLanguage: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyLanguage', required: true, index: true },
  languageName: { type: String, trim: true },
  examFamily: { type: String, required: true, trim: true, index: true },
  level: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  totalDurationMinutes: { type: Number, min: 1 },
  passScore: { type: Number, default: 60, min: 0, max: 100 },
  sections: [examBlueprintSectionSchema],
  generationPrompt: { type: String, trim: true },
  correctionRubric: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('ExamBlueprint', examBlueprintSchema);

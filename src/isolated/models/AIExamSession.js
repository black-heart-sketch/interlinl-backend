const mongoose = require('mongoose');

const aiExamSessionSchema = new mongoose.Schema({
  generatedExam: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedMockExam', required: true, index: true },
  studyLanguage: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyLanguage', required: true, index: true },
  examFamily: { type: String, required: true, trim: true },
  level: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], required: true, index: true },
  title: { type: String, required: true, trim: true },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'open', 'closed', 'grading', 'results_released'],
    default: 'draft',
    index: true
  },
  accessMode: { type: String, enum: ['language_level', 'language_all_levels', 'selected_students'], default: 'language_level' },
  eligibleStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  allowLateJoin: { type: Boolean, default: false },
  strictSectionOrder: { type: Boolean, default: true },
  noRetake: { type: Boolean, default: true },
  autoSubmitAtClose: { type: Boolean, default: true },
  speakingUploadRequired: { type: Boolean, default: false },
  antiCheatEnabled: { type: Boolean, default: true },
  resultReleaseMode: { type: String, enum: ['manual', 'automatic_after_grading'], default: 'manual' },
  launchedAt: { type: Date },
  closedAt: { type: Date },
  resultsReleasedAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('AIExamSession', aiExamSessionSchema);

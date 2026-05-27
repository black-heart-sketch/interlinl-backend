const mongoose = require('mongoose');

const scoreField = { type: Number, min: 0, max: 100, default: 0 };

const evaluationSchema = new mongoose.Schema(
  {
    intern: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    internship: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship' },
    punctuality: scoreField,
    taskCompletion: scoreField,
    communication: scoreField,
    technicalSkills: scoreField,
    creativity: scoreField,
    discipline: scoreField,
    totalScore: { type: Number, min: 0, max: 100, default: 0 },
    feedback: { type: String, default: '' },
    aiAnalysis: { type: mongoose.Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved'],
      default: 'submitted',
    },
  },
  { timestamps: true }
);

evaluationSchema.pre('save', function calculateTotal(next) {
  const fields = ['punctuality', 'taskCompletion', 'communication', 'technicalSkills', 'creativity', 'discipline'];
  this.totalScore = Math.round(fields.reduce((sum, field) => sum + Number(this[field] || 0), 0) / fields.length);
  next();
});

module.exports = mongoose.model('Evaluation', evaluationSchema);

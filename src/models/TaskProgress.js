const mongoose = require('mongoose');

const taskProgressSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    intern: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'submitted', 'completed', 'rejected'],
      default: 'pending'
    },
    submissionNotes: String,
    submissionUrl: String,
    feedback: String,
    score: { type: Number, min: 0, max: 100 },
    startedAt: Date,
    submittedAt: Date,
    reviewedAt: Date
  },
  { timestamps: true }
);

taskProgressSchema.index({ task: 1, intern: 1 }, { unique: true });
taskProgressSchema.index({ intern: 1, status: 1 });

module.exports = mongoose.model('TaskProgress', taskProgressSchema);

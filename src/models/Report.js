const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    intern: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: ['daily', 'weekly', 'final'],
      required: true,
    },
    title: { type: String, required: true },
    content: { type: String, required: true }, // What was done
    challenges: { type: String, default: '' }, // Blockers / difficulties faced
    nextSteps: { type: String, default: '' },  // Plan for the next period
    attachmentUrl: { type: String, default: '' }, // Optional file / link
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'approved', 'rejected'],
      default: 'pending',
    },
    score: { type: Number, min: 0, max: 100 },
    feedback: { type: String, default: '' },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    week: { type: Number }, // week number for weekly reports (1-52)
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);

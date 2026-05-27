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
    attachments: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        type: { type: String, default: 'file' },
        size: { type: Number, default: 0 },
        thumbnailUrl: { type: String, default: '' },
      }
    ],
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'approved', 'rejected'],
      default: 'pending',
    },
    score: { type: Number, min: 0, max: 100 },
    feedback: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    week: { type: Number }, // week number for weekly reports (1-52)
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);

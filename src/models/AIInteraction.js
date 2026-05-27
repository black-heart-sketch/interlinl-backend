const mongoose = require('mongoose');

const aiInteractionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    feature: {
      type: String,
      enum: ['generate-report', 'review-report', 'task-suggestions', 'performance-analysis', 'final-summary', 'chat'],
      required: true,
    },
    provider: { type: String, default: 'fallback' },
    status: {
      type: String,
      enum: ['success', 'fallback', 'error'],
      default: 'fallback',
    },
    prompt: { type: String, default: '' },
    response: { type: mongoose.Schema.Types.Mixed },
    error: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AIInteraction', aiInteractionSchema);

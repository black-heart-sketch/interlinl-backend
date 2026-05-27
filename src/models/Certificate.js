const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
  {
    certificateNumber: { type: String, required: true, unique: true },
    intern: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    internship: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', required: true },
    evaluation: { type: mongoose.Schema.Types.ObjectId, ref: 'Evaluation' },
    department: { type: String, required: true },
    finalScore: { type: Number, min: 0, max: 100, default: 0 },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['pending_manager_approval', 'issued', 'revoked'],
      default: 'pending_manager_approval',
    },
    issueDate: { type: Date, default: Date.now },
    verificationUrl: { type: String, required: true },
    qrCodeSvg: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Certificate', certificateSchema);

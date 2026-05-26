const mongoose = require('mongoose');

const internshipApplicationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    department: {
      type: String,
      required: true,
      enum: ['Software Engineering', 'Cybersecurity', 'AI Development', 'IoT Engineering', 'Graphic Design', 'Web & Mobile Development']
    },
    studyMode: {
      type: String,
      enum: ['online', 'on_site'],
      default: 'online'
    },
    paymentOption: {
      type: String,
      enum: ['pay_now', 'pay_later'],
      default: 'pay_now'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending'
    },
    transactionId: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    resumeUrl: String,
    coverLetter: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('InternshipApplication', internshipApplicationSchema);

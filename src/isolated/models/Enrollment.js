const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  enrollmentDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'completed', 'pending_payment'], default: 'active' },
  accessLevel: { type: String, enum: ['preview', 'full'], default: 'full' },
  paidSections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Section' }],
  pendingSectionPayments: [{
    section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    amount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    requestedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date }
  }],
  progress: {
    completedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
    completedSections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Section' }],
    completedNotions: [{ type: mongoose.Schema.Types.ObjectId }],
    overallPercentage: { type: Number, default: 0, min: 0, max: 100 }
  },
}, { timestamps: true });

enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);

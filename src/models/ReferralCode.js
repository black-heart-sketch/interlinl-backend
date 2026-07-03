const mongoose = require('mongoose');

const referralCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    label: {
      type: String,
      trim: true,
      default: ''
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    },
    usageCount: {
      type: Number,
      default: 0
    },
    lastUsedAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

referralCodeSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('ReferralCode', referralCodeSchema);

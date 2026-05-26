const mongoose = require('mongoose');

const mediaAssetSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    type: { 
      type: String, 
      enum: ['photo', 'video', 'flyer'], 
      required: true 
    },
    url: { type: String, required: true },
    status: {
      type: String,
      enum: ['Live', 'Review', 'Scheduled', 'Archived'],
      default: 'Review'
    },
    // Specific to flyers:
    campaign: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    channel: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('MediaAsset', mediaAssetSchema);

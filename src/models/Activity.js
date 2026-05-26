const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { 
      type: String, 
      enum: ['Speaking', 'Practice', 'Career', 'Assessment', 'Other'], 
      default: 'Other' 
    },
    duration: { type: String, required: true }, // e.g., '09:00 - 10:30'
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['Draft', 'Scheduled', 'Active', 'Completed'],
      default: 'Scheduled'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Activity', activitySchema);

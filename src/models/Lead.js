const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: String,
    phone: String,
    interest: String,
    source: String,
    status: { 
      type: String, 
      enum: ['new', 'contacted', 'meeting_set', 'test_taken', 'registration_pending', 'paid', 'active', 'abandoned', 'converted'],
      default: 'new' 
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: [{
      content: String,
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: { type: Date, default: Date.now }
    }],
    nextFollowUp: Date,
    priorityScore: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lead', leadSchema);

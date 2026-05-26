const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentCode: { type: String, unique: true },
    currentLevel: String,
    targetLevel: String,
    programIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Program' }],
    campusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institute' }, // Assuming Institute is campus
    admissionStatus: { 
      type: String, 
      enum: ['new_prospect', 'registered', 'in_training', 'ready_for_exam', 'visa_prep', 'dossier_sent', 'accepted', 'in_germany', 'alumni'],
      default: 'new_prospect'
    },
    visaStatus: String,
    documents: [{
      name: String,
      url: String,
      type: String, // e.g. passport, diploma, motivation_letter
      verified: { type: Boolean, default: false }
    }],
    progress: { type: Number, default: 0 },
    assignedAdvisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('StudentProfile', studentProfileSchema);

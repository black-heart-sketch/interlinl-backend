const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    country: String,
    city: String,
    type: { 
      type: String, 
      enum: ['school', 'employer', 'nursing_home', 'training_center', 'agency', 'institution', 'ngo', 'legal']
    },
    logo: String,
    website: String,
    contactPerson: String,
    email: String,
    status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'active' },
    agreementFiles: [{
      name: String,
      url: String
    }],
    studentsPlaced: { type: Number, default: 0 },
    publicVisible: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Partner', partnerSchema);

const mongoose = require('mongoose');

const instituteSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    location: String,
    description: String,
    logo: String,
    background: String,
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Institute', instituteSchema);

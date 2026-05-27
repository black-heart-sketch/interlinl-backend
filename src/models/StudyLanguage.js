const mongoose = require('mongoose');

const studyLanguageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('StudyLanguage', studyLanguageSchema);

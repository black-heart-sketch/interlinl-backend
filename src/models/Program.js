const mongoose = require('mongoose');

const programSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    category: { 
      type: String, 
      enum: ['language', 'preparation', 'integration', 'coaching'],
      default: 'language' 
    },
    level: String, // A1, A2, B1, B2, C1
    duration: String, // e.g., '6 months'
    price: Number,
    description: String,
    thumbnail: String,
    syllabus: String,
    objectives: [String],
    prerequisites: [String],
    outcomes: [String],
    language: { type: String, default: 'de' },
    isPublished: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Program', programSchema);

const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true },
    photo: String,
    videoUrl: String,
    story: String,
    destinationCountry: String,
    city: String,
    program: String,
    year: String,
    verified: { type: Boolean, default: false },
    published: { type: Boolean, default: false },
    internalValidationDoc: String // document de validation interne
  },
  { timestamps: true }
);

module.exports = mongoose.model('Testimonial', testimonialSchema);

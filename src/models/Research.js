const mongoose = require('mongoose');

const researchSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    thumbnail: String,
    documents: [String],
    institute: { type: mongoose.Schema.Types.ObjectId, ref: 'Institute' },
    authors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Research', researchSchema);

const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true
    },
    section: {
      type: String,
      enum: ['English', 'French'],
      required: true
    },
    level: {
      type: Number,
      enum: [1, 2, 3],
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Class', classSchema);

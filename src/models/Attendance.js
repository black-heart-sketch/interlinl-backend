const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    intern: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    department: { type: String, default: 'none' },
    date: { type: Date, required: true },
    checkInAt: { type: Date },
    checkOutAt: { type: Date },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused'],
      default: 'present',
    },
    source: {
      type: String,
      enum: ['manual', 'qr', 'system'],
      default: 'manual',
    },
    qrToken: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

attendanceSchema.index({ intern: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);

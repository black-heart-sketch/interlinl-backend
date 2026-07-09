const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    enrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment' },
    purpose: { type: String, enum: ['registration', 'course', 'section', 'internship', 'other'], default: 'other' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'XAF' },
    method: { type: String, enum: ['bank_transfer', 'cash', 'credit_card', 'mobile_money'] },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
    reference: String,
    installmentNumber: Number,
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminNote: String,
    invoiceUrl: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);

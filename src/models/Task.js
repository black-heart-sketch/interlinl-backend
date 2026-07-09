const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    intern: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    targetStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    department: {
      type: String,
      enum: ['Software Engineering', 'Cybersecurity', 'AI Development', 'IoT Engineering', 'Graphic Design', 'Web & Mobile Development']
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'custom'],
      default: 'daily'
    },
    assignmentScope: {
      type: String,
      enum: ['individual', 'selected', 'all'],
      default: 'individual'
    },
    assignmentBatchId: String,
    period: {
      day: Date,
      weekStart: Date,
      monthStart: Date,
      year: Number,
      week: Number,
      month: Number
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'submitted', 'completed', 'rejected'],
      default: 'pending'
    },
    deadline: Date,
    notificationSentAt: Date,
    submissionNotes: String,
    submissionUrl: String,
    feedback: String,
    score: { type: Number, min: 0, max: 100 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);

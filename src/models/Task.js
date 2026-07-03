const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    intern: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    department: {
      type: String,
      required: true,
      enum: ['Software Engineering', 'Cybersecurity', 'AI Development', 'IoT Engineering', 'Graphic Design', 'Web & Mobile Development']
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'custom'],
      default: 'daily'
    },
    assignmentScope: {
      type: String,
      enum: ['individual', 'selected', 'all'],
      default: 'individual'
    },
    assignmentBatchId: String,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'submitted', 'completed', 'rejected'],
      default: 'pending'
    },
    deadline: Date,
    submissionNotes: String,
    submissionUrl: String,
    feedback: String,
    score: { type: Number, min: 0, max: 100 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);

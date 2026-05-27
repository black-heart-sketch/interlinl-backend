const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, default: 'file' },
    size: { type: Number, default: 0 },
    thumbnailUrl: { type: String, default: '' },
  },
  { _id: false }
);

const timelineItemSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    order: { type: Number, required: true },
    dueDate: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'submitted', 'completed'],
      default: 'pending',
    },
    notes: { type: String, default: '' },
    completedAt: { type: Date },
  },
  { _id: true }
);

const studentProjectSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    internship: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship' },
    title: { type: String, required: true },
    theme: { type: String, required: true },
    abstract: { type: String, default: '' },
    problemStatement: { type: String, default: '' },
    objectives: { type: String, default: '' },
    methodology: { type: String, default: '2TUP / UML' },
    technologies: [{ type: String }],
    academicSupervisor: { type: String, default: '' },
    companySupervisor: { type: String, default: '' },
    schoolStructure: {
      type: String,
      default: 'AICS Cameroon project report structure',
    },
    attachments: [attachmentSchema],
    status: {
      type: String,
      enum: ['submitted', 'approved', 'rejected', 'in_progress', 'completed'],
      default: 'submitted',
    },
    validationFeedback: { type: String, default: '' },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    validatedAt: { type: Date },
    startDate: { type: Date },
    endDate: { type: Date },
    timeline: [timelineItemSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('StudentProject', studentProjectSchema);

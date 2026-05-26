const mongoose = require('mongoose');

const internshipSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    department: {
      type: String,
      required: true,
      enum: ['Software Engineering', 'Cybersecurity', 'AI Development', 'IoT Engineering', 'Graphic Design', 'Web & Mobile Development']
    },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    startDate: { type: Date, default: Date.now },
    endDate: Date,
    status: {
      type: String,
      enum: ['active', 'completed', 'terminated'],
      default: 'active'
    },
    tasksCompleted: { type: Number, default: 0 },
    totalTasks: { type: Number, default: 0 },
    attendanceRate: { type: Number, default: 100 },
    supervisorRating: { type: Number, default: 5 },
    progress: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Internship', internshipSchema);

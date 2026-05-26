const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    email: {
      type: String,
      required: true,
      unique: true
    },
    phone: String,
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['public', 'student', 'teacher', 'advisor', 'admin', 'superadmin', 'partner', 'supervisor', 'manager'],
      default: 'student'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending', 'banned'],
      default: 'active'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    language: {
      type: String,
      enum: ['fr', 'de', 'en'],
      default: 'fr'
    },
    avatar: String,
    studyLanguage: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyLanguage' },
    department: {
      type: String,
      enum: ['Software Engineering', 'Cybersecurity', 'AI Development', 'IoT Engineering', 'Graphic Design', 'Web & Mobile Development', 'none'],
      default: 'none'
    },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    viewedResearch: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Research' }],
    viewedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    completedLibraryItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LibraryItem' }]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');

const liveClassSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['course', 'conference', 'webinar', 'mentorship'],
    default: 'course'
  },
  audience: {
    type: String,
    enum: ['study_language', 'all_users', 'internship_pair'],
    default: 'study_language'
  },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  studyLanguage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudyLanguage',
    required: function requireStudyLanguage() {
      return this.audience === 'study_language';
    }
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function requireTeacher() {
      return this.type === 'course';
    }
  },
  scheduledStartTime: {
    type: Date,
    required: true
  },
  scheduledEndTime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed'],
    default: 'scheduled'
  },
  meetingId: {
    type: String,
    required: true,
    unique: true
  },
  transcript: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('LiveClass', liveClassSchema);

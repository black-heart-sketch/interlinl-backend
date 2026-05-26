const mongoose = require('mongoose');
require('dotenv').config();
const Exam = require('./src/models/Exam');
const Course = require('./src/models/Course');
const User = require('./src/models/User');

const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/einstein';

mongoose.connect(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('DB Connected for seeding Exams');
    
    const admin = await User.findOne({ role: 'admin' }) || await User.findOne({ role: 'superadmin' });
    const course = await Course.findOne();
    
    if (!admin || !course) {
      console.log('Admin or Course not found. Please seed users and courses first.');
      process.exit(1);
    }

    const now = new Date();
    const startTime = new Date(now.getTime() - 1000 * 60 * 5); // Started 5 mins ago
    const endTime = new Date(now.getTime() + 1000 * 60 * 60); // Ends in 1 hr

    const testExam = {
      title: 'Examen de Test - Module IA',
      description: 'Cet examen valide vos connaissances de base.',
      course: course._id,
      startTime,
      endTime,
      durationMinutes: 30,
      isPublished: true,
      createdBy: admin._id,
      questions: [
        {
          questionText: 'Que signifie IA ?',
          options: ['Intelligence Artificielle', 'Intranet Associatif', 'Internet Automatique'],
          correctOptionIndex: 0
        },
        {
          questionText: 'Lequel de ces langages est souvent utilisé en Machine Learning ?',
          options: ['HTML', 'Python', 'CSS'],
          correctOptionIndex: 1
        }
      ]
    };

    await Exam.create(testExam);
    console.log('Exam seeded successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

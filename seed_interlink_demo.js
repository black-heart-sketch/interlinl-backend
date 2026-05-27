const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./src/models/User');
const Internship = require('./src/models/Internship');
const Service = require('./src/models/Service');
const Project = require('./src/models/Project');

dotenv.config({ override: true });

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function upsertUser(user) {
  const passwordHash = await bcrypt.hash(user.password || 'password123', 10);
  return User.findOneAndUpdate(
    { email: user.email },
    { ...user, passwordHash, status: 'active', isActive: true },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/interlink');

  const admin = await upsertUser({ firstName: 'InterLink', lastName: 'Admin', email: 'admin@interlink.local', role: 'superadmin', department: 'Software Engineering' });
  const supervisor = await upsertUser({ firstName: 'Amina', lastName: 'Supervisor', email: 'supervisor@interlink.local', role: 'supervisor', department: 'Software Engineering' });
  const student = await upsertUser({ firstName: 'Demo', lastName: 'Intern', email: 'student@interlink.local', role: 'student', department: 'Software Engineering' });
  
  await Internship.findOneAndUpdate(
    { student: student._id },
    { student: student._id, supervisor: supervisor._id, department: 'Software Engineering', status: 'active', progress: 45, attendanceRate: 92 },
    { upsert: true, new: true }
  );

  for (const title of ['Software Development', 'AI Solutions', 'Cybersecurity', 'IoT Engineering']) {
    await Service.findOneAndUpdate(
      { slug: slugify(title) },
      { title, slug: slugify(title), description: `${title} services delivered by InterLink engineering teams.`, status: 'published' },
      { upsert: true }
    );
  }

  for (const title of ['Internship Management Platform', 'AI Report Assistant', 'Secure IoT Dashboard']) {
    await Project.findOneAndUpdate(
      { slug: slugify(title) },
      { title, slug: slugify(title), description: `${title} built as an InterLink showcase project.`, technologies: ['React', 'Node.js', 'MongoDB'], status: 'published', featured: true },
      { upsert: true }
    );
  }

  console.log('InterLink demo data seeded.');
  console.log('Admin:', admin.email, 'Supervisor:', supervisor.email, 'Student:', student.email, 'Password: password123');
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});

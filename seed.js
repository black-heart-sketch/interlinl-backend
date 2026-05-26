const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/einstein');

async function seed() {
  const admin = await User.findOne({ role: 'superadmin' });
  if (admin) {
    console.log("Admin exists:", admin.email);
  } else {
    console.log("No superadmin found.");
  }
  process.exit(0);
}
seed();

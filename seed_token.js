const jwt = require('jsonwebtoken');
const User = require('./src/models/User');
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/einstein');

async function run() {
  const admin = await User.findOne({ role: 'superadmin' });
  if (admin) {
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
    console.log(token);
  }
  process.exit(0);
}
run();

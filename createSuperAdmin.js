const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

require('dotenv').config();

async function createAdmin() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);
  
  const user = await User.create({
    firstName: 'Super',
    lastName: 'Admin',
    email: 'superadmin@einstein.com',
    passwordHash: passwordHash,
    role: 'superadmin'
  });
  
  console.log('Superadmin created!', user);
  process.exit();
}

createAdmin();

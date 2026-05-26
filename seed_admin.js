const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./src/models/User');

dotenv.config({ override: true });

const USERS_TO_SEED = [
  {
    firstName: 'Super',
    lastName: 'Admin',
    email: 'superadmin@einstein.com',
    role: 'superadmin',
    status: 'active'
  },
  {
    firstName: 'Albert',
    lastName: 'Einstein',
    email: 'admin@einstein.com',
    role: 'admin',
    status: 'active'
  },
  {
    firstName: 'John',
    lastName: 'Teacher',
    email: 'teacher@einstein.com',
    role: 'teacher',
    status: 'active'
  },
  {
    firstName: 'Sarah',
    lastName: 'Advisor',
    email: 'advisor@einstein.com',
    role: 'advisor',
    status: 'active'
  },
  {
    firstName: 'Goethe',
    lastName: 'Partner',
    email: 'partner@einstein.com',
    role: 'partner',
    status: 'active'
  },
  {
    firstName: 'Paul',
    lastName: 'Public',
    email: 'public@einstein.com',
    role: 'public',
    status: 'active'
  }
];

async function seed() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/InstituteEinsteins';
  console.log(`Connecting to database at ${uri}...`);
  await mongoose.connect(uri);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  for (const userData of USERS_TO_SEED) {
    const exists = await User.findOne({ email: userData.email });
    if (!exists) {
      await User.create({
        ...userData,
        passwordHash,
        isVerified: true
      });
      console.log(`✅ Created ${userData.role} user: ${userData.email}`);
    } else {
      console.log(`⏭️  User ${userData.email} already exists.`);
    }
  }

  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Error seeding users:', err);
  process.exit(1);
});


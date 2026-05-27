const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Class = require('./src/models/Class');

dotenv.config({ override: true });

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  console.log(`Connecting to MongoDB: ${mongoUri.replace(/:([^@]+)@/, ':****@')}`);
  await mongoose.connect(mongoUri);

  const classesToSeed = [
    { name: 'Level 1', section: 'French', level: 1, status: 'active' },
    { name: 'Level 1', section: 'English', level: 1, status: 'active' },
    { name: 'Level 2', section: 'French', level: 2, status: 'active' },
    { name: 'Level 2', section: 'English', level: 2, status: 'active' },
    { name: 'Level 3', section: 'French', level: 3, status: 'active' },
    { name: 'Level 3', section: 'English', level: 3, status: 'active' },
  ];

  // Clean up the temporary Level 1, Level 2, Level 3 classes that were accidentally added
  // await Class.deleteMany({ name: { $in: ['Level 1', 'Level 2', 'Level 3'] } });

  for (const classData of classesToSeed) {
    const result = await Class.findOneAndUpdate(
      { name: classData.name },
      classData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`Upserted class: ${result.name} (Section: ${result.section}, Level: ${result.level})`);
  }

  console.log('Seeding of dynamic classes / cohorts completed successfully.');
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Error seeding classes:', error);
  await mongoose.disconnect();
  process.exit(1);
});

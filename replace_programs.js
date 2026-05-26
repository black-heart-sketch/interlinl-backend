const mongoose = require('mongoose');
const Program = require('./src/models/Program');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/einstein');

async function run() {
  await Program.deleteMany({});
  
  const programs = [
    {
      title: 'Intensive German A1-B2',
      slug: 'intensive-german-a1-b2',
      category: 'language',
      level: 'B2',
      duration: '6 months',
      price: 250000,
      description: 'A fast-track immersion program designed for absolute beginners to reach conversational and professional fluency (B2) in just six months.',
      objectives: ['Master basic grammar', 'Hold fluent conversations', 'Prepare for Goethe B2 exam'],
      prerequisites: ['None. Suitable for complete beginners.'],
      outcomes: ['Goethe-Zertifikat B2', 'University admission readiness'],
      language: 'de',
      isPublished: true
    },
    {
      title: 'DELF/DALF French Certification Prep',
      slug: 'delf-dalf-french-prep',
      category: 'preparation',
      level: 'C1',
      duration: '3 months',
      price: 150000,
      description: 'Intensive preparation course for students aiming to pass official French language certifications (DELF B2 or DALF C1).',
      objectives: ['Master exam formats', 'Improve essay writing', 'Perfect listening comprehension'],
      prerequisites: ['Current B1 or B2 level in French'],
      outcomes: ['DELF/DALF Certification', 'Enhanced academic vocabulary'],
      language: 'fr',
      isPublished: true
    },
    {
      title: 'Conversational English Mastery',
      slug: 'conversational-english',
      category: 'language',
      level: 'B2',
      duration: '4 months',
      price: 180000,
      description: 'Focus exclusively on speaking and listening skills. Perfect for professionals looking to confidently navigate international environments.',
      objectives: ['Improve accent and pronunciation', 'Expand business vocabulary', 'Gain speaking confidence'],
      prerequisites: ['Basic A2 English understanding'],
      outcomes: ['Fluent conversational ability', 'Interview readiness'],
      language: 'en',
      isPublished: true
    }
  ];

  for (const prog of programs) {
    await Program.create(prog);
  }
  
  console.log('Successfully replaced programs with language-focused courses.');
  process.exit(0);
}

run();

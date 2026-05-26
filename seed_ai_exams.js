/**
 * seed_ai_exams.js
 *
 * Seeds the scheduled AI mock exam foundation:
 * - Italian study language
 * - Italian B1 student
 * - CERT.IT B1 blueprint
 * - approved generated mock exam
 * - scheduled exam session
 *
 * Usage: node seed_ai_exams.js OR npm run seed:ai-exams
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ override: true });

const User = require('./src/models/User');
const StudyLanguage = require('./src/isolated/models/StudyLanguage');
const ExamBlueprint = require('./src/isolated/models/ExamBlueprint');
const GeneratedMockExam = require('./src/isolated/models/GeneratedMockExam');
const AIExamSession = require('./src/isolated/models/AIExamSession');

async function upsert(Model, query, defaults, label) {
  const existing = await Model.findOne(query);
  if (existing) {
    console.log(`   ⏭  Already exists – ${label}`);
    return existing;
  }
  const doc = await Model.create({ ...query, ...defaults });
  console.log(`   ✅  Created – ${label} (${doc._id})`);
  return doc;
}

const certItSections = [
  {
    key: 'ascolto',
    title: 'Ascolto',
    type: 'listening',
    durationMinutes: 30,
    maxScore: 25,
    instructions: 'Comprensione orale con dialoghi e annunci brevi.',
    questionTypes: ['mcq', 'true_false'],
    rubric: { criteria: ['Comprensione globale', 'Dettagli specifici'] }
  },
  {
    key: 'lettura',
    title: 'Lettura',
    type: 'reading',
    durationMinutes: 45,
    maxScore: 25,
    instructions: 'Comprensione scritta di testi informativi e narrativi.',
    questionTypes: ['mcq', 'short_answer'],
    rubric: { criteria: ['Comprensione del testo', 'Lessico in contesto'] }
  },
  {
    key: 'scritta',
    title: 'Scritta',
    type: 'writing',
    durationMinutes: 45,
    maxScore: 25,
    instructions: 'Produzione scritta: email formale e breve testo argomentativo.',
    questionTypes: ['essay'],
    rubric: { criteria: ['Coerenza', 'Correttezza grammaticale', 'Lessico', 'Adeguatezza al compito'] }
  },
  {
    key: 'orale',
    title: 'Orale',
    type: 'speaking',
    durationMinutes: 20,
    maxScore: 25,
    instructions: 'Presentazione personale, descrizione immagine e conversazione guidata.',
    questionTypes: ['speaking_prompt'],
    rubric: { criteria: ['Fluenza', 'Pronuncia', 'Interazione', 'Accuratezza'] }
  }
];

const generatedSections = [
  {
    key: 'ascolto',
    title: 'Ascolto',
    type: 'listening',
    durationMinutes: 30,
    maxScore: 25,
    instructions: 'Ascolta i testi e rispondi alle domande.',
    content: {
      listeningScripts: [
        {
          id: 'audio_1',
          title: 'Annuncio alla stazione',
          text: 'Attenzione, il treno regionale per Firenze partirà dal binario cinque con dieci minuti di ritardo.'
        }
      ]
    },
    questions: [
      {
        id: 'a1',
        type: 'mcq',
        prompt: 'Da quale binario partirà il treno?',
        options: ['Tre', 'Cinque', 'Sette']
      }
    ],
    answerKey: { a1: 'Cinque' },
    rubric: {}
  },
  {
    key: 'lettura',
    title: 'Lettura',
    type: 'reading',
    durationMinutes: 45,
    maxScore: 25,
    instructions: 'Leggi il testo e rispondi.',
    content: {
      passages: [
        {
          id: 'text_1',
          title: 'Un corso serale',
          text: 'Il Comune organizza un corso serale di lingua italiana per studenti stranieri. Le lezioni si tengono ogni martedì e giovedì.'
        }
      ]
    },
    questions: [
      {
        id: 'l1',
        type: 'true_false',
        prompt: 'Il corso si svolge due volte a settimana.',
        options: ['Vero', 'Falso']
      }
    ],
    answerKey: { l1: 'Vero' },
    rubric: {}
  },
  {
    key: 'scritta',
    title: 'Scritta',
    type: 'writing',
    durationMinutes: 45,
    maxScore: 25,
    instructions: 'Scrivi un testo chiaro e organizzato.',
    content: { prompts: ['Scrivi un\'email a un amico per invitarlo a un evento culturale nella tua città.'] },
    questions: [
      {
        id: 's1',
        type: 'essay',
        prompt: 'Email informale di 120-150 parole.',
        options: []
      }
    ],
    answerKey: {},
    rubric: { criteria: certItSections[2].rubric.criteria }
  },
  {
    key: 'orale',
    title: 'Orale',
    type: 'speaking',
    durationMinutes: 20,
    maxScore: 25,
    instructions: 'Registra le tue risposte orali.',
    content: { prompts: ['Parla per due minuti della tua esperienza di apprendimento delle lingue.'] },
    questions: [
      {
        id: 'o1',
        type: 'speaking_prompt',
        prompt: 'Presentazione personale e motivazione allo studio.',
        options: []
      }
    ],
    answerKey: {},
    rubric: { criteria: certItSections[3].rubric.criteria }
  }
];

async function seedAIExams() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/einstein';
  console.log('\n🔄  Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅  Connected.\n');

  console.log('──────────────────────────────────────────');
  console.log('🇮🇹  Italian AI Exam Seed');
  console.log('──────────────────────────────────────────');

  const italian = await upsert(
    StudyLanguage,
    { code: 'it' },
    { name: 'Italien', isActive: true },
    'Italien (it)'
  );

  const admin = await User.findOne({ role: { $in: ['superadmin', 'admin'] } });
  const passwordHash = await bcrypt.hash('password123', 10);
  const student = await upsert(
    User,
    { email: 'italian.student@einstein.com' },
    {
      firstName: 'Lucia',
      lastName: 'Bianchi',
      passwordHash,
      role: 'student',
      status: 'active',
      language: 'fr',
      studyLanguage: italian._id,
      registeredLevel: 'B1'
    },
    'Lucia Bianchi Italian B1 student'
  );

  const blueprint = await upsert(
    ExamBlueprint,
    { title: 'CERT.IT B1 Italian Official Mock Blueprint' },
    {
      studyLanguage: italian._id,
      languageName: 'Italian',
      examFamily: 'CERT.IT',
      level: 'B1',
      description: 'Official-style Italian B1 mock exam structure with listening, reading, writing, and speaking sections.',
      totalDurationMinutes: 140,
      passScore: 60,
      sections: certItSections,
      generationPrompt: 'Generate a realistic CERT.IT B1 mock exam entirely in Italian. Keep rubrics hidden from students.',
      correctionRubric: {
        overall: ['Task completion', 'CEFR B1 control', 'Communicative clarity', 'Accuracy']
      },
      status: 'active',
      createdBy: admin?._id,
      updatedBy: admin?._id
    },
    'CERT.IT B1 blueprint'
  );

  const generatedExam = await upsert(
    GeneratedMockExam,
    { title: 'CERT.IT B1 Mock Exam - May 2026' },
    {
      blueprint: blueprint._id,
      studyLanguage: italian._id,
      examFamily: 'CERT.IT',
      level: 'B1',
      instructions: 'Completa tutte le sezioni rispettando il tempo assegnato. I risultati saranno pubblicati dopo la correzione.',
      sections: generatedSections,
      status: 'approved',
      generatedBy: admin?._id,
      approvedBy: admin?._id,
      approvedAt: new Date(),
      aiPrompt: 'Seeded official-style Italian B1 mock exam.'
    },
    'CERT.IT B1 generated mock exam'
  );

  const now = new Date();
  const startsAt = new Date(now.getTime() + 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 140 * 60 * 1000);

  await upsert(
    AIExamSession,
    { title: 'CERT.IT B1 Official Simulation - Seed Session' },
    {
      generatedExam: generatedExam._id,
      studyLanguage: italian._id,
      examFamily: 'CERT.IT',
      level: 'B1',
      startsAt,
      endsAt,
      status: 'scheduled',
      accessMode: 'language_level',
      eligibleStudents: [student._id],
      allowLateJoin: false,
      strictSectionOrder: true,
      noRetake: true,
      autoSubmitAtClose: true,
      speakingUploadRequired: true,
      antiCheatEnabled: true,
      resultReleaseMode: 'manual',
      createdBy: admin?._id
    },
    'CERT.IT B1 scheduled exam session'
  );

  console.log('\n🎉  seed_ai_exams.js – AI exam seed completed successfully!\n');
  process.exit(0);
}

seedAIExams().catch((err) => {
  console.error('❌  AI exam seed error:', err.message);
  process.exit(1);
});

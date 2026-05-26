/**
 * seed_data.js
 * JS translation of seed_data.sh + seed_data_2.sh + seed_data_3.sh
 *
 * Seeds: StudyLanguage, Institute, Course, LibraryItem, Program,
 *        Research, Event, Activity, Partner, Lead, (Student) User
 *
 * Connects directly to MongoDB – no running server needed.
 * Usage: node seed_data.js   OR   npm run seed:data
 *
 * Idempotent: entries identified by unique keys are only created if absent.
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const dotenv   = require('dotenv');

dotenv.config({ override: true });

const User                  = require('./src/models/User');
const StudyLanguage         = require('./src/isolated/models/StudyLanguage');
const Institute             = require('./src/models/Institute');
const Course                = require('./src/isolated/models/Course');
const LibraryItem           = require('./src/isolated/models/LibraryItem');
const Program               = require('./src/models/Program');
const Research              = require('./src/models/Research');
const Event                 = require('./src/models/Event');
const Activity              = require('./src/models/Activity');
const Partner               = require('./src/models/Partner');
const Lead                  = require('./src/models/Lead');
const Setting               = require('./src/models/Setting');
const Class                 = require('./src/models/Class');
const Department            = require('./src/models/Department');
const InternshipApplication = require('./src/models/InternshipApplication');
const Internship            = require('./src/models/Internship');
const Task                  = require('./src/models/Task');

// ─── Tiny upsert helper (find-or-create) ────────────────────────────────────
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

// ─── Main ────────────────────────────────────────────────────────────────────
async function seedData() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/einstein';
  console.log('\n🔄  Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅  Connected.\n');

  // ── 1. Study Language ────────────────────────────────────────────────────
  console.log('──────────────────────────────────────────');
  console.log('📚  Study Languages');
  console.log('──────────────────────────────────────────');
  const german = await upsert(
    StudyLanguage,
    { code: 'de' },
    { name: 'Allemand', isActive: true },
    'Allemand (de)'
  );
  const french = await upsert(
    StudyLanguage,
    { code: 'fr' },
    { name: 'Français', isActive: true },
    'Français (fr)'
  );
  const english = await upsert(
    StudyLanguage,
    { code: 'en' },
    { name: 'Anglais', isActive: true },
    'Anglais (en)'
  );
  const italian = await upsert(
    StudyLanguage,
    { code: 'it' },
    { name: 'Italien', isActive: true },
    'Italien (it)'
  );

  // ── 1.5 Dynamic Classes ──────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('🏫  Dynamic Classes');
  console.log('──────────────────────────────────────────');
  const seededClasses = [];
  const classesToSeed = [
    { name: 'English Level 1', section: 'English', level: 1 },
    { name: 'English Level 2', section: 'English', level: 2 },
    { name: 'English Level 3', section: 'English', level: 3 },
    { name: 'French Level 1', section: 'French', level: 1 },
    { name: 'French Level 2', section: 'French', level: 2 },
    { name: 'French Level 3', section: 'French', level: 3 }
  ];

  for (const cls of classesToSeed) {
    const doc = await upsert(
      Class,
      { name: cls.name },
      { section: cls.section, level: cls.level, status: 'active' },
      cls.name
    );
    seededClasses.push(doc);
  }

  // ── 1.7 Tech Departments ─────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('💻  Tech Departments');
  console.log('──────────────────────────────────────────');
  const departmentsToSeed = [
    { name: 'Software Engineering', code: 'SE', description: 'Deep-dive into enterprise application architecture and coding standards.' },
    { name: 'Cybersecurity', code: 'CS', description: 'Network protection, ethical hacking, and threat intelligence analysis.' },
    { name: 'AI Development', code: 'AI', description: 'Neural network training, NLP operations, and predictive modeling.' },
    { name: 'IoT Engineering', code: 'IoT', description: 'Firmware design, smart sensors deployment, and microcontrollers code.' },
    { name: 'Graphic Design', code: 'GD', description: 'Corporate UI styling, flyer vector assets, and brand design guidelines.' },
    { name: 'Web & Mobile Development', code: 'WMD', description: 'Responsive web portals, Next.js setups, and iOS/Android applications.' }
  ];

  for (const dept of departmentsToSeed) {
    await upsert(
      Department,
      { name: dept.name },
      { code: dept.code, description: dept.description, isActive: true },
      dept.name
    );
  }

  // ── 2. Student User ──────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('👤  Student User');
  console.log('──────────────────────────────────────────');
  const passwordHash = await bcrypt.hash('password123', 10);
  const student = await upsert(
    User,
    { email: 'student@einstein.com' },
    {
      firstName: 'Jane',
      lastName:  'Doe',
      passwordHash,
      role:    'student',
      status:  'active',
      language: 'fr',
      studyLanguage: german._id,
      class: seededClasses[3]._id, // French Level 1
    },
    'Jane Doe (student@einstein.com)'
  );
  await upsert(
    User,
    { email: 'italian.student@einstein.com' },
    {
      firstName: 'Lucia',
      lastName:  'Bianchi',
      passwordHash,
      role:    'student',
      status:  'active',
      language: 'fr',
      studyLanguage: italian._id,
      registeredLevel: 'level_1',
      class: seededClasses[0]._id, // English Level 1
    },
    'Lucia Bianchi (italian.student@einstein.com)'
  );

  // ── 3. Institute ─────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('🏛️   Institute');
  console.log('──────────────────────────────────────────');
  const institute = await upsert(
    Institute,
    { name: 'Douala Campus' },
    {
      location:    'Douala, Cameroun',
      description: 'Campus principal de l\'Institut Einsteins à Douala.',
      logo:        '/media/logo_douala.png', // placeholder path
    },
    'Douala Campus'
  );

  // ── 4. Courses ───────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('📖  Courses');
  console.log('──────────────────────────────────────────');
  const courses = [
    {
      query:    { title: 'German A1 – Débutants Absolus' },
      defaults: {
        description:   'Découvrez l\'alphabet allemand, les salutations et les expressions quotidiennes.',
        studyLanguage: german._id,
        institute:     institute._id,
        instructor:    student._id,
        level:         'A1',
      },
      label: 'German A1',
    },
    {
      query:    { title: 'German A2 – Élémentaire' },
      defaults: {
        description:   'Consolidez vos bases et apprenez à décrire votre environnement.',
        studyLanguage: german._id,
        institute:     institute._id,
        level:         'A2',
      },
      label: 'German A2',
    },
    {
      query:    { title: 'German B1 – Intermédiaire' },
      defaults: {
        description:   'Gérez des conversations complexes et préparez la certification B1.',
        studyLanguage: german._id,
        institute:     institute._id,
        level:         'B1',
      },
      label: 'German B1',
    },
  ];
  const createdCourses = [];
  for (const c of courses) {
    createdCourses.push(await upsert(Course, c.query, c.defaults, c.label));
  }

  // ── 5. Library Items ─────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('📂  Library Items');
  console.log('──────────────────────────────────────────');
  const libraryItems = [
    {
      query:    { title: 'A1 Vocabulary – Mots Essentiels' },
      defaults: {
        description:   'Liste des 500 mots allemands les plus utilisés pour débutants.',
        type:          'document',
        fileUrl:       '/media/library_a1_vocab.pdf',
        studyLanguage: german._id,
        course:        createdCourses[0]._id,
      },
      label: 'A1 Vocabulary PDF',
    },
    {
      query:    { title: 'A2 Grammar Guide' },
      defaults: {
        description:   'Guide de grammaire couvrant les temps passés et les adjectifs.',
        type:          'document',
        fileUrl:       '/media/library_a2_grammar.pdf',
        studyLanguage: german._id,
        course:        createdCourses[1]._id,
      },
      label: 'A2 Grammar PDF',
    },
    {
      query:    { title: 'B1 Listening Practice – Audio Pack' },
      defaults: {
        description:   'Série de 20 exercices d\'écoute pour le niveau B1.',
        type:          'audio',
        fileUrl:       '/media/library_b1_listening.mp3',
        studyLanguage: german._id,
        course:        createdCourses[2]._id,
      },
      label: 'B1 Audio Pack',
    },
  ];
  for (const item of libraryItems) {
    await upsert(LibraryItem, item.query, item.defaults, item.label);
  }

  // ── 6. Programs ──────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('🎓  Programs');
  console.log('──────────────────────────────────────────');
  const programs = [
    {
      query:    { slug: 'nursing-ausbildung' },
      defaults: {
        title:       'Nursing Ausbildung Germany',
        category:    'preparation',
        level:       'B2',
        duration:    '3 ans',
        price:       0,
        description: 'Formation en soins infirmiers en Allemagne avec accompagnement linguistique B2.',
        objectives:  ['Atteindre le niveau B2', 'Obtenir un visa de formation', 'Intégrer un établissement partenaire'],
        prerequisites: ['Niveau B1 requis', 'Diplôme d\'infirmier'],
        outcomes:    ['Visa Ausbildung', 'Emploi garanti', 'Certificat reconnu'],
        language:    'de',
        isPublished:  true,
      },
      label: 'Nursing Ausbildung',
    },
    {
      query:    { slug: 'german-a1-pathway' },
      defaults: {
        title:       'A1 German Pathway',
        category:    'language',
        level:       'A1',
        duration:    '2 mois',
        price:       0,
        description: 'Programme intensif pour débutants absolus visant le niveau A1 du CECRL.',
        objectives:  ['Lire et écrire l\'alphabet allemand', 'Se présenter en allemand', 'Comprendre les expressions quotidiennes'],
        prerequisites: ['Aucun prérequis'],
        outcomes:    ['Certificat A1 interne'],
        language:    'de',
        isPublished:  true,
      },
      label: 'A1 German Pathway',
    },
    {
      query:    { slug: 'b2-university-prep' },
      defaults: {
        title:       'B2 University Prep',
        category:    'preparation',
        level:       'B2',
        duration:    '4 mois',
        price:       149,
        description: 'Préparation intensive pour l\'examen Goethe B2 et l\'admission universitaire en Allemagne.',
        objectives:  ['Maîtriser l\'écrit académique', 'Réussir l\'examen Goethe B2', 'Préparer le dossier universitaire'],
        prerequisites: ['Niveau B1 certifié'],
        outcomes:    ['Certificat Goethe B2', 'Lettre de recommandation'],
        language:    'de',
        isPublished:  true,
      },
      label: 'B2 University Prep',
    },
    {
      query:    { slug: 'c1-business-german' },
      defaults: {
        title:       'C1 Business German',
        category:    'coaching',
        level:       'C1',
        duration:    '6 mois',
        price:       299,
        description: 'Allemand professionnel pour les secteurs de la finance, de la santé et de l\'ingénierie.',
        objectives:  ['Maîtriser le vocabulaire métier', 'Rédiger des rapports professionnels', 'Préparer les entretiens d\'embauche'],
        prerequisites: ['Niveau B2 certifié'],
        outcomes:    ['Certificat C1', 'Portfolio professionnel'],
        language:    'de',
        isPublished:  true,
      },
      label: 'C1 Business German',
    },
  ];
  for (const p of programs) {
    await upsert(Program, p.query, p.defaults, p.label);
  }

  // ── 7. Research ──────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('🔬  Research');
  console.log('──────────────────────────────────────────');
  const researchItems = [
    {
      query:    { title: 'Language Acquisition Study – Francophone Africa' },
      defaults: {
        description: 'Comment les apprenants francophones d\'Afrique subsaharienne acquièrent l\'allemand deux fois plus vite avec une pédagogie adaptée.',
        documents:   ['/media/research_language_acquisition.pdf'],
        institute:   institute._id,
      },
      label: 'Language Acquisition Study',
    },
    {
      query:    { title: 'Impact de l\'IA sur l\'Apprentissage des Langues' },
      defaults: {
        description: 'Étude sur l\'utilisation des outils d\'intelligence artificielle dans l\'enseignement des langues étrangères.',
        documents:   ['/media/research_ai_language.pdf'],
        institute:   institute._id,
      },
      label: 'AI & Language Learning Research',
    },
  ];
  for (const r of researchItems) {
    await upsert(Research, r.query, r.defaults, r.label);
  }

  // ── 8. Events ────────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('📅  Events');
  console.log('──────────────────────────────────────────');
  const events = [
    {
      query:    { title: 'German Language & Culture Summit 2026' },
      defaults: {
        type:        'conference',
        typeColor:   '#3b82f6',
        date:        new Date('2026-06-14T09:00:00Z'),
        endDate:     new Date('2026-06-15T18:00:00Z'),
        time:        '09:00 – 18:00',
        location:    'Douala, Cameroun',
        capacity:    200,
        description: 'Deux jours de conférences, d\'ateliers et de réseautage pour les enseignants, les étudiants et les passionnés de la langue allemande en Afrique Centrale.',
        badge:       'Early Bird Open',
        badgeColor:  '#10b981',
        status:      'Scheduled',
      },
      label: 'German Language Summit 2026',
    },
    {
      query:    { title: 'Goethe B2 Exam Bootcamp' },
      defaults: {
        type:        'workshop',
        typeColor:   '#f59e0b',
        date:        new Date('2026-05-24T08:00:00Z'),
        time:        '08:00 – 14:00',
        location:    'Online – Zoom',
        capacity:    40,
        description: 'Bootcamp intensif de 6 heures pour préparer l\'examen Goethe B2. Inclut des tests blancs, des révisions d\'experts et des séances de feedback personnalisées.',
        badge:       'Filling Fast',
        badgeColor:  '#f59e0b',
        status:      'Published',
      },
      label: 'Goethe B2 Bootcamp',
    },
    {
      query:    { title: 'Working & Studying in Germany 2026' },
      defaults: {
        type:        'webinar',
        typeColor:   '#10b981',
        date:        new Date('2026-05-30T18:00:00Z'),
        time:        '18:00 – 20:00',
        location:    'Online – Live',
        capacity:    0,
        description: 'Table ronde d\'experts sur les voies de visa, les programmes de bourses, les opportunités d\'Ausbildung et la vie quotidienne en Allemagne.',
        badge:       'Free Entry',
        badgeColor:  '#10b981',
        status:      'Published',
      },
      label: 'Working & Studying in Germany Webinar',
    },
    {
      query:    { title: 'Summer Language Meetup – Yaoundé' },
      defaults: {
        type:        'event',
        typeColor:   '#8b5cf6',
        date:        new Date('2026-07-15T10:00:00Z'),
        time:        '10:00 – 17:00',
        location:    'Main Hall, Yaoundé',
        capacity:    100,
        description: 'Rencontre conviviale pour les apprenants d\'allemand de tous niveaux. Échanges linguistiques, jeux culturels et networking.',
        badge:       'Summer Special',
        badgeColor:  '#8b5cf6',
        status:      'Scheduled',
      },
      label: 'Summer Meetup Yaoundé',
    },
    {
      query:    { title: 'Einstein Language Gala 2025' },
      defaults: {
        type:        'event',
        typeColor:   '#3b82f6',
        date:        new Date('2025-11-20T18:00:00Z'),
        time:        '18:00 – 22:00',
        location:    'Palais des Congrès, Yaoundé',
        capacity:    500,
        attendees:   350,
        description: 'Célébration annuelle de l\'excellence académique à l\'Institut Einsteins. Une soirée mémorable honorant nos diplômés en allemand et nos partenaires internationaux.',
        badge:       'Completed',
        badgeColor:  '#10b981',
        status:      'Past',
        image:       '/media/gallery_1.png',
        speakers: [
          {
            name: 'Dr. Hans Müller',
            role: 'Directeur des Relations Académiques, DAAD',
            image: '/media/testimonial_kevin.jpg',
            message: 'L\'enseignement dispensé à l\'Institut Einsteins prépare nos étudiants de manière exceptionnelle aux défis internationaux. Leur niveau de compétence linguistique ouvre de nombreuses opportunités à l\'échelle mondiale.',
            quote: 'La maîtrise d\'une langue étrangère est la première étape vers un avenir professionnel et personnel mondialisé.',
            extra_info: 'Le Dr. Müller a partagé ses perspectives précieuses sur les programmes de bourses en Allemagne et l\'intégration réussie des étudiants africains dans les universités européennes.',
            highlights: [
              'Présentation des nouvelles opportunités de bourses d\'études DAAD pour 2026.',
              'Cérémonie de remise des diplômes pour plus de 80 lauréats des niveaux B2 et C1.',
              'Signature solennelle de l\'accord de partenariat académique bilatéral.',
              'Table ronde sur l\'insertion professionnelle et les parcours d\'études en Europe.'
            ],
            testimonials: [
              {
                text: 'La conférence du Dr. Müller m\'a donné toutes les clés pour postuler à la bourse d\'études du DAAD. C\'était extrêmement instructif.',
                author: 'Marc Eto\'o',
                role: 'Étudiant en Niveau B2'
              },
              {
                text: 'Un événement grandiose qui témoigne du sérieux, de l\'excellence et du prestige académique de notre institut.',
                author: 'Annette Mbarga',
                role: 'Alumna Promotion 2025'
              }
            ]
          },
          {
            name: 'Prof. Jeanne Dupont',
            role: 'Doyenne de la Faculté des Langues, Université de Yaoundé',
            image: '/media/testimonial_sophie.jpg',
            message: 'L\'approche pédagogique innovante de l\'Institut Einsteins, qui combine une immersion culturelle profonde et des outils interactifs de pointe, est un modèle de référence pour toute la région subsaharienne.',
            quote: 'Les ponts culturels les plus solides et durables se construisent d\'abord avec l\'apprentissage des mots.',
            extra_info: 'Le Professeur Dupont a animé la table ronde principale sur l\'évolution de la pédagogie des langues étrangères à l\'ère de la digitalisation et des technologies interactives.',
            highlights: [
              'Conférence d\'ouverture passionnante sur les défis du plurilinguisme en Afrique.',
              'Atelier pratique sur les techniques d\'apprentissage linguistique ultra-rapides.',
              'Débat interactif et enrichissant avec le corps professoral émérite de l\'institut.',
              'Lancement officiel et visite guidée du nouveau laboratoire de langues numériques.'
            ],
            testimonials: [
              {
                text: 'Les conseils pratiques et méthodologies du Professeur Dupont sur la mémorisation active du vocabulaire m\'ont fait gagner un temps précieux.',
                author: 'Saliou Diallo',
                role: 'Étudiant Niveau A2'
              },
              {
                text: 'C\'était extrêmement inspirant de voir de telles figures académiques majeures soutenir activement notre formation.',
                author: 'Carine Niat',
                role: 'Étudiante Niveau B1'
              }
            ]
          }
        ]
      },
      label: 'Einstein Language Gala 2025',
    },
  ];
  for (const ev of events) {
    await upsert(Event, ev.query, ev.defaults, ev.label);
  }

  // ── 9. Activities ────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('🏃  Activities');
  console.log('──────────────────────────────────────────');
  const activities = [
    {
      query:    { title: 'Speaking Practice – A1/A2' },
      defaults: { category: 'Speaking', duration: '09:00 - 10:30', status: 'Active' },
      label: 'Speaking Practice A1/A2',
    },
    {
      query:    { title: 'Grammar Assessment – B1' },
      defaults: { category: 'Assessment', duration: '10:00 - 11:30', status: 'Scheduled' },
      label: 'Grammar Assessment B1',
    },
    {
      query:    { title: 'Career Workshop – Visa & Ausbildung' },
      defaults: { category: 'Career', duration: '14:00 - 16:00', status: 'Scheduled' },
      label: 'Career Workshop',
    },
  ];
  for (const act of activities) {
    await upsert(Activity, act.query, act.defaults, act.label);
  }

  // ── 10. Partners ─────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('🤝  Partners');
  console.log('──────────────────────────────────────────');
  const partners = [
    {
      query:    { name: 'Goethe-Institut' },
      defaults: {
        country:       'Germany',
        city:          'Berlin',
        type:          'institution',
        website:       'https://www.goethe.de',
        email:         'contact@goethe.de',
        status:        'active',
        studentsPlaced: 0,
        publicVisible:  true,
      },
      label: 'Goethe-Institut',
    },
    {
      query:    { name: 'Telc GmbH' },
      defaults: {
        country:       'Germany',
        city:          'Frankfurt',
        type:          'institution',
        website:       'https://www.telc.net',
        email:         'info@telc.net',
        status:        'active',
        studentsPlaced: 0,
        publicVisible:  true,
      },
      label: 'Telc GmbH',
    },
    {
      query:    { name: 'DAAD – Deutscher Akademischer Austauschdienst' },
      defaults: {
        country:       'Germany',
        city:          'Bonn',
        type:          'ngo',
        website:       'https://www.daad.de',
        email:         'postmaster@daad.de',
        status:        'active',
        studentsPlaced: 0,
        publicVisible:  true,
      },
      label: 'DAAD',
    },
    {
      query:    { name: 'Altenpflege Nürnberg GmbH' },
      defaults: {
        country:       'Germany',
        city:          'Nürnberg',
        type:          'nursing_home',
        website:       'https://altenpflege-nuernberg.de',
        email:         'hr@altenpflege-nuernberg.de',
        status:        'active',
        studentsPlaced: 12,
        publicVisible:  true,
      },
      label: 'Altenpflege Nürnberg (Nursing Partner)',
    },
  ];
  for (const p of partners) {
    await upsert(Partner, p.query, p.defaults, p.label);
  }

  // ── 11. Leads ────────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('📋  Leads (CRM)');
  console.log('──────────────────────────────────────────');
  const leads = [
    {
      query:    { email: 'lead1@example.com' },
      defaults: {
        fullName: 'Amadou Diallo',
        phone:    '+221 77 000 0001',
        interest: 'German A1 course',
        source:   'website',
        status:   'new',
        notes:    [{ content: 'Interested in A1 start date for June 2026.' }],
      },
      label: 'Amadou Diallo',
    },
    {
      query:    { email: 'lead2@example.com' },
      defaults: {
        fullName: 'Fatima Ouedraogo',
        phone:    '+226 70 000 0002',
        interest: 'Nursing Ausbildung',
        source:   'referral',
        status:   'contacted',
        notes:    [{ content: 'Already has B1 certificate. Wants info on Ausbildung visa process.' }],
      },
      label: 'Fatima Ouedraogo',
    },
    {
      query:    { email: 'lead3@example.com' },
      defaults: {
        fullName: 'Pierre Kouassi',
        phone:    '+225 07 000 0003',
        interest: 'B2 University Prep',
        source:   'instagram',
        status:   'new',
        notes:    [{ content: 'Saw Instagram ad. Looking for B2 preparation course.' }],
      },
      label: 'Pierre Kouassi',
    },
  ];
  for (const l of leads) {
    await upsert(Lead, l.query, l.defaults, l.label);
  }

  // ── 12. Settings ─────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('⚙️   Settings');
  console.log('──────────────────────────────────────────');
  await upsert(
    Setting,
    { key: 'registrationFee' },
    { value: 5000 },
    'Registration Fee Setting (5000)'
  );
  await upsert(
    Setting,
    { key: 'requireOnlineRegistrationFee' },
    { value: true },
    'Require Online Registration Fee Toggle (true)'
  );

  // ── 13. Trainees, Supervisor, Applications, Internships & Tasks ────────────
  console.log('\n──────────────────────────────────────────');
  console.log('🎓  InterLink: Trainees, Applications, Internships & Tasks');
  console.log('──────────────────────────────────────────');

  // -- Supervisor (reuse or create) --
  const supervisor = await upsert(
    User,
    { email: 'teacher@einstein.com' },
    {
      firstName: 'Agbor',
      lastName: 'Anderson',
      passwordHash,
      role: 'supervisor',
      status: 'active',
      department: 'Software Engineering',
    },
    'Agbor Anderson (supervisor)'
  );

  // -- 5 Trainee Students --
  const traineeDefs = [
    { email: 'alice.kamdem@interlink.com',  firstName: 'Alice',   lastName: 'Kamdem',  department: 'Software Engineering',       studyMode: 'on_site'  },
    { email: 'marc.nguene@interlink.com',   firstName: 'Marc',    lastName: 'Nguene',  department: 'Cybersecurity',               studyMode: 'online'   },
    { email: 'sophie.mbida@interlink.com',  firstName: 'Sophie',  lastName: 'Mbida',   department: 'AI Development',              studyMode: 'online'   },
    { email: 'paul.etonde@interlink.com',   firstName: 'Paul',    lastName: 'Etonde',  department: 'Web & Mobile Development',    studyMode: 'on_site'  },
    { email: 'grace.elong@interlink.com',   firstName: 'Grace',   lastName: 'Elong',   department: 'Graphic Design',              studyMode: 'online'   },
  ];

  const trainees = [];
  for (const td of traineeDefs) {
    const t = await upsert(
      User,
      { email: td.email },
      {
        firstName: td.firstName,
        lastName:  td.lastName,
        passwordHash,
        role:       'student',
        status:     'active',
        department: td.department,
      },
      `${td.firstName} ${td.lastName} (trainee)`
    );
    trainees.push({ user: t, studyMode: td.studyMode, department: td.department });
  }

  // -- InternshipApplications --
  // First 2 → pending  (appear in Admin "Pending Applications" panel)
  // Last 3  → approved (appear in Manager "Certificate Pipeline" sign-off panel)
  const appStatuses = ['pending', 'pending', 'approved', 'approved', 'approved'];
  const paymentStatuses = ['pending', 'paid', 'paid', 'paid', 'paid'];

  const seededApps = [];
  for (let i = 0; i < trainees.length; i++) {
    const { user, studyMode, department } = trainees[i];
    let app = await InternshipApplication.findOne({ user: user._id });
    if (!app) {
      app = await InternshipApplication.create({
        user:          user._id,
        department,
        studyMode,
        paymentOption: 'pay_now',
        paymentStatus: paymentStatuses[i],
        transactionId: `dp_tx_seed_${i + 1}`,
        status:        appStatuses[i],
        coverLetter:   'I am passionate about technology and eager to contribute to real projects.',
      });
      console.log(`   ✅  Created InternshipApplication for ${user.firstName} ${user.lastName} (${appStatuses[i]})`);
    } else {
      console.log(`   ⏭  Application already exists for ${user.firstName} ${user.lastName}`);
    }
    seededApps.push(app);
  }

  // -- Active Internships for approved trainees --
  const internshipMetrics = [
    { progress: 72, tasksCompleted: 18, totalTasks: 25, attendanceRate: 98, supervisorRating: 4.8 },
    { progress: 45, tasksCompleted: 9,  totalTasks: 20, attendanceRate: 95, supervisorRating: 4.2 },
    { progress: 88, tasksCompleted: 22, totalTasks: 25, attendanceRate: 100, supervisorRating: 4.9 },
  ];

  const seededInternships = [];
  for (let i = 2; i < trainees.length; i++) {
    const { user, department } = trainees[i];
    const metrics = internshipMetrics[i - 2];
    let internship = await Internship.findOne({ student: user._id });
    if (!internship) {
      internship = await Internship.create({
        student:         user._id,
        supervisor:      supervisor._id,
        department,
        startDate:       new Date('2026-01-15'),
        endDate:         new Date('2026-07-15'),
        status:          'active',
        progress:        metrics.progress,
        tasksCompleted:  metrics.tasksCompleted,
        totalTasks:      metrics.totalTasks,
        attendanceRate:  metrics.attendanceRate,
        supervisorRating: metrics.supervisorRating,
      });
      console.log(`   ✅  Created Internship for ${user.firstName} ${user.lastName} (${metrics.progress}% progress)`);
    } else {
      console.log(`   ⏭  Internship already exists for ${user.firstName} ${user.lastName}`);
    }
    seededInternships.push({ internship, user });
  }

  // -- Demo Tasks for the main student (sophie.mbida = trainees[2]) --
  const mainTrainee = trainees[2].user; // Sophie Mbida
  const taskDefs = [
    {
      title: 'Build a REST API for user authentication',
      description: 'Design and implement JWT-based authentication endpoints: register, login, refresh token, and logout. Use Express.js and MongoDB.',
      status: 'completed', priority: 'high',
      score: 92, feedback: 'Excellent implementation. Token refresh logic is clean and secure.',
      deadline: new Date('2026-03-01'),
    },
    {
      title: 'Implement AI-powered recommendation engine',
      description: 'Integrate a basic collaborative filtering model to recommend courses based on user activity history.',
      status: 'in_progress', priority: 'high',
      deadline: new Date('2026-06-15'),
    },
    {
      title: 'Design database schema for multi-tenant SaaS',
      description: 'Model a scalable Mongoose schema supporting tenant isolation, shared collections, and row-level security patterns.',
      status: 'submitted', priority: 'medium',
      submissionNotes: 'Implemented using discriminators and tenant middleware. Repo link attached.',
      submissionUrl: 'https://github.com/sophie-mbida/saas-schema-demo',
      deadline: new Date('2026-05-30'),
    },
    {
      title: 'Write unit tests for the payments module',
      description: 'Achieve 80%+ code coverage on the DigiPay payment controller using Jest and Supertest.',
      status: 'pending', priority: 'medium',
      deadline: new Date('2026-07-01'),
    },
    {
      title: 'Deploy containerized Node.js app to VPS',
      description: 'Dockerize the InterLink backend API and deploy it to a Linux VPS using Docker Compose with Nginx reverse proxy and SSL.',
      status: 'rejected', priority: 'high',
      feedback: 'Dockerfile missing multi-stage build. Environment variables were hardcoded. Please revise and resubmit.',
      deadline: new Date('2026-04-20'),
    },
  ];

  for (const td of taskDefs) {
    const exists = await Task.findOne({ title: td.title, intern: mainTrainee._id });
    if (!exists) {
      await Task.create({
        title:           td.title,
        description:     td.description,
        intern:          mainTrainee._id,
        supervisor:      supervisor._id,
        department:      'AI Development',
        priority:        td.priority,
        status:          td.status,
        deadline:        td.deadline,
        score:           td.score,
        feedback:        td.feedback,
        submissionNotes: td.submissionNotes,
        submissionUrl:   td.submissionUrl,
      });
      console.log(`   ✅  Created Task: "${td.title}" [${td.status}]`);
    } else {
      console.log(`   ⏭  Task already exists: "${td.title}"`);
    }
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════');
  console.log('🎉  seed_data.js – All data seeded successfully!');
  console.log('════════════════════════════════════════════\n');
  process.exit(0);
}

seedData().catch((err) => {
  console.error('❌  Seed error:', err.message);
  process.exit(1);
});

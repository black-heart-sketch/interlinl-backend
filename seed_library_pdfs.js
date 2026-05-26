/**
 * seed_library_pdfs.js
 * Clears all library items and downloads real open-license PDFs for testing.
 * Usage: node seed_library_pdfs.js
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
require('dotenv').config();

const LibraryItem = require('./src/models/LibraryItem');
const StudyLanguage = require('./src/models/StudyLanguage');
const User = require('./src/models/User');

const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/einstein';
const LIBRARY_DIR = path.join(__dirname, 'assets/library');

// Real open-license PDF links from common sources
const PDF_RESOURCES = [
  {
    title: 'Introduction à la Linguistique',
    description: 'Cours fondamental couvrant la phonologie, la morphologie et la syntaxe.',
    type: 'course',
    url: 'https://www.orimi.com/pdf-test.pdf',
    filename: 'intro-linguistique.pdf',
    isPrivate: false,
  },
  {
    title: 'Guide de Grammaire Avancée',
    description: 'Manuel de référence sur les structures grammaticales complexes.',
    type: 'document',
    url: 'https://www.orimi.com/pdf-test.pdf',
    filename: 'guide-grammaire-avancee.pdf',
    isPrivate: false,
  },
  {
    title: 'Examen Blanc — Module 1 [CONFIDENTIEL]',
    description: 'Document sécurisé d\'examen blanc. Réservé aux étudiants inscrits.',
    type: 'document',
    url: 'https://www.orimi.com/pdf-test.pdf',
    filename: 'examen-blanc-module1.pdf',
    isPrivate: true,
  },
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // Follow redirect
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${response.statusCode} for ${url}`));
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    });

    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });

    request.setTimeout(15000, () => {
      request.abort();
      reject(new Error('Request timed out'));
    });
  });
}

async function run() {
  await mongoose.connect(DB_URI);
  console.log('✅ Connected to DB');

  // 1. Clear all existing library items from DB
  await LibraryItem.deleteMany({});
  console.log('🗑️  Cleared all existing LibraryItems from DB');

  // 2. Clear existing library files
  if (fs.existsSync(LIBRARY_DIR)) {
    const files = fs.readdirSync(LIBRARY_DIR);
    files.forEach(f => {
      try { fs.unlinkSync(path.join(LIBRARY_DIR, f)); } catch {}
    });
    console.log(`🗑️  Cleared ${files.length} files from ${LIBRARY_DIR}`);
  } else {
    fs.mkdirSync(LIBRARY_DIR, { recursive: true });
    console.log(`📁 Created directory: ${LIBRARY_DIR}`);
  }

  // 3. Get first study language and admin
  const studyLanguage = await StudyLanguage.findOne();
  const admin = await User.findOne({ role: { $in: ['admin', 'superadmin'] } });

  if (!studyLanguage) {
    console.error('❌ No StudyLanguage found. Please seed study languages first.');
    process.exit(1);
  }

  // 4. Download and seed each PDF
  for (const resource of PDF_RESOURCES) {
    const destPath = path.join(LIBRARY_DIR, resource.filename);
    console.log(`⬇️  Downloading: ${resource.title} ...`);
    
    try {
      await downloadFile(resource.url, destPath);
      console.log(`   ✅ Saved to ${destPath}`);

      await LibraryItem.create({
        title: resource.title,
        description: resource.description,
        type: resource.type,
        fileUrl: `/library/${resource.filename}`,
        studyLanguage: studyLanguage._id,
        isPrivate: resource.isPrivate,
        uploadedBy: admin?._id || null,
      });
      console.log(`   📚 Created DB record: ${resource.title}`);
    } catch (err) {
      console.error(`   ❌ Failed for ${resource.title}: ${err.message}`);
    }
  }

  console.log('\n✅ Library seeded successfully!');
  console.log('   Public docs: 2 | Private (secured) docs: 1');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

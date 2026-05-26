/**
 * seed_testimonials.js
 * Seeds the database with 4 verified student testimonials.
 *
 * Photos are downloaded with curl (follows redirects, -L) into
 *   assets/images/media/
 * and stored in MongoDB as the local route /media/<filename>
 * so they are served via the backend's /media static route.
 *
 * Idempotent: existing files are never re-downloaded; existing
 * testimonials are wiped and re-created on each run.
 */

const mongoose    = require('mongoose');
const { spawnSync } = require('child_process');
const fs          = require('fs');
const path        = require('path');
const dotenv      = require('dotenv');

dotenv.config({ override: true });

const Testimonial = require('./src/models/Testimonial');

const MEDIA_DIR = path.join(__dirname, 'assets/images/media');

// ─────────────────────────────────────────────
// Testimonial data – mirrors defaultTestimonials
// in TestimonialsSection.jsx
// ─────────────────────────────────────────────
const TESTIMONIALS = [
  {
    studentName:       'Amina Traoré',
    program:           'A2 German Pathway',
    story:             'Institut Einsteins a changé ma vie. En 6 mois je suis passée de zéro en allemand à réussir l\'examen A2. Les exercices interactifs étaient fascinants et les tuteurs se souciaient vraiment de mes progrès.',
    rating:            5,
    verified:          true,
    published:         true,
    city:              'Cotonou',
    destinationCountry:'Benin',
    year:              '2024',
    photoUrl:          'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80&auto=format&fit=crop',
    photoFilename:     'testimonial_amina.jpg',
  },
  {
    studentName:       'Kevin Mbarga',
    program:           'B1 Intensive German',
    story:             'Les sessions de tutorat en direct sont incomparables. Mon tuteur m\'a aidé à comprendre le Konjunktiv II en une seule session — quelque chose avec lequel je me débattais depuis des mois sur d\'autres plateformes.',
    rating:            5,
    verified:          true,
    published:         true,
    city:              'Yaoundé',
    destinationCountry:'Cameroon',
    year:              '2024',
    photoUrl:          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80&auto=format&fit=crop',
    photoFilename:     'testimonial_kevin.jpg',
  },
  {
    studentName:       'Sophie Durand',
    program:           'C1 Business German',
    story:             'J\'ai obtenu mon certificat C1 et décroché un emploi dans une ONG allemande à Francfort. Le module Allemand des affaires était exactement ce dont j\'avais besoin. Je le recommande vivement à chaque apprenant ambitieux.',
    rating:            5,
    verified:          true,
    published:         true,
    city:              'Dakar',
    destinationCountry:'Senegal',
    year:              '2023',
    photoUrl:          'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80&auto=format&fit=crop',
    photoFilename:     'testimonial_sophie.jpg',
  },
  {
    studentName:       'Ibrahim Al-Rashid',
    program:           'B2 University Prep',
    story:             'L\'interface bilingue (Français/Anglais) a rendu l\'expérience fluide. Aucune barrière de traduction — je me suis concentré à 100 % sur l\'apprentissage de l\'allemand. Une décision de conception brillante.',
    rating:            5,
    verified:          true,
    published:         true,
    city:              'Abidjan',
    destinationCountry:"Côte d'Ivoire",
    year:              '2024',
    photoUrl:          'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80&auto=format&fit=crop',
    photoFilename:     'testimonial_ibrahim.jpg',
  },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁  Created directory: ${dirPath}`);
  }
}

/**
 * Download a file using curl.
 * -L  : follow redirects (Unsplash uses redirects)
 * -f  : fail on HTTP error (4xx/5xx)
 * -s  : silent (no progress bar)
 * -o  : output path
 * Returns true on success, false on failure.
 */
function curlDownload(url, destPath) {
  if (fs.existsSync(destPath)) {
    console.log(`   ⏭   Already exists, skipping: ${path.basename(destPath)}`);
    return true;
  }

  console.log(`   ⬇️   curl → ${path.basename(destPath)}`);
  const result = spawnSync(
    'curl',
    ['-L', '-f', '-s', '--retry', '3', '--retry-delay', '2', '-o', destPath, url],
    { stdio: 'inherit' }
  );

  if (result.status !== 0) {
    console.warn(`   ⚠️   curl exited with status ${result.status} for ${url}`);
    // Remove partial file if created
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
    }
    return false;
  }

  // Sanity check: file should exist and be > 0 bytes
  if (!fs.existsSync(destPath) || fs.statSync(destPath).size === 0) {
    console.warn(`   ⚠️   Downloaded file is empty or missing: ${destPath}`);
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    return false;
  }

  console.log(`   ✅   Saved (${(fs.statSync(destPath).size / 1024).toFixed(1)} KB) → ${destPath}`);
  return true;
}

// ─────────────────────────────────────────────
// Main seed function
// ─────────────────────────────────────────────

async function seedTestimonials() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/einstein';

  console.log('\n🔄  Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅  Connected to MongoDB.\n');

  // Ensure media folder exists
  ensureDir(MEDIA_DIR);

  // Idempotent: wipe existing testimonials before re-seeding
  const existingCount = await Testimonial.countDocuments();
  if (existingCount > 0) {
    console.log(`ℹ️   Found ${existingCount} existing testimonial(s). Clearing before re-seed...\n`);
    await Testimonial.deleteMany({});
  }

  for (const data of TESTIMONIALS) {
    console.log(`──────────────────────────────────────────`);
    console.log(`💬  ${data.studentName}`);
    console.log(`──────────────────────────────────────────`);

    const destPath   = path.join(MEDIA_DIR, data.photoFilename);
    // Local route served by the backend static /media handler
    const localRoute = `/media/${data.photoFilename}`;

    // 1. Download photo via curl (skip if already present)
    const downloaded = curlDownload(data.photoUrl, destPath);

    // 2. Insert testimonial — always use local /media/ path in DB
    const testimonialData = {
      studentName:        data.studentName,
      program:            data.program,
      story:              data.story,
      verified:           data.verified,
      published:          data.published,
      city:               data.city,
      destinationCountry: data.destinationCountry,
      year:               data.year,
      // Store local path regardless; if download failed the file just won't
      // exist yet (admin can re-upload later from the dashboard)
      photo: downloaded ? localRoute : '',
    };

    const doc = await Testimonial.create(testimonialData);
    console.log(`   📝  Inserted testimonial id: ${doc._id}`);
    console.log(`   🖼️   photo field: ${testimonialData.photo || '(none — download failed)'}\n`);
  }

  console.log('════════════════════════════════════════════');
  console.log('🎉  Testimonials seeded successfully!');
  console.log('════════════════════════════════════════════\n');
  process.exit(0);
}

seedTestimonials().catch((err) => {
  console.error('❌  Seed error:', err.message);
  process.exit(1);
});

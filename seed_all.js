/**
 * seed_all.js
 * Master seed runner – executes all direct-DB seed scripts in order.
 *
 * Usage:  npm run seed
 *
 * Each seed script is run as an isolated child process so that each
 * one can call process.exit() without stopping the chain.
 *
 * NOTE: The shell scripts (seed_data.sh / seed_data_2.sh / seed_data_3.sh)
 *       are CURL-based API seeders that require the server to be running first.
 *       They are NOT included here — run them manually when the server is up:
 *         bash seed_data.sh
 */

const { spawnSync } = require('child_process');
const path = require('path');

// ── Order matters: admin first, then data seeds ──────────────────────────────
const SEEDS = [
  { file: 'seed_admin.js',        label: '👤  Admin user' },
  { file: 'seed_data.js',         label: '🗄️   Core data (languages, courses, programs, events, partners, leads…)' },
  { file: 'seed_ai_exams.js',     label: '🇮🇹  AI exam sessions (Italian CERT.IT B1)' },
  { file: 'seed_gallery.js',      label: '🖼️   Gallery images' },
  { file: 'seed_quizzes.js',      label: '📝  Quizzes' },
  { file: 'seed_testimonials.js', label: '💬  Testimonials (+ photo downloads)' },
];

// ── Formatting helpers ────────────────────────────────────────────────────────
const LINE   = '═'.repeat(62);
const DIVIDER = '─'.repeat(62);

console.log(`\n╔${LINE}╗`);
console.log(`║  🌱  Institute Einsteins – Master Seed Runner              ║`);
console.log(`╚${LINE}╝\n`);

const results = [];

for (const seed of SEEDS) {
  const scriptPath = path.join(__dirname, seed.file);

  console.log(DIVIDER);
  console.log(`▶  ${seed.label}`);
  console.log(`   Script: ${seed.file}`);
  console.log(DIVIDER);

  const result = spawnSync('node', [scriptPath], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  const passed = result.status === 0;
  results.push({ label: seed.label, file: seed.file, passed });

  if (passed) {
    console.log(`\n✅  ${seed.file} completed.\n`);
  } else {
    console.error(`\n❌  ${seed.file} exited with status ${result.status}.\n`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(LINE);
console.log('  📋  Seed Summary');
console.log(LINE);
for (const r of results) {
  const icon = r.passed ? '✅' : '❌';
  console.log(`  ${icon}  ${r.label.padEnd(48)} ${r.file}`);
}
console.log(LINE);

const allPassed = results.every(r => r.passed);
if (allPassed) {
  console.log('\n🎉  All seed scripts completed successfully!\n');
  console.log('   ℹ️   For API-based seeding (requires server running):');
  console.log('        bash seed_data.sh\n');
} else {
  console.log('\n⚠️   One or more seed scripts encountered errors. See above.\n');
  process.exit(1);
}

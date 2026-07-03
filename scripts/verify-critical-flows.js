const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const checks = [
  {
    name: 'Registration requires referral code',
    file: 'src/controllers/authController.js',
    pattern: /Referral code is required/
  },
  {
    name: 'Registration payment auto-approves application',
    file: 'src/controllers/authController.js',
    pattern: /app\.status !== 'approved'/
  },
  {
    name: 'Manual validation grants platform access override',
    file: 'src/controllers/userController.js',
    pattern: /platformAccessOverride = true/
  },
  {
    name: 'Student internship payment summary route exists',
    file: 'src/routes/paymentRoutes.js',
    pattern: /\/internship\/me/
  },
  {
    name: 'Student internship installment route exists',
    file: 'src/routes/paymentRoutes.js',
    pattern: /\/internship\/installment/
  },
  {
    name: 'Bulk task assignment is supported',
    file: 'src/controllers/taskController.js',
    pattern: /assignmentScope === 'all'/
  },
  {
    name: 'Task deletion route uses DELETE',
    file: 'src/routes/taskRoutes.js',
    pattern: /router\.delete\('\/:id'/
  },
  {
    name: 'Report review route exists',
    file: 'src/routes/reportRoutes.js',
    pattern: /\/:id\/review/
  }
];

const failures = [];

for (const check of checks) {
  const content = read(check.file);
  if (!check.pattern.test(content)) {
    failures.push(`${check.name} (${check.file})`);
  }
}

if (failures.length) {
  console.error('Critical flow verification failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Critical flow verification passed (${checks.length} checks).`);

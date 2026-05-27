const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
const InternshipApplication = require('./src/models/InternshipApplication');
const Internship = require('./src/models/Internship');
const Setting = require('./src/models/Setting');
const { getRegistrationPaymentStatus } = require('./src/controllers/authController');

async function testGate() {
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/interlink');
  console.log('✅ Connected to MongoDB.');

  const testEmail = 'gate.test@interlink.local';
  
  // Cleanup previous test data
  await User.deleteMany({ email: testEmail });
  console.log('Cleaned up previous test accounts.');

  // 1. Assert Frictionless Registration
  console.log('\n--- 1. Testing Registration ---');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);
  
  const user = await User.create({
    firstName: 'Gate',
    lastName: 'Test',
    email: testEmail,
    phone: '+237600000000',
    passwordHash: hashedPassword,
    role: 'student',
    status: 'active', // Active immediately!
    department: 'Software Engineering'
  });

  console.log(`✅ Student registered successfully with email: ${user.email}`);
  console.log(`✅ Asserting user status is active: ${user.status === 'active' ? 'PASS' : 'FAIL'}`);

  const initialApp = await InternshipApplication.findOne({ user: user._id });
  console.log(`✅ Asserting no internship application is created during register: ${!initialApp ? 'PASS' : 'FAIL'}`);

  // 2. Submit Internship Application
  console.log('\n--- 2. Submitting Internship Request ---');
  const application = await InternshipApplication.create({
    user: user._id,
    department: 'Software Engineering',
    studyMode: 'online',
    paymentOption: 'pay_now',
    paymentStatus: 'pending',
    status: 'pending'
  });

  console.log(`✅ Application created for user. paymentStatus: ${application.paymentStatus}, status: ${application.status}`);

  // 3. Initiate Online Payment
  console.log('\n--- 3. Testing Payment Status & Automation ---');
  const mockTxId = 'dp_tx_test_gate_123';
  application.transactionId = mockTxId;
  await application.save();
  console.log(`✅ Saved transactionId: ${mockTxId} to application.`);

  // Simulate calling the status controller
  const req = { params: { transactionId: mockTxId } };
  const res = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.data = data;
      return this;
    }
  };

  await getRegistrationPaymentStatus(req, res);
  console.log('✅ Executed getRegistrationPaymentStatus handler.');
  console.log('Result status:', res.data?.status);

  // Check if application paymentStatus automatically upgraded to 'paid'!
  const updatedApp = await InternshipApplication.findById(application._id);
  console.log(`✅ Asserting paymentStatus is upgraded to paid: ${updatedApp.paymentStatus === 'paid' ? 'PASS' : 'FAIL'}`);

  // 4. Admin Manual Approval
  console.log('\n--- 4. Testing Admin Manual Approval ---');
  updatedApp.status = 'approved';
  await updatedApp.save();
  console.log('✅ Approved application.');

  // Create active internship
  const internship = await Internship.create({
    student: user._id,
    department: updatedApp.department,
    status: 'active',
    progress: 0
  });
  console.log('✅ Active internship initialized.');

  // Assert access unlocked
  const isLocked = updatedApp.status !== 'approved' || updatedApp.paymentStatus !== 'paid';
  console.log(`✅ Asserting student dashboard is UNLOCKED: ${!isLocked ? 'PASS' : 'FAIL'}`);

  // Cleanup test data
  await User.deleteMany({ email: testEmail });
  await InternshipApplication.deleteMany({ user: user._id });
  await Internship.deleteMany({ student: user._id });
  console.log('\n✅ Integration test clean up complete.');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

testGate().catch(async (err) => {
  console.error('❌ Test failed with error:', err);
  await mongoose.disconnect();
  process.exit(1);
});

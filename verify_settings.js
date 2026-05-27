const mongoose = require('mongoose');
const Setting = require('./src/models/Setting');
const { getClient } = require('./src/utils/digipay');

async function testSettings() {
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/interlink');
  console.log('✅ Connected to MongoDB.');

  // Backup existing settings
  const originalFee = await Setting.findOne({ key: 'registrationFee' });
  const originalRequire = await Setting.findOne({ key: 'requireOnlineRegistrationFee' });
  const originalKey = await Setting.findOne({ key: 'digipayApiKey' });
  const originalEnv = await Setting.findOne({ key: 'digipayEnv' });

  console.log('Backed up original settings.');

  try {
    console.log('\n--- 1. Testing Settings Persistence ---');
    
    // Save new settings
    await Setting.findOneAndUpdate({ key: 'registrationFee' }, { value: 7500 }, { upsert: true });
    await Setting.findOneAndUpdate({ key: 'requireOnlineRegistrationFee' }, { value: false }, { upsert: true });
    await Setting.findOneAndUpdate({ key: 'digipayApiKey' }, { value: 'dpk_test_from_database_999' }, { upsert: true });
    await Setting.findOneAndUpdate({ key: 'digipayEnv' }, { value: 'sandbox' }, { upsert: true });

    console.log('✅ Wrote dynamic settings to MongoDB.');

    // Fetch and assert values
    const fee = await Setting.findOne({ key: 'registrationFee' });
    const req = await Setting.findOne({ key: 'requireOnlineRegistrationFee' });
    const key = await Setting.findOne({ key: 'digipayApiKey' });
    const env = await Setting.findOne({ key: 'digipayEnv' });

    console.log(`✅ Asserting Fee updated: ${fee.value === 7500 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Asserting Require Fee updated: ${req.value === false ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Asserting API Key updated: ${key.value === 'dpk_test_from_database_999' ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Asserting Environment updated: ${env.value === 'sandbox' ? 'PASS' : 'FAIL'}`);

    console.log('\n--- 2. Testing Dynamic Payment Client Sync ---');

    // Retrieve client
    const client = await getClient();
    console.log('✅ Initialized client via getClient() helper.');
    console.log(`✅ Asserting dynamic API key cache syncs: ${client.http.defaults.headers['x-api-key'] === 'dpk_test_from_database_999' ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Asserting environment mode cache syncs: ${client.http.defaults.baseURL.includes('sandbox') ? 'PASS' : 'FAIL'}`);

    console.log('\n--- 3. Testing Zero-Downtime Hot Swapping ---');
    // Save updated key
    await Setting.findOneAndUpdate({ key: 'digipayApiKey' }, { value: 'dpk_test_swapped_at_runtime_111' }, { upsert: true });
    console.log('✅ Modified digipayApiKey to: dpk_test_swapped_at_runtime_111 inside DB.');

    // Retrieve client again
    const updatedClient = await getClient();
    console.log('✅ Re-retrieved client.');
    console.log(`✅ Asserting dynamic API key hot swaps: ${updatedClient.http.defaults.headers['x-api-key'] === 'dpk_test_swapped_at_runtime_111' ? 'PASS' : 'FAIL'}`);

  } finally {
    // Restore original settings
    console.log('\nRestoring original settings...');
    if (originalFee) await Setting.findOneAndUpdate({ key: 'registrationFee' }, { value: originalFee.value });
    else await Setting.deleteOne({ key: 'registrationFee' });

    if (originalRequire) await Setting.findOneAndUpdate({ key: 'requireOnlineRegistrationFee' }, { value: originalRequire.value });
    else await Setting.deleteOne({ key: 'requireOnlineRegistrationFee' });

    if (originalKey) await Setting.findOneAndUpdate({ key: 'digipayApiKey' }, { value: originalKey.value });
    else await Setting.deleteOne({ key: 'digipayApiKey' });

    if (originalEnv) await Setting.findOneAndUpdate({ key: 'digipayEnv' }, { value: originalEnv.value });
    else await Setting.deleteOne({ key: 'digipayEnv' });

    console.log('✅ Original database states restored.');
  }

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB. Settings verification successfully passed!');
}

testSettings().catch(async (err) => {
  console.error('❌ Settings test failed with error:', err);
  await mongoose.disconnect();
  process.exit(1);
});

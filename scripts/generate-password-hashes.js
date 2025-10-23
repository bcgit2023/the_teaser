const bcrypt = require('bcrypt');

async function generateHashes() {
  const saltRounds = 10;
  
  const adminHash = await bcrypt.hash('admin', saltRounds);
  const userHash = await bcrypt.hash('user', saltRounds);
  
  console.log('Admin password hash:', adminHash);
  console.log('User password hash:', userHash);
  
  // Test the hashes
  const adminTest = await bcrypt.compare('admin', adminHash);
  const userTest = await bcrypt.compare('user', userHash);
  
  console.log('Admin hash test:', adminTest ? 'PASS' : 'FAIL');
  console.log('User hash test:', userTest ? 'PASS' : 'FAIL');
}

generateHashes().catch(console.error);
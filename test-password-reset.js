const database = require('./src/config/database');

async function testPasswordReset() {
  try {
    console.log('🧪 Testing password reset functionality...\n');

    // Test 1: Load current admin config
    console.log('1️⃣ Loading current admin config...');
    const config = await database.loadAdminConfig();
    console.log('✅ Current admin username:', config.defaultAdmin.username);
    console.log('✅ Current admin email:', config.defaultAdmin.email);
    console.log('');

    // Test 2: Update admin password
    console.log('2️⃣ Testing password update...');
    const testPassword = 'newtestpass123';
    config.defaultAdmin.password = testPassword;
    
    const saveResult = await database.saveAdminConfig(config);
    console.log('✅ Save result:', saveResult);
    console.log('');

    // Test 3: Verify password was updated
    console.log('3️⃣ Verifying password update...');
    const updatedConfig = await database.loadAdminConfig();
    console.log('✅ Updated password matches:', updatedConfig.defaultAdmin.password === testPassword);
    console.log('');

    // Test 4: Check if admin user exists in users table
    console.log('4️⃣ Checking admin user in users table...');
    const adminUser = await database.getUserByUsername(config.defaultAdmin.username);
    if (adminUser) {
      console.log('✅ Admin user found in users table');
      console.log('✅ User ID:', adminUser.id);
      console.log('✅ User role:', adminUser.role);
      console.log('✅ Has password hash:', !!adminUser.password_hash);
    } else {
      console.log('❌ Admin user not found in users table');
    }
    console.log('');

    console.log('🎉 Password reset test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testPasswordReset().then(() => {
    console.log('\n✅ Test completed.');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = testPasswordReset; 
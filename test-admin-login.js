const database = require('./src/config/database');

async function testAdminLogin() {
  try {
    console.log('🧪 Testing admin login functionality...\n');

    // Test 1: Load admin config
    console.log('1️⃣ Loading admin config...');
    const config = await database.loadAdminConfig();
    console.log('✅ Admin username:', config.defaultAdmin.username);
    console.log('✅ Admin email:', config.defaultAdmin.email);
    console.log('✅ Admin password (masked):', config.defaultAdmin.password);
    console.log('');

    // Test 2: Check if admin user exists in users table
    console.log('2️⃣ Checking admin user in users table...');
    const adminUser = await database.getUserByUsername(config.defaultAdmin.username);
    if (adminUser) {
      console.log('✅ Admin user found in users table');
      console.log('✅ User ID:', adminUser.id);
      console.log('✅ User role:', adminUser.role);
      console.log('✅ Has password hash:', !!adminUser.password_hash);
      console.log('✅ Password hash length:', adminUser.password_hash?.length || 0);
    } else {
      console.log('❌ Admin user not found in users table');
    }
    console.log('');

    // Test 3: Test password verification
    if (adminUser) {
      console.log('3️⃣ Testing password verification...');
      const testPassword = 'osman223.'; // Yeni şifre
      const oldPassword = 'admin123'; // Eski şifre
      
      const newPasswordValid = await database.verifyPassword(testPassword, adminUser.password_hash);
      const oldPasswordValid = await database.verifyPassword(oldPassword, adminUser.password_hash);
      
      console.log('✅ New password valid:', newPasswordValid);
      console.log('✅ Old password valid:', oldPasswordValid);
    }
    console.log('');

    // Test 4: List all users
    console.log('4️⃣ Listing all users...');
    const allUsers = await database.getAllUsers();
    console.log(`✅ Found ${allUsers.length} users:`);
    allUsers.forEach(user => {
      console.log(`   • ${user.username} (${user.role}) - ID: ${user.id}`);
    });
    console.log('');

    // Test 5: Get users by role
    console.log('5️⃣ Testing role-based user queries...');
    const adminUsers = await database.getAdminUsers();
    const superAdminUsers = await database.getSuperAdminUsers();
    const regularUsers = await database.getUsersByRole('user');
    
    console.log(`✅ Admin users: ${adminUsers.length}`);
    console.log(`✅ Super admin users: ${superAdminUsers.length}`);
    console.log(`✅ Regular users: ${regularUsers.length}`);
    console.log('');

    // Test 6: Get user counts
    console.log('6️⃣ Testing user counts...');
    const totalUsers = await database.getUserCount();
    const adminCount = await database.getUserCountByRole('admin');
    const superAdminCount = await database.getUserCountByRole('superadmin');
    const userCount = await database.getUserCountByRole('user');
    
    console.log(`✅ Total users: ${totalUsers}`);
    console.log(`✅ Admin count: ${adminCount}`);
    console.log(`✅ Super admin count: ${superAdminCount}`);
    console.log(`✅ Regular user count: ${userCount}`);
    console.log('');

    // Test 7: Get admin settings
    console.log('7️⃣ Testing admin settings...');
    const adminSettings = await database.getAllAdminSettings();
    console.log(`✅ Found ${adminSettings.length} admin settings:`);
    adminSettings.forEach(setting => {
      console.log(`   • ${setting.setting_key}: ${setting.setting_value} (${setting.setting_type})`);
    });
    console.log('');

    // Test 8: Get system config
    console.log('8️⃣ Testing system config...');
    const systemConfig = await database.getAllSystemConfig();
    console.log(`✅ Found ${systemConfig.length} system configs:`);
    systemConfig.forEach(config => {
      console.log(`   • ${config.config_key}: ${config.config_value} (${config.config_type})`);
    });

    console.log('\n🎉 Admin login test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testAdminLogin().then(() => {
    console.log('\n✅ Test completed.');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = testAdminLogin; 
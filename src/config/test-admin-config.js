const database = require('./database');

async function testAdminConfig() {
  try {
    console.log('🧪 Testing admin config database operations...\n');

    // Test 1: Load admin config
    console.log('1️⃣ Loading admin config from database...');
    const config = await database.loadAdminConfig();
    console.log('✅ Config loaded successfully');
    console.log('📋 Default Admin:', config.defaultAdmin.username, config.defaultAdmin.email);
    console.log('⚙️ Admin Settings:', config.adminSettings);
    console.log('🔧 System Settings:', config.systemSettings);
    console.log('');

    // Test 2: Save admin config
    console.log('2️⃣ Saving admin config to database...');
    const testConfig = {
      defaultAdmin: {
        username: 'testadmin',
        email: 'test@example.com',
        password: 'testpass123',
        role: 'admin'
      },
      adminSettings: {
        allowMultipleAdmins: false,
        forcePasswordChange: true,
        sessionTimeout: 3600000,
        maxLoginAttempts: 3
      },
      systemSettings: {
        maxUsers: 50,
        systemName: 'Test Smart Home Dashboard',
        enableRegistration: false,
        defaultUserRole: 'guest'
      }
    };

    const saveResult = await database.saveAdminConfig(testConfig);
    console.log('✅ Config saved successfully:', saveResult);
    console.log('');

    // Test 3: Load again to verify
    console.log('3️⃣ Loading config again to verify...');
    const reloadedConfig = await database.loadAdminConfig();
    console.log('✅ Config reloaded successfully');
    console.log('📋 Default Admin:', reloadedConfig.defaultAdmin.username, reloadedConfig.defaultAdmin.email);
    console.log('⚙️ Admin Settings:', reloadedConfig.adminSettings);
    console.log('🔧 System Settings:', reloadedConfig.systemSettings);
    console.log('');

    // Test 4: Check individual settings
    console.log('4️⃣ Testing individual admin settings...');
    const maxUsers = await database.getAdminSetting('max_users');
    const systemName = await database.getAdminSetting('system_name');
    const allowMultipleAdmins = await database.getAdminSetting('allow_multiple_admins');
    
    console.log('👥 Max Users:', maxUsers?.setting_value);
    console.log('🏷️ System Name:', systemName?.setting_value);
    console.log('👨‍👩‍👧‍👦 Allow Multiple Admins:', allowMultipleAdmins?.setting_value);
    console.log('');

    // Test 5: Get all admin settings
    console.log('5️⃣ Getting all admin settings...');
    const allSettings = await database.getAllAdminSettings();
    console.log(`✅ Found ${allSettings.length} admin settings:`);
    allSettings.forEach(setting => {
      console.log(`   • ${setting.setting_key}: ${setting.setting_value} (${setting.setting_type})`);
    });

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testAdminConfig().then(() => {
    console.log('\n✅ Test completed.');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = testAdminConfig; 
const database = require('./database');
const fs = require('fs');
const path = require('path');

async function migrateToDatabase() {
  try {
    console.log('🔄 Starting migration to database...\n');

    // Step 1: Initialize default admin settings
    console.log('1️⃣ Initializing default admin settings...');
    await database.setAdminSetting('default_admin_username', 'superadmin', 'string', 'Default admin username');
    await database.setAdminSetting('default_admin_email', 'superadmin@localhost', 'string', 'Default admin email');
    await database.setAdminSetting('allow_multiple_admins', 'true', 'boolean', 'Allow multiple admin users');
    await database.setAdminSetting('force_password_change', 'false', 'boolean', 'Force password change on first login');
    await database.setAdminSetting('session_timeout', '86400000', 'number', 'Session timeout in milliseconds');
    await database.setAdminSetting('max_login_attempts', '5', 'number', 'Maximum login attempts before lockout');
    console.log('✅ Admin settings initialized');

    // Step 2: Initialize system config
    console.log('2️⃣ Initializing system config...');
    await database.setSystemConfig('max_users', '100', 'number', 'Maximum number of users allowed');
    await database.setSystemConfig('system_name', 'Smart Home Dashboard', 'string', 'System display name');
    await database.setSystemConfig('enable_registration', 'true', 'boolean', 'Allow new user registration');
    await database.setSystemConfig('default_user_role', 'user', 'string', 'Default role for new users');
    await database.setSystemConfig('global_sensor_timeout', '60', 'number', 'Global timeout for sensor offline detection');
    console.log('✅ System config initialized');

    // Step 3: Check if admin user exists, if not create it
    console.log('3️⃣ Checking admin user...');
    const adminConfig = await database.loadAdminConfig();
    const existingAdmin = await database.getUserByUsername(adminConfig.defaultAdmin.username);
    
    if (!existingAdmin) {
      console.log('Creating default admin user...');
      await database.createUser(adminConfig.defaultAdmin.username, adminConfig.defaultAdmin.email, 'admin123');
      await database.makeUserAdmin(adminConfig.defaultAdmin.username);
      console.log('✅ Default admin user created');
    } else {
      console.log('✅ Admin user already exists');
    }

    // Step 4: Check for existing admin.json file and migrate if exists
    const adminJsonPath = path.join(__dirname, '..', '..', 'admin.json');
    if (fs.existsSync(adminJsonPath)) {
      console.log('4️⃣ Found existing admin.json, migrating data...');
      try {
        const adminData = JSON.parse(fs.readFileSync(adminJsonPath, 'utf8'));
        
        // Migrate admin settings
        if (adminData.defaultAdmin) {
          await database.setAdminSetting('default_admin_username', adminData.defaultAdmin.username || 'superadmin', 'string', 'Default admin username');
          await database.setAdminSetting('default_admin_email', adminData.defaultAdmin.email || 'superadmin@localhost', 'string', 'Default admin email');
        }
        
        if (adminData.adminSettings) {
          await database.setAdminSetting('allow_multiple_admins', adminData.adminSettings.allowMultipleAdmins?.toString() || 'true', 'boolean', 'Allow multiple admin users');
          await database.setAdminSetting('force_password_change', adminData.adminSettings.forcePasswordChange?.toString() || 'false', 'boolean', 'Force password change on first login');
          await database.setAdminSetting('session_timeout', adminData.adminSettings.sessionTimeout?.toString() || '86400000', 'number', 'Session timeout in milliseconds');
          await database.setAdminSetting('max_login_attempts', adminData.adminSettings.maxLoginAttempts?.toString() || '5', 'number', 'Maximum login attempts before lockout');
        }
        
        if (adminData.systemSettings) {
          await database.setSystemConfig('max_users', adminData.systemSettings.maxUsers?.toString() || '100', 'number', 'Maximum number of users allowed');
          await database.setSystemConfig('system_name', adminData.systemSettings.systemName || 'Smart Home Dashboard', 'string', 'System display name');
          await database.setSystemConfig('enable_registration', adminData.systemSettings.enableRegistration?.toString() || 'true', 'boolean', 'Allow new user registration');
          await database.setSystemConfig('default_user_role', adminData.systemSettings.defaultUserRole || 'user', 'string', 'Default role for new users');
        }
        
        // Backup the original file
        const backupPath = adminJsonPath + '.backup.' + Date.now();
        fs.copyFileSync(adminJsonPath, backupPath);
        console.log(`✅ Admin.json backed up to: ${backupPath}`);
        console.log('✅ Admin.json data migrated to database');
        
      } catch (error) {
        console.log('⚠️ Error migrating admin.json:', error.message);
      }
    } else {
      console.log('4️⃣ No admin.json file found, skipping migration');
    }

    // Step 5: Verify migration
    console.log('5️⃣ Verifying migration...');
    const finalConfig = await database.loadAdminConfig();
    const adminSettings = await database.getAllAdminSettings();
    const systemConfig = await database.getAllSystemConfig();
    const adminUser = await database.getUserByUsername(finalConfig.defaultAdmin.username);
    
    console.log(`✅ Admin settings: ${adminSettings.length} items`);
    console.log(`✅ System config: ${systemConfig.length} items`);
    console.log(`✅ Admin user exists: ${!!adminUser}`);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   • All admin settings now stored in database');
    console.log('   • All system config now stored in database');
    console.log('   • Admin user created/verified in users table');
    console.log('   • Original admin.json backed up (if existed)');
    
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateToDatabase().then((success) => {
    if (success) {
      console.log('\n✅ Migration completed successfully.');
      process.exit(0);
    } else {
      console.log('\n❌ Migration failed.');
      process.exit(1);
    }
  }).catch((error) => {
    console.error('❌ Migration error:', error);
    process.exit(1);
  });
}

module.exports = migrateToDatabase; 
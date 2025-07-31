const path = require('path');
const fs = require('fs');
const database = require('./database');

async function migrateAdminConfig() {
  try {
    console.log('Starting admin config migration...');
    
    // Check if admin.json exists
    const configPath = path.join(__dirname, 'admin.json');
    if (!fs.existsSync(configPath)) {
      console.log('No admin.json file found. Using default config.');
      return;
    }

    // Load existing config from JSON file
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    console.log('Found existing admin config, migrating to database...');

    // Save to database
    const success = await database.saveAdminConfig(config);
    
    if (success) {
      console.log('✅ Admin config successfully migrated to database!');
      
      // Backup the old file
      const backupPath = path.join(__dirname, 'admin.json.backup');
      fs.copyFileSync(configPath, backupPath);
      console.log(`📁 Original config backed up to: ${backupPath}`);
      
      // Optionally remove the old file
      // fs.unlinkSync(configPath);
      // console.log('🗑️ Original admin.json file removed');
      
    } else {
      console.log('❌ Failed to migrate admin config to database');
    }
    
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateAdminConfig().then(() => {
    console.log('Migration completed.');
    process.exit(0);
  }).catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = migrateAdminConfig; 
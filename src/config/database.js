const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

class Database {
  constructor() {
    this.db = null;
    this.init();
  }

  init() {
    const dbPath = path.join(__dirname, '../../database.sqlite');
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        // Error opening database
      } else {
        this.createTables();
      }
    });
  }

  createTables() {
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createUserSettingsTable = `
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        setting_key TEXT NOT NULL,
        setting_value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, setting_key)
      )
    `;

    const createDashboardConfigTable = `
      CREATE TABLE IF NOT EXISTS dashboard_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        config_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;

    const createAdminSettingsTable = `
      CREATE TABLE IF NOT EXISTS admin_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT,
        setting_type TEXT DEFAULT 'string',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createMqttConfigTable = `
      CREATE TABLE IF NOT EXISTS mqtt_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_name TEXT UNIQUE NOT NULL,
        broker_address TEXT NOT NULL,
        port INTEGER NOT NULL,
        use_tls BOOLEAN DEFAULT 0,
        username TEXT,
        password_hash TEXT,
        is_active BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    this.db.run(createUsersTable);
    this.db.run(createUserSettingsTable);
    this.db.run(createDashboardConfigTable);
    this.db.run(createAdminSettingsTable);
    this.db.run(createMqttConfigTable);

    // Add role column to existing users table if it doesn't exist
    this.db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`, (err) => {
      // Ignore error if column already exists
    });

    // Create initial admin user if no admin exists
    this.createInitialAdmin();
  }

  // Load admin config from local file
  loadAdminConfig() {
    try {
      const configPath = path.join(__dirname, 'admin.json');
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      // Error loading admin config, use defaults
    }
    
    // Return default config if file doesn't exist or can't be read
    return {
      defaultAdmin: {
        username: 'superadmin',
        email: 'superadmin@localhost',
        password: 'admin123',
        role: 'admin'
      },
      adminSettings: {
        allowMultipleAdmins: true,
        forcePasswordChange: false,
        sessionTimeout: 86400000,
        maxLoginAttempts: 5
      },
      systemSettings: {
        maxUsers: 100,
        systemName: 'Smart Home Dashboard',
        enableRegistration: true,
        defaultUserRole: 'user'
      }
    };
  }

  // Save admin config to local file
  saveAdminConfig(config) {
    try {
      const configPath = path.join(__dirname, 'admin.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      return false;
    }
  }

  // Create initial admin user if none exists
  async createInitialAdmin() {
    try {
      const adminConfig = this.loadAdminConfig();
      const defaultAdmin = adminConfig.defaultAdmin;
      
      // First, check if superadmin user already exists
      const existingUser = await this.getUserByUsername(defaultAdmin.username);
      
      if (existingUser) {
        // User exists, make sure they have admin role
        if (existingUser.role !== 'admin') {
          this.db.run('UPDATE users SET role = ? WHERE username = ?', ['admin', defaultAdmin.username]);
        }
      } else {
        // Check if any admin user exists
        const sql = 'SELECT id FROM users WHERE role = ? LIMIT 1';
        this.db.get(sql, ['admin'], async (err, row) => {
          if (err) {
            // Error checking for admin
            return;
          }

          if (!row) {
            // No admin user exists, create default one from config
            try {
              await this.createUser(defaultAdmin.username, defaultAdmin.email, defaultAdmin.password);
              // Update the created user to admin role
              this.db.run('UPDATE users SET role = ? WHERE username = ?', ['admin', defaultAdmin.username], (updateErr) => {
                if (!updateErr) {
                  // Add default admin settings from config
                  const systemSettings = adminConfig.systemSettings;
                  this.setAdminSetting('global_sensor_timeout', '60', 'number', 'Global timeout for sensor offline detection (1-3600 seconds)');
                  this.setAdminSetting('max_users', systemSettings.maxUsers.toString(), 'number', 'Maximum number of users allowed');
                  this.setAdminSetting('system_name', systemSettings.systemName, 'string', 'System display name');
                  this.setAdminSetting('enable_registration', systemSettings.enableRegistration.toString(), 'boolean', 'Allow new user registration');
                  this.setAdminSetting('default_user_role', systemSettings.defaultUserRole, 'string', 'Default role for new users');
                }
              });
            } catch (error) {
              // Error creating admin user
            }
          }
        });
      }
    } catch (error) {
      // Error in initial admin creation
    }
  }

  // User management methods
  async createUser(username, email, password) {
    return new Promise((resolve, reject) => {
      const saltRounds = 10;
      bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) {
          reject(err);
          return;
        }

        const sql = 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)';
        this.db.run(sql, [username, email, hash], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, username, email });
          }
        });
      });
    });
  }

  async getUserByUsername(username) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM users WHERE username = ?';
      this.db.get(sql, [username], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getUserByEmail(email) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM users WHERE email = ?';
      this.db.get(sql, [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async verifyPassword(password, hash) {
    return new Promise((resolve, reject) => {
      bcrypt.compare(password, hash, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  // Dashboard configuration methods
  async saveDashboardConfig(userId, configData) {
    return new Promise((resolve, reject) => {
      // First check if config exists for this user
      const checkSql = 'SELECT id FROM dashboard_config WHERE user_id = ?';
      this.db.get(checkSql, [userId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          // Update existing config
          const updateSql = `
            UPDATE dashboard_config 
            SET config_data = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
          `;
          this.db.run(updateSql, [JSON.stringify(configData), userId], function(updateErr) {
            if (updateErr) {
              reject(updateErr);
            } else {
              resolve({ id: row.id, updated: true });
            }
          });
        } else {
          // Insert new config
          const insertSql = `
            INSERT INTO dashboard_config (user_id, config_data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
          `;
          this.db.run(insertSql, [userId, JSON.stringify(configData)], function(insertErr) {
            if (insertErr) {
              reject(insertErr);
            } else {
              resolve({ id: this.lastID, created: true });
            }
          });
        }
      });
    });
  }

  async getDashboardConfig(userId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT config_data FROM dashboard_config WHERE user_id = ?';
      this.db.get(sql, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? JSON.parse(row.config_data) : null);
        }
      });
    });
  }

  // User settings methods
  async saveUserSetting(userId, key, value) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO user_settings (user_id, setting_key, setting_value, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `;
      this.db.run(sql, [userId, key, value], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });
  }

  async getUserSetting(userId, key) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?';
      this.db.get(sql, [userId, key], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.setting_value : null);
        }
      });
    });
  }

  async getAllUserSettings(userId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT setting_key, setting_value FROM user_settings WHERE user_id = ?';
      this.db.all(sql, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const settings = {};
          rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
          });
          resolve(settings);
        }
      });
    });
  }

  // Admin user management methods
  async getAllUsers() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT id, username, email, role, created_at, updated_at FROM users ORDER BY created_at DESC';
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async updateUserRole(userId, role) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      this.db.run(sql, [role, userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: userId, changes: this.changes });
        }
      });
    });
  }

  async deleteUser(userId) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM users WHERE id = ?';
      this.db.run(sql, [userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ deleted: this.changes > 0 });
        }
      });
    });
  }

  // Admin settings methods
  async getAdminSetting(key) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM admin_settings WHERE setting_key = ?';
      this.db.get(sql, [key], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async setAdminSetting(key, value, type = 'string', description = '') {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO admin_settings (setting_key, setting_value, setting_type, description, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      this.db.run(sql, [key, value, type, description], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });
  }

  async getAllAdminSettings() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM admin_settings ORDER BY setting_key';
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Helper function to manually make a user admin (for troubleshooting)
  async makeUserAdmin(username) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?';
      this.db.run(sql, ['admin', username], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ username, changes: this.changes, isAdmin: this.changes > 0 });
        }
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          // Error closing database
        } else {
          // Database connection closed
        }
      });
    }
  }
}

module.exports = new Database(); 
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

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

    this.db.run(createUsersTable);
    this.db.run(createUserSettingsTable);
    this.db.run(createDashboardConfigTable);
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
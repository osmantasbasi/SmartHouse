const express = require('express');
const router = express.Router();
const database = require('../config/database');

// Admin middleware
const requireAdmin = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const user = await database.getUserByUsername(req.session.username);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await database.getAllUsers();
    res.json({ users, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user role
router.put('/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    await database.updateUserRole(userId, role);
    res.json({ message: 'User role updated', success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Prevent admin from deleting themselves
    if (userId == req.session.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await database.deleteUser(userId);
    if (result.deleted) {
      res.json({ message: 'User deleted successfully', success: true });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get admin settings
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await database.getAllAdminSettings();
    res.json({ settings, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update admin setting
router.post('/settings', requireAdmin, async (req, res) => {
  try {
    const { key, value, type, description } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'Setting key is required' });
    }

    await database.setAdminSetting(key, value, type, description);
    res.json({ message: 'Admin setting updated', success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get system stats
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const users = await database.getAllUsers();
    const settings = await database.getAllAdminSettings();
    
    const stats = {
      totalUsers: users.length,
      adminUsers: users.filter(u => u.role === 'admin').length,
      totalSettings: settings.length,
      timestamp: new Date().toISOString()
    };
    
    res.json({ stats, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get admin config
router.get('/config', requireAdmin, async (req, res) => {
  try {
    const config = database.loadAdminConfig();
    // Don't send password in response for security
    const safeConfig = {
      ...config,
      defaultAdmin: {
        ...config.defaultAdmin,
        password: '••••••••'
      }
    };
    res.json({ config: safeConfig, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update admin config
router.post('/config', requireAdmin, async (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({ error: 'Config data is required' });
    }

    // Validate required fields
    if (!config.defaultAdmin || !config.defaultAdmin.username || !config.defaultAdmin.email) {
      return res.status(400).json({ error: 'Invalid admin configuration' });
    }

    // If password is not changed (shows dots), load current password
    if (config.defaultAdmin.password === '••••••••') {
      const currentConfig = database.loadAdminConfig();
      config.defaultAdmin.password = currentConfig.defaultAdmin.password;
    }

    const success = database.saveAdminConfig(config);
    
    if (success) {
      res.json({ message: 'Admin configuration updated successfully', success: true });
    } else {
      res.status(500).json({ error: 'Failed to save configuration' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset admin password
router.post('/reset-password', requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const config = database.loadAdminConfig();
    config.defaultAdmin.password = newPassword;
    
    const success = database.saveAdminConfig(config);
    
    if (success) {
      res.json({ message: 'Admin password updated successfully', success: true });
    } else {
      res.status(500).json({ error: 'Failed to update password' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 
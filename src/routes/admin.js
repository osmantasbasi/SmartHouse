const express = require('express');
const router = express.Router();
const database = require('../config/database');

// Admin middleware
const requireAdmin = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Use userId to get user from database
    const user = await database.getUserById(req.session.userId);
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
    
    // Get device counts and MAC addresses for each user
    const usersWithDeviceCounts = await Promise.all(users.map(async (user) => {
      let deviceCount = 0;
      let macAddress = '';
      
      if (user.role === 'admin') {
        // Admin users see all devices - get total device count from dashboard config
        const dashboardConfig = await database.getDashboardConfig(user.id);
        if (dashboardConfig && dashboardConfig.devices) {
          deviceCount = Object.keys(dashboardConfig.devices).length;
        }
      } else {
        // Regular users - get their MAC address and count matching devices
        const userMacId = await database.getUserSetting(user.id, 'mac_address', '');
        macAddress = userMacId || '';
        
        if (userMacId && userMacId.trim() !== '') {
          const userMacIdClean = userMacId.replace(/:/g, '').toLowerCase();
          
          // Get this user's own dashboard config to find their devices
          const userConfig = await database.getDashboardConfig(user.id);
          if (userConfig && userConfig.devices) {
            const userDevices = Object.values(userConfig.devices).filter(device => {
              if (!device || !device.topic) return false;
              
              const topicParts = device.topic.split('/');
              if (topicParts.length >= 1) {
                const topicUserMac = topicParts[0].toLowerCase();
                return topicUserMac === userMacIdClean;
              }
              return false;
            });
            
            deviceCount = userDevices.length;
          }
        }
      }
      
      return {
        ...user,
        deviceCount,
        macAddress
      };
    }));
    
    res.json({ users: usersWithDeviceCounts, success: true });
  } catch (error) {
    console.error('Error loading users with device counts:', error);
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
    const systemConfig = await database.getAllSystemConfig();
    
    const stats = {
      totalUsers: users.length,
      adminUsers: users.filter(u => u.role === 'admin').length,
      superAdminUsers: users.filter(u => u.role === 'superadmin').length,
      totalSettings: settings.length,
      totalSystemConfig: systemConfig.length,
      timestamp: new Date().toISOString()
    };
    
    res.json({ stats, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get users by role
router.get('/users/role/:role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.params;
    const users = await database.getUsersByRole(role);
    res.json({ users, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get admin users
router.get('/users/admin', requireAdmin, async (req, res) => {
  try {
    const adminUsers = await database.getAdminUsers();
    res.json({ users: adminUsers, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get super admin users
router.get('/users/superadmin', requireAdmin, async (req, res) => {
  try {
    const superAdminUsers = await database.getSuperAdminUsers();
    res.json({ users: superAdminUsers, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user by username
router.put('/users/username/:username', requireAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    const updates = req.body;
    
    // Prevent updating own account
    const currentUser = await database.getUserById(req.session.userId);
    if (currentUser && currentUser.username === username) {
      return res.status(400).json({ error: 'Cannot update your own account' });
    }

    const result = await database.updateUser(username, updates);
    if (result.updated) {
      res.json({ message: 'User updated successfully', success: true });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user by username
router.delete('/users/username/:username', requireAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    
    // Prevent deleting own account
    const currentUser = await database.getUserById(req.session.userId);
    if (currentUser && currentUser.username === username) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await database.deleteUserByUsername(username);
    if (result.deleted) {
      res.json({ message: 'User deleted successfully', success: true });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get system config
router.get('/system-config', requireAdmin, async (req, res) => {
  try {
    const systemConfig = await database.getAllSystemConfig();
    res.json({ config: systemConfig, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update system config
router.post('/system-config', requireAdmin, async (req, res) => {
  try {
    const { key, value, type, description } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'Config key is required' });
    }

    await database.setSystemConfig(key, value, type, description);
    res.json({ message: 'System config updated', success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get admin config
router.get('/config', requireAdmin, async (req, res) => {
  try {
    const config = await database.loadAdminConfig();
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
      const currentConfig = await database.loadAdminConfig();
      config.defaultAdmin.password = currentConfig.defaultAdmin.password;
    }

    const success = await database.saveAdminConfig(config);
    
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
    
    console.log('Reset password request received:', { newPassword: newPassword ? '***' : 'empty' });
    
    if (!newPassword || newPassword.length < 6) {
      console.log('Password validation failed: too short or empty');
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    console.log('Loading admin config...');
    const config = await database.loadAdminConfig();
    console.log('Admin config loaded, updating password...');
    
    config.defaultAdmin.password = newPassword;
    
    console.log('Saving admin config...');
    const success = await database.saveAdminConfig(config);
    
    if (success) {
      console.log('Admin password updated successfully');
      res.json({ message: 'Admin password updated successfully', success: true });
    } else {
      console.log('Failed to update admin password');
      res.status(500).json({ error: 'Failed to update password' });
    }
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 
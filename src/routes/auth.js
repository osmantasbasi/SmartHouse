const express = require('express');
const router = express.Router();
const database = require('../config/database');

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await database.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const existingEmail = await database.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Create new user
    const user = await database.createUser(username, email, password);
    
    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;

    res.status(201).json({
      message: 'User created successfully',
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Get user from database
    const user = await database.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await database.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({
      message: 'Login successful',
      user: { id: user.id, username: user.username, email: user.email, role: user.role || 'user' }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.json({ message: 'Logout successful' });
  });
});

// Check authentication status
router.get('/me', async (req, res) => {
  if (req.session.userId) {
    try {
      // Get full user data including role from database
      const user = await database.getUserByUsername(req.session.username);
      if (user) {
    res.json({
      authenticated: true,
      user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role || 'user'
      }
    });
      } else {
        res.json({ authenticated: false });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.json({ authenticated: false });
  }
});

// Dashboard config endpoints
router.get('/dashboard-config', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get dashboard config from dashboard_config table only
    const dashboardConfig = await database.getDashboardConfig(req.session.userId);
    
    res.json({ config: dashboardConfig || {} });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/dashboard-config', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { config } = req.body;
    
    // Save complete config to dashboard_config table (including layouts)
    const result = await database.saveDashboardConfig(req.session.userId, config);
    
    res.json({ message: 'Dashboard configuration saved', success: true, result });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Debug endpoint to check what's in the database
router.get('/debug-config', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const dashboardConfig = await database.getDashboardConfig(req.session.userId);
    
    res.json({ 
      userId: req.session.userId,
      config: dashboardConfig,
      hasConfig: !!dashboardConfig,
      configKeys: dashboardConfig ? Object.keys(dashboardConfig) : [],
      layoutCount: dashboardConfig && dashboardConfig.deviceLayouts ? dashboardConfig.deviceLayouts.length : 0,
      layoutItems: dashboardConfig && dashboardConfig.deviceLayouts ? dashboardConfig.deviceLayouts : []
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Change password endpoint
router.post('/change-password', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All password fields are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }

    // Get current user
    const user = await database.getUserById(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await database.verifyPassword(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Update password
    const result = await database.updateUser(user.username, { password: newPassword });
    
    if (result.updated) {
      res.json({ message: 'Password changed successfully', success: true });
    } else {
      res.status(500).json({ error: 'Failed to update password' });
    }
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User settings endpoints
router.get('/user-settings', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const settings = await database.getAllUserSettings(req.session.userId);
    res.json({ settings, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

router.post('/user-settings', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { key, value } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'Setting key is required' });
    }

    await database.saveUserSetting(req.session.userId, key, value);
    res.json({ message: 'User setting saved', success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

router.get('/user-settings/:key', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { key } = req.params;
    const value = await database.getUserSetting(req.session.userId, key);
    res.json({ key, value, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Temporary endpoint to fix superadmin role (for troubleshooting)
router.post('/fix-superadmin', async (req, res) => {
  try {
    const result = await database.makeUserAdmin('superadmin');
    res.json({ 
      message: result.isAdmin ? 'Superadmin role updated successfully' : 'User not found',
      result: result
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router; 
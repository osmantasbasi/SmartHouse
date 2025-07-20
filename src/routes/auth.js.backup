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
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.json({ message: 'Logout successful' });
  });
});

// Check authentication status
router.get('/me', (req, res) => {
  if (req.session.userId) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username
      }
    });
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

    // Get dashboard layout from user_settings table
    const layoutString = await database.getUserSetting(req.session.userId, 'dashboard_layout');
    let config = {};
    
    if (layoutString) {
      try {
        const layoutData = JSON.parse(layoutString);
        // Convert to expected format
        config = {
          deviceLayouts: layoutData.layouts || [],
          lastUpdated: layoutData.lastUpdated,
          version: layoutData.version
        };
      } catch (error) {
        // Removed console.error for production
      }
    }
    
    // Get other dashboard config from dashboard_config table
    const dashboardConfig = await database.getDashboardConfig(req.session.userId);
    if (dashboardConfig) {
      config = { ...dashboardConfig, ...config };
    }
    
    res.json({ config: config || {} });
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
    
    // Save layout to user_settings table if it exists
    if (config.deviceLayouts) {
      const layoutData = {
        layouts: config.deviceLayouts,
        lastUpdated: new Date().toISOString(),
        version: '1.0'
      };
      await database.saveUserSetting(req.session.userId, 'dashboard_layout', JSON.stringify(layoutData));
    }
    
    // Save other config to dashboard_config table
    await database.saveDashboardConfig(req.session.userId, config);
    
    res.json({ message: 'Dashboard configuration saved', success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router; 
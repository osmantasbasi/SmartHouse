import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashboardConfig, setDashboardConfig] = useState({});
  const [userSettings, setUserSettings] = useState({});

  // Check if user is authenticated on app load
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          setUser(data.user);
          await loadDashboardConfig();
          await loadUserSettings();
        }
      }
    } catch (error) {
      // Removed console.error for production
    } finally {
      setLoading(false);
    }
  };

  const login = async (userData) => {
    setUser(userData);
    await loadDashboardConfig();
    await loadUserSettings();
  };

  const logout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        setUser(null);
        setDashboardConfig({});
        setUserSettings({});
      }
    } catch (error) {
      // Removed console.error for production
    }
  };

  const loadDashboardConfig = async () => {
    try {
      const response = await fetch('/api/auth/dashboard-config', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardConfig(data.config || {});
      }
    } catch (error) {
      // Removed console.error for production
    }
  };

  const loadUserSettings = async () => {
    try {
      const response = await fetch('/api/auth/user-settings', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserSettings(data.settings || {});
      }
    } catch (error) {
      // Removed console.error for production
    }
  };

  const saveUserSetting = async (key, value) => {
    try {
      const response = await fetch('/api/auth/user-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ key, value }),
      });
      
      if (response.ok) {
        setUserSettings(prev => ({ ...prev, [key]: value }));
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const getUserSetting = (key, defaultValue = null) => {
    return userSettings[key] || defaultValue;
  };

  const saveDashboardConfig = async (config) => {
    try {
      const response = await fetch('/api/auth/dashboard-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ config }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardConfig(config);
        return true;
      } else {
        const errorData = await response.text();
        return false;
      }
    } catch (error) {
      return false;
    }
  };

  const refreshDashboardConfig = async () => {
    await loadDashboardConfig();
  };

  const value = {
    user,
    loading,
    dashboardConfig,
    userSettings,
    login,
    logout,
    saveDashboardConfig,
    refreshDashboardConfig,
    saveUserSetting,
    getUserSetting,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 
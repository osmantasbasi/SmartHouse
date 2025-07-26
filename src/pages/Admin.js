import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMqtt } from '../contexts/MqttContext';
import { useDevices } from '../contexts/DeviceContext';
import Icon from '../components/ui/Icon';

const Admin = () => {
  const { user, getUserSetting } = useAuth();
  const { connectionStatus, connectToMqtt, disconnectFromMqtt } = useMqtt();
  const { devices, refreshSensorTimeout } = useDevices();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [adminSettings, setAdminSettings] = useState([]);
  const [adminConfig, setAdminConfig] = useState(null);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // MQTT Connection states
  const [connectionSettings, setConnectionSettings] = useState({
    brokerAddress: '',
    port: 8883,
    username: '',
    password: '',
    useTLS: true,
    cleanSession: true,
    useAwsCerts: false
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sensorTimeout, setSensorTimeout] = useState('60');

  // Calculate device count for each user
  const getUserDeviceCount = (userData) => {
    // Use deviceCount from backend API response
    return userData.deviceCount || 0;
  };

  // Calculate online device count for each user using current devices state
  const getUserOnlineDeviceCount = (userData) => {
    if (userData.role === 'admin') {
      // Admin users see all devices
      return Object.values(devices).filter(device => device.isOnline).length;
    } else {
      // Regular users - get their MAC address and count matching online devices
      const userMacId = getUserSetting('mac_address', '');
      if (!userMacId || userMacId.trim() === '') {
        return 0;
      }
      
      const userMacIdClean = userMacId.replace(/:/g, '').toLowerCase();
      return Object.values(devices).filter(device => {
        if (!device || !device.topic || !device.isOnline) return false;
        
        const topicParts = device.topic.split('/');
        if (topicParts.length >= 1) {
          const topicUserMac = topicParts[0].toLowerCase();
          return topicUserMac === userMacIdClean;
        }
        return false;
      }).length;
    }
  };

  // Load users
  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || 'Error loading users');
      }
    } catch (error) {
      setMessage('Error loading users');
    }
  };

  // Load admin settings
  const loadAdminSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setAdminSettings(data.settings);
        
        // Update sensor timeout from admin settings
        const timeoutSetting = data.settings.find(s => s.setting_key === 'global_sensor_timeout');
        if (timeoutSetting) {
          setSensorTimeout(timeoutSetting.setting_value);
        }
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || 'Error loading admin settings');
      }
    } catch (error) {
      setMessage('Error loading admin settings');
    }
  };

  // Load system stats
  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      setMessage('Error loading stats');
    }
  };

  // Load admin config
  const loadAdminConfig = async () => {
    try {
      const response = await fetch('/api/admin/config', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setAdminConfig(data.config);
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || 'Error loading admin config');
      }
    } catch (error) {
      setMessage('Error loading admin config');
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      loadUsers();
      loadAdminSettings();
      loadStats();
      loadAdminConfig();
      loadConnectionSettings();
    }
  }, [user]);

  // Load saved MQTT connection settings
  const loadConnectionSettings = () => {
    const saved = localStorage.getItem('mqtt-connection-settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        setConnectionSettings(prev => ({ ...prev, ...settings }));
      } catch (error) {
        // Error loading settings
      }
    }
  };

  // Save connection settings
  const saveConnectionSettings = (settings) => {
    const toSave = { ...settings };
    delete toSave.password; // Don't save password for security
    localStorage.setItem('mqtt-connection-settings', JSON.stringify(toSave));
  };

  // Handle MQTT connect
  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectionMessage('');

    try {
      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(connectionSettings),
      });

      const result = await response.json();

      if (response.ok) {
        setConnectionMessage('Connected successfully!');
        saveConnectionSettings(connectionSettings);
      } else {
        setConnectionMessage(`Connection failed: ${result.error}`);
      }
    } catch (error) {
      setConnectionMessage(`Connection error: ${error.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle MQTT disconnect
  const handleDisconnect = async () => {
    setIsConnecting(true);
    setConnectionMessage('Disconnecting...');

    try {
      const result = await disconnectFromMqtt();
      
      if (result.success) {
        setConnectionMessage('Disconnected successfully');
      } else {
        setConnectionMessage(`Disconnect failed: ${result.error}`);
      }
    } catch (error) {
      setConnectionMessage(`Disconnect error: ${error.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Test configurations
  const testConfigurations = [
    {
      name: 'EMQX Public (MQTT)',
      config: {
        brokerAddress: 'broker.emqx.io',
        port: 1883,
        useTLS: false,
        username: '',
        password: ''
      }
    },
    {
      name: 'EMQX Public (MQTTS)',
      config: {
        brokerAddress: 'broker.emqx.io',
        port: 8883,
        useTLS: true,
        username: '',
        password: ''
      }
    },
    {
      name: 'Eclipse IoT',
      config: {
        brokerAddress: 'iot.eclipse.org',
        port: 1883,
        useTLS: false,
        username: '',
        password: ''
      }
    },
    {
      name: 'Mosquitto Test',
      config: {
        brokerAddress: 'test.mosquitto.org',
        port: 1883,
        useTLS: false,
        username: '',
        password: ''
      }
    }
  ];

  // Load test configuration
  const loadTestConfig = (config) => {
    setConnectionSettings(prev => ({
      ...prev,
      ...config,
      cleanSession: true,
      useAwsCerts: false
    }));
  };

  // Update user role
  const updateUserRole = async (userId, newRole) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        setMessage('User role updated successfully');
        await loadUsers();
        await loadStats();
      } else {
        const data = await response.json();
        setMessage(data.error || 'Error updating user role');
      }
    } catch (error) {
      setMessage('Error updating user role');
    } finally {
      setLoading(false);
    }
  };

  // Delete user
  const deleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setMessage('User deleted successfully');
        await loadUsers();
        await loadStats();
      } else {
        const data = await response.json();
        setMessage(data.error || 'Error deleting user');
      }
    } catch (error) {
      setMessage('Error deleting user');
    } finally {
      setLoading(false);
    }
  };

  // Update admin setting
  const updateAdminSetting = async (key, value, type = 'string', description = '') => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ key, value, type, description }),
      });

      if (response.ok) {
        setMessage('Setting updated successfully');
        
        // Update local state for sensor timeout
        if (key === 'global_sensor_timeout') {
          setSensorTimeout(value);
          // Refresh DeviceContext cache
          await refreshSensorTimeout();
        }
        
        await loadAdminSettings();
      } else {
        const data = await response.json();
        setMessage(data.error || 'Error updating setting');
      }
    } catch (error) {
      setMessage('Error updating setting');
    } finally {
      setLoading(false);
      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Add new admin setting
  const addNewSetting = () => {
    const key = prompt('Enter setting key:');
    const value = prompt('Enter setting value:');
    const description = prompt('Enter description (optional):') || '';
    
    if (key && value) {
      updateAdminSetting(key, value, 'string', description);
    }
  };

  // Update admin config
  const updateAdminConfig = async (updatedConfig) => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ config: updatedConfig }),
      });

      if (response.ok) {
        setMessage('Admin configuration updated successfully');
        await loadAdminConfig();
      } else {
        const data = await response.json();
        setMessage(data.error || 'Error updating admin configuration');
      }
    } catch (error) {
      setMessage('Error updating admin configuration');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Reset admin password
  const resetAdminPassword = async () => {
    const newPassword = prompt('Enter new admin password (min 6 characters):');
    if (!newPassword || newPassword.length < 6) {
      setMessage('Password must be at least 6 characters');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ newPassword }),
      });

      if (response.ok) {
        setMessage('Admin password updated successfully');
        await loadAdminConfig();
      } else {
        const data = await response.json();
        setMessage(data.error || 'Error updating admin password');
      }
    } catch (error) {
      setMessage('Error updating admin password');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card p-6 text-center">
          <Icon name="shield-x" size={48} className="mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Admin privileges required to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Admin Panel
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          System administration and user management
        </p>
      </div>

      {message && (
        <div className={`card p-4 ${message.includes('Error') || message.includes('error') 
          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
          : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'}`}>
          <p className={message.includes('Error') || message.includes('error') 
            ? 'text-red-800 dark:text-red-200' 
            : 'text-green-800 dark:text-green-200'}>
            {message}
          </p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="card p-0 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'users', name: 'User Management', icon: 'users' },
            { id: 'config', name: 'Admin Config', icon: 'user-cog' },
            { id: 'mqtt', name: 'MQTT Settings', icon: 'wifi' },
            { id: 'system', name: 'System Settings', icon: 'settings' },
            { id: 'monitoring', name: 'Monitoring', icon: 'activity' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center px-4 py-3 text-sm font-medium ${
                activeTab === tab.id
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon name={tab.icon} size={16} className="mr-2" />
              {tab.name}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  User Management
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Total: {users.length} users
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Devices (Online/Total)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map(userData => (
                      <tr key={userData.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {userData.username}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {userData.email}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={userData.role || 'user'}
                            onChange={(e) => updateUserRole(userData.id, e.target.value)}
                            disabled={loading}
                            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Icon name="smartphone" size={16} className="text-gray-400 mr-2" />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {getUserOnlineDeviceCount(userData)}/{getUserDeviceCount(userData)}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                              devices
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Date(userData.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => deleteUser(userData.id)}
                            disabled={loading || userData.id === user.id}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={userData.id === user.id ? "Cannot delete your own account" : "Delete user"}
                          >
                            <Icon name="trash-2" size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Admin Config Tab */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Admin Configuration
              </h2>
              
              {adminConfig ? (
                <div className="space-y-6">
                  {/* Default Admin Settings */}
                  <div className="card p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        Default Admin Account
                      </h3>
                      <button
                        onClick={resetAdminPassword}
                        className="btn btn-secondary text-sm"
                        disabled={loading}
                      >
                        <Icon name="key" size={16} className="mr-1" />
                        Reset Password
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          value={adminConfig.defaultAdmin.username}
                          onChange={(e) => {
                            const newConfig = {
                              ...adminConfig,
                              defaultAdmin: {
                                ...adminConfig.defaultAdmin,
                                username: e.target.value
                              }
                            };
                            setAdminConfig(newConfig);
                          }}
                          onBlur={() => updateAdminConfig(adminConfig)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={adminConfig.defaultAdmin.email}
                          onChange={(e) => {
                            const newConfig = {
                              ...adminConfig,
                              defaultAdmin: {
                                ...adminConfig.defaultAdmin,
                                email: e.target.value
                              }
                            };
                            setAdminConfig(newConfig);
                          }}
                          onBlur={() => updateAdminConfig(adminConfig)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          value={adminConfig.defaultAdmin.password}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed"
                          placeholder="Use Reset Password button to change"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Admin Settings */}
                  <div className="card p-4">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                      Admin Settings
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-gray-600 dark:text-gray-400">
                          Allow Multiple Admins
                        </label>
                        <input
                          type="checkbox"
                          checked={adminConfig.adminSettings.allowMultipleAdmins}
                          onChange={(e) => {
                            const newConfig = {
                              ...adminConfig,
                              adminSettings: {
                                ...adminConfig.adminSettings,
                                allowMultipleAdmins: e.target.checked
                              }
                            };
                            setAdminConfig(newConfig);
                            updateAdminConfig(newConfig);
                          }}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-gray-600 dark:text-gray-400">
                          Force Password Change
                        </label>
                        <input
                          type="checkbox"
                          checked={adminConfig.adminSettings.forcePasswordChange}
                          onChange={(e) => {
                            const newConfig = {
                              ...adminConfig,
                              adminSettings: {
                                ...adminConfig.adminSettings,
                                forcePasswordChange: e.target.checked
                              }
                            };
                            setAdminConfig(newConfig);
                            updateAdminConfig(newConfig);
                          }}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Session Timeout (hours)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="168"
                          value={Math.round(adminConfig.adminSettings.sessionTimeout / 3600000)}
                          onChange={(e) => {
                            const newConfig = {
                              ...adminConfig,
                              adminSettings: {
                                ...adminConfig.adminSettings,
                                sessionTimeout: parseInt(e.target.value) * 3600000
                              }
                            };
                            setAdminConfig(newConfig);
                          }}
                          onBlur={() => updateAdminConfig(adminConfig)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Max Login Attempts
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={adminConfig.adminSettings.maxLoginAttempts}
                          onChange={(e) => {
                            const newConfig = {
                              ...adminConfig,
                              adminSettings: {
                                ...adminConfig.adminSettings,
                                maxLoginAttempts: parseInt(e.target.value)
                              }
                            };
                            setAdminConfig(newConfig);
                          }}
                          onBlur={() => updateAdminConfig(adminConfig)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* System Settings */}
                  <div className="card p-4">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                      System Configuration
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          System Name
                        </label>
                        <input
                          type="text"
                          value={adminConfig.systemSettings.systemName}
                          onChange={(e) => {
                            const newConfig = {
                              ...adminConfig,
                              systemSettings: {
                                ...adminConfig.systemSettings,
                                systemName: e.target.value
                              }
                            };
                            setAdminConfig(newConfig);
                          }}
                          onBlur={() => updateAdminConfig(adminConfig)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Max Users
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={adminConfig.systemSettings.maxUsers}
                          onChange={(e) => {
                            const newConfig = {
                              ...adminConfig,
                              systemSettings: {
                                ...adminConfig.systemSettings,
                                maxUsers: parseInt(e.target.value)
                              }
                            };
                            setAdminConfig(newConfig);
                          }}
                          onBlur={() => updateAdminConfig(adminConfig)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                      

                      
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-gray-600 dark:text-gray-400">
                          Enable User Registration
                        </label>
                        <input
                          type="checkbox"
                          checked={adminConfig.systemSettings.enableRegistration}
                          onChange={(e) => {
                            const newConfig = {
                              ...adminConfig,
                              systemSettings: {
                                ...adminConfig.systemSettings,
                                enableRegistration: e.target.checked
                              }
                            };
                            setAdminConfig(newConfig);
                            updateAdminConfig(newConfig);
                          }}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Icon name="settings" size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 dark:text-gray-400">Loading admin configuration...</p>
                </div>
              )}
            </div>
          )}

          {/* MQTT Settings Tab */}
          {activeTab === 'mqtt' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  MQTT Configuration & Connection
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Manage MQTT broker connections and global sensor settings
                </p>
              </div>

              {connectionMessage && (
                <div className={`card p-4 ${connectionMessage.includes('successfully') 
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                  <p className={connectionMessage.includes('successfully') 
                    ? 'text-green-800 dark:text-green-200' 
                    : 'text-red-800 dark:text-red-200'}>
                    {connectionMessage}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Connection Status */}
                <div className="card p-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                    Current Connection Status
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${connectionStatus.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {connectionStatus.connected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    {connectionStatus.brokerAddress && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Broker: {connectionStatus.brokerAddress}:{connectionStatus.port}
                      </p>
                    )}
                    {connectionStatus.lastConnected && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Last connected: {new Date(connectionStatus.lastConnected).toLocaleString()}
                      </p>
                    )}
                    {connectionStatus.error && (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Error: {connectionStatus.error}
                      </p>
                    )}
                    
                    <div className="flex space-x-2 pt-2">
                      {connectionStatus.connected ? (
                        <button
                          onClick={handleDisconnect}
                          disabled={isConnecting}
                          className="btn btn-danger text-sm"
                        >
                          {isConnecting ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                      ) : (
                        <button
                          onClick={handleConnect}
                          disabled={isConnecting || !connectionSettings.brokerAddress}
                          className="btn btn-primary text-sm"
                        >
                          {isConnecting ? 'Connecting...' : 'Connect'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Global Timeout Settings */}
                <div className="card p-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                    Global Sensor Settings
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Sensor Timeout (seconds)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="3600"
                        value={sensorTimeout}
                        onChange={(e) => {
                          let value = parseInt(e.target.value) || 60;
                          // Enforce min/max limits
                          if (value < 1) value = 1;
                          if (value > 3600) value = 3600;
                          setSensorTimeout(value.toString());
                        }}
                        onBlur={(e) => {
                          const value = parseInt(e.target.value) || 60;
                          updateAdminSetting('global_sensor_timeout', value.toString(), 'number', 'Global timeout for sensor offline detection (1-3600 seconds)');
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Time in seconds before marking sensors as offline (Min: 1s, Max: 3600s)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* MQTT Connection Configuration */}
              <div className="card p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    MQTT Broker Configuration
                  </h3>
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium"
                  >
                    {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
                  </button>
                </div>

                <form onSubmit={(e) => e.preventDefault()}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Broker Address
                      </label>
                      <input
                        type="text"
                        value={connectionSettings.brokerAddress}
                        onChange={(e) => setConnectionSettings(prev => ({ ...prev, brokerAddress: e.target.value }))}
                        placeholder="broker.example.com"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Port
                      </label>
                      <input
                        type="number"
                        value={connectionSettings.port}
                        onChange={(e) => setConnectionSettings(prev => ({ ...prev, port: parseInt(e.target.value) || 1883 }))}
                        placeholder="1883"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Username (optional)
                      </label>
                      <input
                        type="text"
                        value={connectionSettings.username}
                        onChange={(e) => setConnectionSettings(prev => ({ ...prev, username: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Password (optional)
                      </label>
                      <input
                        type="password"
                        value={connectionSettings.password}
                        onChange={(e) => setConnectionSettings(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </form>

                {showAdvanced && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Advanced Settings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="useTLS"
                          checked={connectionSettings.useTLS}
                          onChange={(e) => setConnectionSettings(prev => ({ ...prev, useTLS: e.target.checked, port: e.target.checked ? 8883 : 1883 }))}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        <label htmlFor="useTLS" className="text-sm text-gray-700 dark:text-gray-300">
                          Use TLS/SSL (Port will change to 8883)
                        </label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="cleanSession"
                          checked={connectionSettings.cleanSession}
                          onChange={(e) => setConnectionSettings(prev => ({ ...prev, cleanSession: e.target.checked }))}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        <label htmlFor="cleanSession" className="text-sm text-gray-700 dark:text-gray-300">
                          Clean Session
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Test Configurations */}
              <div className="card p-6">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                  Quick Test Configurations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {testConfigurations.map((config, index) => (
                    <button
                      key={index}
                      onClick={() => loadTestConfig(config.config)}
                      className="p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                        {config.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {config.config.brokerAddress}:{config.config.port}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  Click any configuration to load it. These are public test brokers for development.
                </p>
              </div>
            </div>
          )}

          {/* System Settings Tab */}
          {activeTab === 'system' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  System Settings
                </h2>
                <button
                  onClick={addNewSetting}
                  className="btn btn-primary"
                  disabled={loading}
                >
                  <Icon name="plus" size={16} className="mr-1" />
                  Add Setting
                </button>
              </div>
              
              <div className="space-y-4">
                {adminSettings.length === 0 ? (
                  <div className="text-center py-8">
                    <Icon name="settings" size={48} className="mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500 dark:text-gray-400">No system settings configured yet.</p>
                    <button onClick={addNewSetting} className="mt-2 btn btn-secondary">
                      Add First Setting
                    </button>
                  </div>
                ) : (
                  adminSettings.map(setting => (
                    <div key={setting.id} className="card p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {setting.setting_key}
                          </h3>
                          {setting.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {setting.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            Type: {setting.setting_type} | Updated: {new Date(setting.updated_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="ml-4">
                          <input
                            type={setting.setting_type === 'number' ? 'number' : 'text'}
                            defaultValue={setting.setting_value}
                            onBlur={(e) => updateAdminSetting(setting.setting_key, e.target.value, setting.setting_type, setting.description)}
                            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm w-32"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Monitoring Tab */}
          {activeTab === 'monitoring' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                System Monitoring
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-4 text-center">
                  <Icon name="users" size={32} className="mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.totalUsers || users.length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Total Users
                  </div>
                </div>
                
                <div className="card p-4 text-center">
                  <Icon name="shield" size={32} className="mx-auto mb-2 text-purple-500" />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.adminUsers || users.filter(u => u.role === 'admin').length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Admin Users
                  </div>
                </div>
                
                <div className="card p-4 text-center">
                  <Icon name="wifi" size={32} className={`mx-auto mb-2 ${connectionStatus.connected ? 'text-green-500' : 'text-red-500'}`} />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {connectionStatus.connected ? 'Online' : 'Offline'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    MQTT Status
                  </div>
                </div>
                
                <div className="card p-4 text-center">
                  <Icon name="settings" size={32} className="mx-auto mb-2 text-orange-500" />
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.totalSettings || adminSettings.length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    System Settings
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="card p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                  System Information
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Server Status:</span>
                    <span className="text-green-600 dark:text-green-400 font-medium">Running</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Database:</span>
                    <span className="text-green-600 dark:text-green-400 font-medium">SQLite Connected</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Last Stats Update:</span>
                    <span className="text-gray-900 dark:text-white">
                      {stats.timestamp ? new Date(stats.timestamp).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin; 
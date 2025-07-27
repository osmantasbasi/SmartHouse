import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useMqtt } from './MqttContext';
import { useAuth } from './AuthContext';
import deviceConfig from '../config/devices.json';

const DeviceContext = createContext();

export const useDevices = () => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevices must be used within a DeviceProvider');
  }
  return context;
};

export const DeviceProvider = ({ children }) => {
  const { messages, subscribeToTopic, publishMessage, connectionStatus, unsubscribeFromTopic } = useMqtt();
  const { dashboardConfig, saveDashboardConfig, refreshDashboardConfig, isAuthenticated, getUserSetting } = useAuth();
  const [devices, setDevices] = useState({});
  const [deviceLayouts, setDeviceLayouts] = useState([]);
  const [deviceOfflineTimers, setDeviceOfflineTimers] = useState({});
  const [deletedTopics, setDeletedTopics] = useState(new Set());
  const [deviceFilters, setDeviceFilters] = useState({
    type: 'all',
    status: 'all',
    search: '',
    room: '',
    controllable: '',
    enabled: 'all'
  });
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Get current devices state (for external access)
  const getCurrentDevices = useCallback(() => {
    return devices;
  }, [devices]);

  // Cache for sensor timeout value
  const [sensorTimeoutCache, setSensorTimeoutCache] = useState(60 * 1000); // Default 60 seconds
  const [lastTimeoutFetch, setLastTimeoutFetch] = useState(0);
  const TIMEOUT_CACHE_DURATION = 5 * 60 * 1000; // Cache for 5 minutes

  // Get sensor timeout from admin settings with caching
  const getSensorTimeout = useCallback(async () => {
    const now = Date.now();
    
    // Return cached value if it's still valid
    if (now - lastTimeoutFetch < TIMEOUT_CACHE_DURATION) {
      return sensorTimeoutCache;
    }

    try {
      const response = await fetch('/api/admin/settings', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const timeoutSetting = data.settings.find(setting => setting.setting_key === 'global_sensor_timeout');
        const timeoutValue = timeoutSetting ? timeoutSetting.setting_value : '60';
        const newTimeout = (parseInt(timeoutValue) || 60) * 1000; // Convert to milliseconds
        
        // Update cache
        setSensorTimeoutCache(newTimeout);
        setLastTimeoutFetch(now);
        
        return newTimeout;
      }
    } catch (error) {
      // Fallback to cached value if admin settings can't be loaded
    }
    return sensorTimeoutCache; // Return cached value as fallback
  }, [sensorTimeoutCache, lastTimeoutFetch]);

  // Force refresh timeout cache (useful when admin settings are updated)
  const refreshSensorTimeout = useCallback(async () => {
    setLastTimeoutFetch(0); // Invalidate cache
    return await getSensorTimeout();
  }, [getSensorTimeout]);

  // Load initial sensor timeout value and set up periodic refresh
  useEffect(() => {
    if (isAuthenticated) {
      getSensorTimeout();
      
      // Refresh timeout cache every 5 minutes
      const timeoutRefreshInterval = setInterval(() => {
        getSensorTimeout();
      }, TIMEOUT_CACHE_DURATION);

      return () => clearInterval(timeoutRefreshInterval);
    }
  }, [isAuthenticated, getSensorTimeout]);

  // Periodic sync to ensure dashboard config is up to date
  useEffect(() => {
    if (!isAuthenticated) return;

    const syncInterval = setInterval(async () => {
      await refreshDashboardConfig();
    }, 60000); // Increased to 60 seconds to reduce conflicts

    return () => clearInterval(syncInterval);
  }, [isAuthenticated, refreshDashboardConfig]);

  // Load configuration from database when user is authenticated
  useEffect(() => {
    if (isAuthenticated && dashboardConfig) {
      // Always load if we have fewer devices locally than in config
      const configDeviceCount = dashboardConfig.devices ? Object.keys(dashboardConfig.devices).length : 0;
      const localDeviceCount = Object.keys(devices).length;
      
      // Skip only if we have the same or more devices and config is not newer
      const configLastUpdated = dashboardConfig.lastUpdated;
      const shouldSkip = lastSyncTime && 
                        configLastUpdated && 
                        new Date(configLastUpdated) <= new Date(lastSyncTime) && 
                        localDeviceCount >= configDeviceCount;
      
      if (shouldSkip) {
        return;
      }
      
      // Load devices from database config
      if (dashboardConfig.devices) {
        setDevices(dashboardConfig.devices);
      }
      
      // Load device layouts from database config
      if (dashboardConfig.deviceLayouts) {
        setDeviceLayouts(dashboardConfig.deviceLayouts);
      }
      
      // Load deleted topics from database config
      if (dashboardConfig.deletedTopics) {
        setDeletedTopics(new Set(dashboardConfig.deletedTopics));
      }
      
      // Load device filters from database config
      if (dashboardConfig.deviceFilters) {
        setDeviceFilters(dashboardConfig.deviceFilters);
      }
      
      // Update last sync time
      setLastSyncTime(new Date().toISOString());
    } else if (!isAuthenticated) {
      // Clear data when user logs out
      setDevices({});
      setDeviceLayouts([]);
      setDeletedTopics(new Set());
      setDeviceFilters({
        type: 'all',
        status: 'all',
        search: '',
        room: '',
        controllable: '',
        enabled: 'all'
      });
      setLastSyncTime(null);
    }
  }, [isAuthenticated, dashboardConfig, lastSyncTime]);

  // Migration function to move localStorage data to database (one-time)
  useEffect(() => {
    if (isAuthenticated && Object.keys(dashboardConfig).length === 0) {
      
      // Check if there's existing localStorage data to migrate
      const savedDevices = localStorage.getItem('smart-home-devices');
      const savedLayout = localStorage.getItem('smart-home-layout');
      const savedDeletedTopics = localStorage.getItem('smart-home-deleted-topics');
      
      if (savedDevices || savedLayout || savedDeletedTopics) {
        
        let migratedDevices = {};
        let migratedLayouts = [];
        let migratedDeletedTopics = [];
        
        // Migrate devices
        if (savedDevices) {
          try {
            const parsedDevices = JSON.parse(savedDevices);
            if (Object.keys(parsedDevices).length > 0) {
              // Migrate existing devices to have enabled property
              Object.entries(parsedDevices).forEach(([deviceId, device]) => {
                migratedDevices[deviceId] = {
                  ...device,
                  enabled: device.enabled !== undefined ? device.enabled : true
                };
              });
              setDevices(migratedDevices);
            }
          } catch (error) {
            // Removed console.error for production
          }
        }
        
        // Migrate layouts
        if (savedLayout) {
          try {
            const parsedLayout = JSON.parse(savedLayout);
            if (Array.isArray(parsedLayout) && parsedLayout.length > 0) {
              migratedLayouts = parsedLayout;
              setDeviceLayouts(parsedLayout);
            }
          } catch (error) {
            // Removed console.error for production
          }
        }
        
        // Migrate deleted topics
        if (savedDeletedTopics) {
          try {
            const topics = JSON.parse(savedDeletedTopics);
            migratedDeletedTopics = topics;
            setDeletedTopics(new Set(topics));
          } catch (error) {
            // Removed console.error for production
          }
        }
        
        // Save migrated data to database
        const migratedConfig = {
          devices: migratedDevices,
          deviceLayouts: migratedLayouts,
          deletedTopics: migratedDeletedTopics,
          deviceFilters: {
            type: 'all',
            status: 'all',
            search: '',
            room: '',
            controllable: '',
            enabled: 'all'
          },
          migrated: true,
          migratedAt: new Date().toISOString()
        };
        
        saveDashboardConfig(migratedConfig).then(() => {
          // Clear localStorage after successful migration
          localStorage.removeItem('smart-home-devices');
          localStorage.removeItem('smart-home-layout');
          localStorage.removeItem('smart-home-deleted-topics');
        }).catch(error => {
          // Removed console.error for production
        });
      }
    }
  }, [isAuthenticated, dashboardConfig, saveDashboardConfig]);

  // Save configuration to database when data changes
  const saveConfigToDatabase = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    
    const config = {
      devices,
      deviceLayouts,
      deletedTopics: Array.from(deletedTopics),
      deviceFilters,
      lastUpdated: new Date().toISOString()
    };
    
    const success = await saveDashboardConfig(config);
    if (!success) {
      // Removed console.error for production
    }
  }, [isAuthenticated, devices, deviceLayouts, deletedTopics, deviceFilters, saveDashboardConfig]);

  // Note: Automatic saving has been disabled to prevent unwanted saves
  // Save operations are now only triggered manually through Dashboard save button
  // or when adding/removing devices manually

  // Function to clean up null/invalid devices
  const cleanupInvalidDevices = useCallback(() => {
    
    let cleanedCount = 0;
    let cleanedDevices = {};
    
    // Clean devices
    Object.entries(devices).forEach(([deviceId, device]) => {
      // Comprehensive validation
      if (device && 
          typeof device === 'object' && 
          device.id && 
          device.name && 
          device.topic &&
          device.id !== 'null' && 
          device.id !== 'undefined' &&
          device.id !== null &&
          device.id !== undefined &&
          device.name !== 'null' && 
          device.name !== 'undefined' &&
          device.name !== null &&
          device.name !== undefined &&
          device.topic !== 'null' && 
          device.topic !== 'undefined' &&
          device.topic !== null &&
          device.topic !== undefined &&
          typeof device.id === 'string' &&
          typeof device.name === 'string' &&
          typeof device.topic === 'string' &&
          device.id.trim() !== '' &&
          device.name.trim() !== '' &&
          device.topic.trim() !== '') {
        cleanedDevices[deviceId] = device;
      } else {
        cleanedCount++;
        
        // Clear offline timer if exists
        if (deviceOfflineTimers[deviceId]) {
          clearTimeout(deviceOfflineTimers[deviceId]);
        }
        
        // Unsubscribe if device has topic and we're connected
        if (device?.topic && connectionStatus.connected && unsubscribeFromTopic) {
          unsubscribeFromTopic(device.topic);
        }
      }
    });
    
    // Update devices state
    setDevices(cleanedDevices);
    
    // Clean up device layouts for removed devices
    const validDeviceIds = Object.keys(cleanedDevices);
    const cleanedLayouts = deviceLayouts.filter(layout => 
      layout && 
      layout.i && 
      typeof layout.i === 'string' &&
      layout.i.trim() !== '' &&
      validDeviceIds.includes(layout.i) &&
      layout.i !== 'null' && 
      layout.i !== 'undefined'
    );
    
    if (cleanedLayouts.length !== deviceLayouts.length) {
      const layoutsRemoved = deviceLayouts.length - cleanedLayouts.length;
      setDeviceLayouts(cleanedLayouts);
    }
    
    // Clean up offline timers
    const cleanedTimers = {};
    Object.entries(deviceOfflineTimers).forEach(([deviceId, timer]) => {
      if (cleanedDevices[deviceId] && timer) {
        cleanedTimers[deviceId] = timer;
      } else if (timer) {
        clearTimeout(timer);
      }
    });
    setDeviceOfflineTimers(cleanedTimers);
    
    if (cleanedCount > 0) {
    } else {
    }
    
    return cleanedCount;
  }, [devices, deviceLayouts, deviceOfflineTimers, connectionStatus.connected, unsubscribeFromTopic]);

  // Function to completely clear all devices and storage
  const clearAllDevices = useCallback(async () => {
    
    // Clear all offline timers
    Object.values(deviceOfflineTimers).forEach(timer => {
      if (timer) clearTimeout(timer);
    });
    setDeviceOfflineTimers({});
    
    // Clear devices state
    setDevices({});
    setDeviceLayouts([]);
    
    // Clear deleted topics
    setDeletedTopics(new Set());
    
    // Update last sync time
    setLastSyncTime(new Date().toISOString());
    
    // Save to database immediately
    if (isAuthenticated) {
      try {
        const config = {
          devices: {},
          deviceLayouts: [],
          deletedTopics: [],
          deviceFilters,
          lastUpdated: new Date().toISOString()
        };
        
        await saveDashboardConfig(config);
      } catch (error) {
        console.error('Failed to save clear all to database:', error);
      }
    }
    
  }, [deviceOfflineTimers, isAuthenticated, saveDashboardConfig, deviceFilters]);

  const clearDeletedTopics = useCallback(() => {
    setDeletedTopics(new Set());
  }, []);

  // Auto cleanup when devices change
  useEffect(() => {
    // Delay cleanup to avoid infinite loops
    const timeoutId = setTimeout(() => {
      const deviceArray = Object.values(devices);
      const hasInvalidDevices = deviceArray.some(device => 
        !device || 
        typeof device !== 'object' || 
        !device.id || 
        !device.name || 
        !device.topic ||
        device.id === 'null' || 
        device.id === 'undefined' ||
        device.name === 'null' || 
        device.name === 'undefined' ||
        device.topic === 'null' || 
        device.topic === 'undefined'
      );
      
      if (hasInvalidDevices && deviceArray.length > 0) {
        cleanupInvalidDevices();
      }
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [devices, cleanupInvalidDevices]);

  // Auto-subscribe to all device topics when MQTT connection is established
  useEffect(() => {
    if (connectionStatus.connected) {
      // Subscribe to all topics to capture any MQTT messages for auto-detection
      subscribeToTopic('#');
      
      // Also subscribe to individual device topics if they exist
      if (Object.keys(devices).length > 0) {
        Object.values(devices).forEach(device => {
          subscribeToTopic(device.topic);
        });
      }
    }
  }, [connectionStatus.connected, subscribeToTopic, devices]);

  // Process incoming MQTT messages and update device states
  useEffect(() => {
    if (messages.length === 0) return;

    const latestMessage = messages[0];
    const { topic, message } = latestMessage;

    // Skip _sub topics as they are for outgoing messages only
    if (topic.endsWith('_sub')) {
      return;
    }


    // Find device by topic (exact match or wildcard match)
    const deviceId = Object.keys(devices).find(id => {
      const device = devices[id];
      if (!device || !device.topic) return false;
      
      const deviceTopic = device.topic;
      // Exact match
      if (deviceTopic === topic) return true;
      
      // Wildcard match (+ for single level, # for multi-level)
      if (deviceTopic.includes('+') || deviceTopic.includes('#')) {
        try {
          const regex = deviceTopic
            .replace(/\+/g, '[^/]+')
            .replace(/#/g, '.*');
          return new RegExp(`^${regex}$`).test(topic);
        } catch (error) {
          // Removed console.error for production
        }
      }
      
      return false;
    });

    if (deviceId) {
      try {
        let parsedMessage;
        try {
          parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;
        } catch {
          // If JSON parsing fails, use the raw message
          parsedMessage = { value: message };
        }
        
        
        // Clear existing offline timer for this device
        if (deviceOfflineTimers[deviceId]) {
          clearTimeout(deviceOfflineTimers[deviceId]);
        }
        
        // Set device as online and update data
        setDevices(prev => ({
          ...prev,
          [deviceId]: {
            ...prev[deviceId],
            data: parsedMessage,
            lastUpdated: new Date(),
            isOnline: true
          }
        }));
        
        // Set a timer to mark device as offline after the configured timeout
        const offlineTimer = setTimeout(() => {
          setDevices(prev => ({
            ...prev,
            [deviceId]: {
              ...prev[deviceId],
              isOnline: false
            }
          }));
          setDeviceOfflineTimers(prev => {
            const newTimers = { ...prev };
            delete newTimers[deviceId];
            return newTimers;
          });
        }, sensorTimeoutCache);
        
        setDeviceOfflineTimers(prev => ({
          ...prev,
          [deviceId]: offlineTimer
        }));
      } catch (error) {
        // Removed console.error for production
      }
    } else {
    }
  }, [messages, devices, sensorTimeoutCache]);

  const addDevice = useCallback(async (deviceData) => {
    const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const configType = deviceConfig[deviceData.type] || {};
    
    const newDevice = {
      id: deviceId,
      name: deviceData.name || configType.name || 'Unknown Device',
      type: deviceData.type,
      topic: deviceData.topic,
      room: deviceData.room || 'General',
      icon: configType.icon || 'device-unknown',
      controllable: configType.controllable || false,
      enabled: deviceData.enabled !== undefined ? deviceData.enabled : true, // Add enabled property
      data: {},
      isOnline: false,
      lastUpdated: null,
      config: configType
    };

    const newDevices = {
      ...devices,
      [deviceId]: newDevice
    };
    setDevices(newDevices);

    // Subscribe to device topic if connected and remove from deleted topics if re-adding
    if (connectionStatus.connected) {
      subscribeToTopic(deviceData.topic);
    }

    // Remove topic from deleted topics if re-adding manually
    const newDeletedTopics = new Set(deletedTopics);
    newDeletedTopics.delete(deviceData.topic);
    setDeletedTopics(newDeletedTopics);

    // Add to layout if not exists
    const exists = deviceLayouts.find(layout => layout.i === deviceId);
    let newLayouts = deviceLayouts;
    
    if (!exists) {
      newLayouts = [...deviceLayouts, {
        i: deviceId,
        x: 0,
        y: Infinity,
        w: 4,
        h: 4,
        minW: 2,
        maxW: 12,
        minH: 2,
        maxH: 8
      }];
      setDeviceLayouts(newLayouts);
    }

    // Save changes to database immediately
    if (isAuthenticated) {
      const config = {
        devices: newDevices,
        deviceLayouts: newLayouts,
        deletedTopics: Array.from(newDeletedTopics),
        deviceFilters,
        lastUpdated: new Date().toISOString()
      };
      
      await saveDashboardConfig(config);
    }

    return deviceId;
  }, [connectionStatus.connected, subscribeToTopic, devices, deviceLayouts, deletedTopics, deviceFilters, isAuthenticated, saveDashboardConfig]);

  const removeDevice = useCallback(async (deviceId) => {
    const device = devices[deviceId];
    
    if (!device) {
      throw new Error('Device not found');
    }
    
    // Clear offline timer if exists
    if (deviceOfflineTimers[deviceId]) {
      clearTimeout(deviceOfflineTimers[deviceId]);
      setDeviceOfflineTimers(prev => {
        const newTimers = { ...prev };
        delete newTimers[deviceId];
        return newTimers;
      });
    }

    // Unsubscribe from device topic if connected and device exists
    if (device.topic && connectionStatus.connected && unsubscribeFromTopic) {
      unsubscribeFromTopic(device.topic);
    }

    // Remove device from state immediately - like clearAllDevices does
    const newDevices = { ...devices };
    delete newDevices[deviceId];
    setDevices(newDevices);

    // Remove from layout immediately - like clearAllDevices does
    const newLayouts = deviceLayouts.filter(layout => layout && layout.i && layout.i !== deviceId);
    setDeviceLayouts(newLayouts);
    
    // Update last sync time to prevent reload from database
    setLastSyncTime(new Date().toISOString());
    
    // Save changes to database immediately to prevent reload from overriding
    if (isAuthenticated) {
      try {
        const config = {
          devices: newDevices,
          deviceLayouts: newLayouts,
          deletedTopics: Array.from(deletedTopics), // Don't add to deletedTopics for individual removal
          deviceFilters,
          lastUpdated: new Date().toISOString()
        };
        
        await saveDashboardConfig(config);
      } catch (error) {
        console.error('Failed to save device removal to database:', error);
        // Don't throw error, just log it
      }
    }
    
  }, [devices, deviceLayouts, deviceOfflineTimers, connectionStatus.connected, unsubscribeFromTopic, isAuthenticated, saveDashboardConfig, deletedTopics, deviceFilters]);

  const updateDevice = useCallback(async (deviceId, updates) => {
    const updatedDevices = {
      ...devices,
      [deviceId]: {
        ...devices[deviceId],
        ...updates
      }
    };
    setDevices(updatedDevices);
    
    // Save changes to database immediately to persist the state
    if (isAuthenticated) {
      const config = {
        devices: updatedDevices,
        deviceLayouts,
        deletedTopics: Array.from(deletedTopics),
        deviceFilters,
        lastUpdated: new Date().toISOString()
      };
      
      await saveDashboardConfig(config);
    }
  }, [devices, deviceLayouts, deletedTopics, deviceFilters, isAuthenticated, saveDashboardConfig]);

  const toggleDeviceEnabled = useCallback(async (deviceId) => {
    const device = devices[deviceId];
    if (!device) return;
    
    const newEnabledState = !device.enabled;
    
    // Update device immediately for UI responsiveness
    const updatedDevices = {
      ...devices,
      [deviceId]: {
        ...device,
        enabled: newEnabledState
      }
    };
    setDevices(updatedDevices);
    
    // Save changes to database immediately to persist the state
    if (isAuthenticated) {
      const config = {
        devices: updatedDevices,
        deviceLayouts,
        deletedTopics: Array.from(deletedTopics),
        deviceFilters,
        lastUpdated: new Date().toISOString()
      };
      
      await saveDashboardConfig(config);
    }
    
  }, [devices, deviceLayouts, deletedTopics, deviceFilters, isAuthenticated, saveDashboardConfig]);

  const controlDevice = useCallback((deviceId, controlData) => {
    const device = devices[deviceId];
    if (!device || !device.controllable || !connectionStatus.connected) return;

    publishMessage(device.topic, controlData);
  }, [devices, connectionStatus.connected, publishMessage]);

  const updateLayout = useCallback((newLayout) => {
    // Validate and clean the layout data
    const validatedLayout = newLayout.map(item => ({
      ...item,
      x: Math.max(0, item.x),
      y: Math.max(0, item.y),
      w: Math.max(2, Math.min(12, item.w)),
      h: Math.max(2, Math.min(8, item.h)),
      minW: 2,
      maxW: 12,
      minH: 2,
      maxH: 8
    }));
    
    setDeviceLayouts(validatedLayout);
  }, []);

  const autoDetectDevices = useCallback(() => {
    // Auto-detect devices based on recent MQTT messages
    const detectedDevices = [];
    const recentTopics = new Set();


    // Get unique topics from recent messages that don't have devices yet and aren't deleted
    const messagesToCheck = messages.slice(0, 100); // Check more messages
    messagesToCheck.forEach(msg => {
          // Skip if device already exists for this topic, topic was manually deleted, or is a _sub topic
    const existingDevice = Object.values(devices).find(device => device.topic === msg.topic);
    const wasDeleted = deletedTopics.has(msg.topic);
    const isSubTopic = msg.topic.endsWith('_sub');
    if (!existingDevice && !wasDeleted && !isSubTopic) {
        recentTopics.add(msg.topic);
      }
    });


    if (recentTopics.size === 0) {
      if (messages.length === 0) {
      }
      return [];
    }

    recentTopics.forEach(topic => {
      // Find the latest message for this topic to analyze content
      const latestMessage = messagesToCheck.find(msg => msg.topic === topic);
      let messageData = {};
      
      try {
        if (latestMessage && latestMessage.message) {
          messageData = typeof latestMessage.message === 'string' 
            ? JSON.parse(latestMessage.message) 
            : latestMessage.message;
        }
      } catch (error) {
        messageData = { value: latestMessage?.message || 'unknown' };
      }

      // Try to match topic pattern and message content with device types
      let detectedType = 'temperature_sensor'; // default
      let deviceName = 'Unknown Device';
      
      // More comprehensive topic and data analysis
      const topicLower = topic.toLowerCase();
      const messageKeys = Object.keys(messageData).map(k => k.toLowerCase());
      const messageContent = JSON.stringify(messageData).toLowerCase();
      
      // Analyze both topic and message content for better detection
      if (topicLower.includes('temp') || topicLower.includes('temperature') || 
          messageKeys.some(k => k.includes('temp')) || messageContent.includes('humidity')) {
        detectedType = 'temperature_sensor';
        deviceName = 'Temperature Sensor';
      } else if (topicLower.includes('door') || topicLower.includes('contact') ||
                 messageKeys.some(k => k.includes('door')) || messageContent.includes('open') || messageContent.includes('closed')) {
        detectedType = 'door_sensor';
        deviceName = 'Door Sensor';
      } else if (topicLower.includes('relay') || topicLower.includes('light') || topicLower.includes('switch') ||
                 messageKeys.some(k => k.includes('relay')) || messageContent.includes('"on"') || messageContent.includes('"off"')) {
        detectedType = 'relay';
        deviceName = 'Smart Relay';
      } else if (topicLower.includes('motion') || topicLower.includes('pir') ||
                 messageKeys.some(k => k.includes('motion')) || messageContent.includes('detected')) {
        detectedType = 'motion_sensor';
        deviceName = 'Motion Sensor';
      } else if (topicLower.includes('distance') || topicLower.includes('ultrasonic') || topicLower.includes('range') ||
                 messageKeys.some(k => k.includes('distance'))) {
        detectedType = 'distance_sensor';
        deviceName = 'Distance Sensor';
      } else if (topicLower.includes('thermostat') || topicLower.includes('hvac') || topicLower.includes('climate') ||
                 messageKeys.some(k => k.includes('target'))) {
        detectedType = 'smart_thermostat';
        deviceName = 'Thermostat';
      } else if (topicLower.includes('lock') || topicLower.includes('deadbolt') ||
                 messageKeys.some(k => k.includes('lock')) || messageContent.includes('locked') || messageContent.includes('unlocked')) {
        detectedType = 'smart_lock';
        deviceName = 'Smart Lock';
      } else if (topicLower.includes('air') || topicLower.includes('quality') || topicLower.includes('co2') ||
                 messageKeys.some(k => k.includes('co2') || k.includes('pm') || k.includes('aqi'))) {
        detectedType = 'air_quality';
        deviceName = 'Air Quality Sensor';
      } else if (topicLower.includes('camera') || topicLower.includes('video') ||
                 messageKeys.some(k => k.includes('video') || k.includes('recording'))) {
        detectedType = 'security_camera';
        deviceName = 'Security Camera';
      } else if (topicLower.includes('water') || topicLower.includes('leak') || topicLower.includes('flood') ||
                 messageKeys.some(k => k.includes('water') || k.includes('leak')) || messageContent.includes('wet') || messageContent.includes('dry')) {
        detectedType = 'water_leak_sensor';
        deviceName = 'Water Leak Sensor';
      }

      // Extract room from topic
      let room = 'General';
      const roomPatterns = [
        /home\/([^\/]+)\//,
        /([^\/]+)\/[^\/]+$/,
        /\/([^\/]+)\//
      ];
      
      for (const pattern of roomPatterns) {
        const roomMatch = topic.match(pattern);
        if (roomMatch && roomMatch[1] && !['home', 'device', 'sensor', 'mqtt'].includes(roomMatch[1].toLowerCase())) {
          room = roomMatch[1].charAt(0).toUpperCase() + roomMatch[1].slice(1).replace(/[-_]/g, ' ');
          break;
        }
      }

      // Create device name based on topic structure
      const topicParts = topic.split('/');
      const lastPart = topicParts[topicParts.length - 1] || 'Device';
      const deviceIdentifier = lastPart.charAt(0).toUpperCase() + lastPart.slice(1);

      detectedDevices.push({
        name: `${deviceName} (${deviceIdentifier})`,
        type: detectedType,
        topic: topic,
        room: room
      });
      
    });

    return detectedDevices;
  }, [messages, devices, deletedTopics]);

  const getDevicesByType = useCallback((type) => {
    return Object.values(devices).filter(device => device.type === type);
  }, [devices]);

  const getDevicesByRoom = useCallback((room) => {
    return Object.values(devices).filter(device => device.room === room);
  }, [devices]);

  const getFilteredDevices = useCallback(() => {
    // Start with valid devices only - just check if device exists and has an id
    let filtered = Object.values(devices).filter(device => 
      device && device.id && typeof device === 'object'
    );


    if (deviceFilters.type !== 'all') {
      filtered = filtered.filter(device => device.type === deviceFilters.type);
    }

    if (deviceFilters.status !== 'all') {
      if (deviceFilters.status === 'online') {
        filtered = filtered.filter(device => device.isOnline === true);
      } else if (deviceFilters.status === 'offline') {
        filtered = filtered.filter(device => device.isOnline !== true);
      }
    }

    if (deviceFilters.room && deviceFilters.room !== 'all') {
      filtered = filtered.filter(device => device.room === deviceFilters.room);
    }

    if (deviceFilters.controllable) {
      if (deviceFilters.controllable === 'true') {
        filtered = filtered.filter(device => device.controllable === true);
      } else if (deviceFilters.controllable === 'false') {
        filtered = filtered.filter(device => device.controllable !== true);
      }
    }

    if (deviceFilters.enabled !== 'all') {
      if (deviceFilters.enabled === 'true') {
        filtered = filtered.filter(device => device.enabled === true);
      } else if (deviceFilters.enabled === 'false') {
        filtered = filtered.filter(device => device.enabled !== true);
      }
    }

    if (deviceFilters.search) {
      const searchLower = deviceFilters.search.toLowerCase();
      filtered = filtered.filter(device => {
        if (!device) return false;
        
        const name = (device.name || '').toLowerCase();
        const room = (device.room || '').toLowerCase();
        const topic = (device.topic || '').toLowerCase();
        
        return name.includes(searchLower) ||
               room.includes(searchLower) ||
               topic.includes(searchLower);
      });
    }

    
    return filtered;
  }, [devices, deviceFilters]);

  const value = {
    devices,
    deviceLayouts,
    deviceFilters,
    deviceConfig,
    addDevice,
    removeDevice,
    updateDevice,
    toggleDeviceEnabled,
    controlDevice,
    updateLayout,
    autoDetectDevices,
    getDevicesByType,
    getDevicesByRoom,
    getFilteredDevices,
    setDeviceFilters,
    clearAllDevices,
    clearDeletedTopics,
    cleanupInvalidDevices,
    getCurrentDevices,
    getSensorTimeout,
    refreshSensorTimeout,
    sensorTimeoutCache,
  };

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  );
}; 
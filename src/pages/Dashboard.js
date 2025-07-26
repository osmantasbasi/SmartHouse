import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { useDevices } from '../contexts/DeviceContext';
import { useMqtt } from '../contexts/MqttContext';
import { useAuth } from '../contexts/AuthContext';
import DeviceWidget from '../components/devices/DeviceWidget';
import Icon from '../components/ui/Icon';

const ResponsiveGridLayout = WidthProvider(Responsive);

const Dashboard = () => {
  const { 
    devices, 
    deviceLayouts, 
    updateLayout, 
    clearAllDevices, 
    cleanupInvalidDevices, 
    autoDetectDevices, 
    addDevice, 
    deletedTopics, 
    deviceFilters,
    getFilteredDevices,
    setDeviceFilters,
    getDevicesByType,
    getDevicesByRoom
  } = useDevices();
  const { connectionStatus, reconnectionStatus } = useMqtt();
  const { refreshDashboardConfig, saveDashboardConfig, user, getUserSetting } = useAuth();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filter devices based on user's MAC ID (except for admin users)
  const getFilteredDevicesForUser = () => {
    const allFilteredDevices = getFilteredDevices().filter(device => device.enabled !== false);
    
    if (user?.role === 'admin') {
      // Admin users see all devices
      return allFilteredDevices;
    } else {
      // Regular users only see devices matching their MAC ID
      const userMacId = getUserSetting('mac_address', '');
      if (!userMacId || userMacId.trim() === '') {
        return []; // No MAC ID set, show no devices
      }
      
      const userMacIdClean = userMacId.replace(/:/g, '').toLowerCase();
      return allFilteredDevices.filter(device => {
        if (!device || !device.topic) return false;
        
        const topicParts = device.topic.split('/');
        if (topicParts.length >= 1) {
          const topicUserMac = topicParts[0].toLowerCase();
          return topicUserMac === userMacIdClean;
        }
        return false;
      });
    }
  };

  // Use filtered devices for current user
  const filteredDevices = getFilteredDevicesForUser();
  const deviceList = filteredDevices;
  const onlineDevices = deviceList.filter(device => device.isOnline);
  const offlineDevices = deviceList.filter(device => !device.isOnline);

  // Default layouts for different breakpoints
  const layouts = {
    lg: deviceLayouts,
    md: deviceLayouts,
    sm: deviceLayouts.map(item => ({ ...item, w: Math.min(item.w, 2), x: item.x % 2 })),
    xs: deviceLayouts.map(item => ({ ...item, w: 1, x: 0 })),
    xxs: deviceLayouts.map(item => ({ ...item, w: 1, x: 0 }))
  };

  const timeoutRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-update layout when devices are enabled/disabled
  useEffect(() => {
    // When devices change (enabled/disabled), update the layout to ensure consistency
    const enabledDeviceIds = new Set(deviceList.map(device => device.id));
    const layoutDeviceIds = new Set(deviceLayouts.map(layout => layout.i));
    
    // Check if there's a mismatch between enabled devices and layout
    const hasLayoutMismatch = enabledDeviceIds.size !== layoutDeviceIds.size ||
                              [...enabledDeviceIds].some(id => !layoutDeviceIds.has(id));
    
    if (hasLayoutMismatch) {
      // Clean up layout to only include enabled devices
      const cleanedLayout = deviceLayouts.filter(layout => enabledDeviceIds.has(layout.i));
      
      // Add layout entries for enabled devices that don't have one
      const missingLayouts = [...enabledDeviceIds]
        .filter(id => !layoutDeviceIds.has(id))
        .map(id => ({
          i: id,
          x: 0,
          y: Infinity,
          w: 4,
          h: 4,
          minW: 2,
          maxW: 12,
          minH: 2,
          maxH: 8
        }));
      
      const updatedLayout = [...cleanedLayout, ...missingLayouts];
      
      if (updatedLayout.length !== deviceLayouts.length || 
          updatedLayout.some(item => !deviceLayouts.find(l => l.i === item.i))) {
        updateLayout(updatedLayout);
      }
    }
  }, [deviceList, deviceLayouts, updateLayout]);

  // Auto-save function with debouncing
  const autoSaveLayout = useCallback(async (layout) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save (500ms delay to avoid too frequent saves)
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      setSaveMessage('💾 Auto-saving layout...');

      try {
        // Update the layout in context
        updateLayout(layout);
        
        // Build the complete config object for saving using real context data
        const config = {
          devices,
          deviceLayouts: layout,
          deletedTopics: Array.from(deletedTopics || new Set()),
          deviceFilters: deviceFilters || {
            type: 'all',
            status: 'all',
            search: '',
            room: '',
            controllable: '',
            enabled: 'all'
          },
          lastUpdated: new Date().toISOString()
        };

        // Save to database
        const success = await saveDashboardConfig(config);
        
        if (success) {
          setSaveMessage('✅ Layout saved automatically!');
        } else {
          setSaveMessage('❌ Failed to auto-save layout');
        }
      } catch (error) {
        setSaveMessage('❌ Error auto-saving layout');
      } finally {
        setIsSaving(false);
        setTimeout(() => setSaveMessage(''), 2000);
      }
    }, 500);
  }, [devices, deletedTopics, deviceFilters, updateLayout, saveDashboardConfig]);

  const handleLayoutChange = useCallback((layout, layouts) => {
    if (layout && isEditMode) {
      // Auto-save the layout when changes are made
      autoSaveLayout(layout);
    }
  }, [isEditMode, autoSaveLayout]);

  const handleToggleEditMode = () => {
    setIsEditMode(!isEditMode);
    setSaveMessage('');
  };

  const getQuickStats = () => {
    const stats = {
      totalDevices: deviceList.length,
      onlineDevices: onlineDevices.length,
      offlineDevices: offlineDevices.length,
      temperature: 0,
      humidity: 0,
      alerts: 0
    };

    // Calculate average temperature and humidity
    const tempDevices = deviceList.filter(device => device.data?.Temp);
    const humidityDevices = deviceList.filter(device => device.data?.Humidity);
    
    if (tempDevices.length > 0) {
      stats.temperature = (tempDevices.reduce((sum, device) => sum + device.data.Temp, 0) / tempDevices.length).toFixed(1);
    }
    
    if (humidityDevices.length > 0) {
      stats.humidity = (humidityDevices.reduce((sum, device) => sum + device.data.Humidity, 0) / humidityDevices.length).toFixed(1);
    }

    // Count alerts (doors open, motion detected, etc.)
    stats.alerts = deviceList.filter(device => 
      device.data?.Door === 'Open' || 
      device.data?.Motion === 'Detected' ||
      device.data?.Status === 'Wet'
    ).length;

    return stats;
  };

  const stats = getQuickStats();

  const handleAutoDetect = async () => {
    const detectedDevices = autoDetectDevices();
    
    if (detectedDevices.length > 0) {
      for (let i = 0; i < detectedDevices.length; i++) {
        await addDevice(detectedDevices[i]);
      }
    }
  };

  // Check if there are any devices at all (not filtered)
  const totalDevices = Object.values(devices).filter(device => device.enabled !== false);
  
  // Show welcome screen only if there are no devices at all
  if (totalDevices.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-2 sm:px-0">
        <div className="text-center py-8 sm:py-12">
          <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 sm:mb-6">
            <Icon name="home" size={40} className="sm:w-12 sm:h-12 text-gray-400" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 px-4">
            Welcome to Your Smart Home Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 sm:mb-8 max-w-md mx-auto px-4 text-sm sm:text-base">
            Get started by adding your first device. You can manually add devices or use auto-detection to discover MQTT devices.
          </p>
          <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4 justify-center px-4">
            <button 
              className="btn btn-primary w-full sm:w-auto"
              onClick={() => window.location.href = '/devices'}
            >
              <Icon name="plus" size={20} className="mr-2" />
              Add Device
            </button>
            <button 
              className="btn btn-secondary w-full sm:w-auto"
              onClick={handleAutoDetect}
            >
              <Icon name="search" size={20} className="mr-2" />
              Auto-Detect Devices
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
            {deviceList.length} 
            {deviceList.length !== Object.values(devices).filter(device => device.enabled !== false).length 
              ? ` of ${Object.values(devices).filter(device => device.enabled !== false).length}` 
              : ''} 
            devices ({onlineDevices.length} online)
            {deviceList.length !== Object.values(devices).filter(device => device.enabled !== false).length && (
              <span className="ml-1 text-indigo-600 dark:text-indigo-400 text-xs">
                • filtered
              </span>
            )}
          </p>
        </div>
        
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
          {/* Connection Status Indicator */}
          <div className={`flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
            connectionStatus.connected 
              ? 'bg-success-100 dark:bg-success-900/30 text-success-800 dark:text-success-200'
              : reconnectionStatus.isReconnecting
              ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-800 dark:text-warning-200'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              connectionStatus.connected 
                ? 'bg-success-500 dark:bg-success-400'
                : reconnectionStatus.isReconnecting
                ? 'bg-warning-500 dark:bg-warning-400 animate-pulse'
                : 'bg-gray-400 dark:bg-gray-500'
            }`}></div>
            {connectionStatus.connected 
              ? 'MQTT Connected' 
              : reconnectionStatus.isReconnecting 
              ? `Reconnecting (${reconnectionStatus.currentRetries}/${reconnectionStatus.maxRetries})`
              : 'MQTT Disconnected'
            }
          </div>
          {/* Edit Mode Toggle */}
          <button
            onClick={handleToggleEditMode}
            className={`btn w-full sm:w-auto ${
              isEditMode 
                ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                : 'btn-secondary'
            }`}
            title={isEditMode ? 'Exit edit mode' : 'Enter edit mode to rearrange widgets'}
          >
            <Icon 
              name={isEditMode ? 'lock' : 'edit'} 
              size={20} 
              className="mr-2" 
            />
            {isEditMode ? 'Exit Edit' : 'Edit Layout'}
          </button>



        </div>
      </div>

      {/* Reconnection Warning Banner */}
      {reconnectionStatus.lastFailure && !reconnectionStatus.isReconnecting && !connectionStatus.connected && (
        <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
          <div className="flex items-center">
            <Icon name="wifi-off" size={20} className="mr-3 text-danger-600 dark:text-danger-400" />
            <div>
              <p className="text-danger-800 dark:text-danger-200 font-medium">
                MQTT Broker Bağlantısı Başarısız
              </p>
              <p className="text-danger-600 dark:text-danger-400 text-sm mt-1">
                {reconnectionStatus.maxRetries} deneme yapıldı ancak broker'a bağlanılamadı. 
                Lütfen bağlantı ayarlarınızı kontrol edin.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mode Info Banner */}
      {isEditMode && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Icon name="info" size={20} className="text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                Edit Mode Active
              </h3>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                You can now drag and resize widgets. Changes will be saved automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Save Notification - Top Right */}
      {saveMessage && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className={`px-3 py-2 rounded-lg shadow-lg ${
            saveMessage.includes('✅') 
              ? 'bg-green-500 text-white'
              : saveMessage.includes('💾')
              ? 'bg-blue-500 text-white'
              : 'bg-red-500 text-white'
          }`}>
            <div className="flex items-center space-x-2">
              <Icon 
                name={
                  saveMessage.includes('✅') ? 'check' : 
                  saveMessage.includes('💾') ? 'save' : 
                  'alert-circle'
                } 
                size={14} 
                className={saveMessage.includes('💾') ? 'animate-pulse' : ''}
              />
              <span className="text-xs font-medium">
                {saveMessage.includes('💾') ? 'Saving...' : 
                 saveMessage.includes('✅') ? 'Saved successfully' : 
                 'Save failed'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid mobile-grid-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="card p-3 sm:p-4">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
              <Icon name="home" size={16} className="sm:w-5 sm:h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Total</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                {stats.totalDevices}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-3 sm:p-4">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 bg-success-100 dark:bg-success-900 rounded-lg">
              <Icon name="check-circle" size={16} className="sm:w-5 sm:h-5 text-success-600 dark:text-success-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Online</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                {stats.onlineDevices}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-3 sm:p-4">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 bg-danger-100 dark:bg-danger-900 rounded-lg">
              <Icon name="alert-circle" size={16} className="sm:w-5 sm:h-5 text-danger-600 dark:text-danger-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Offline</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                {stats.offlineDevices}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-3 sm:p-4">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Icon name="thermometer" size={16} className="sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Temp</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                {stats.temperature}°C
              </p>
            </div>
          </div>
        </div>

        <div className="card p-3 sm:p-4">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 bg-cyan-100 dark:bg-cyan-900 rounded-lg">
              <Icon name="droplets" size={16} className="sm:w-5 sm:h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Humidity</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                {stats.humidity}%
              </p>
            </div>
          </div>
        </div>

        <div className="card p-3 sm:p-4">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Icon name="alert-triangle" size={16} className="sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Alerts</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                {stats.alerts}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Device Filters */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
            Device Overview
          </h2>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn btn-secondary text-sm"
          >
            <Icon name="filter" size={16} className="mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>

        {showFilters && (
          <div className="card p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search Devices
                </label>
                <div className="relative">
                  <Icon name="search" size={16} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by name, room, or topic..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={deviceFilters.search || ''}
                    onChange={(e) => setDeviceFilters({ ...deviceFilters, search: e.target.value })}
                  />
                </div>
              </div>

              {/* Device Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Device Type
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={deviceFilters.type || 'all'}
                  onChange={(e) => setDeviceFilters({ ...deviceFilters, type: e.target.value })}
                >
                  <option value="all">All Types</option>
                  {[...new Set(Object.values(devices).map(device => device.type).filter(Boolean))].map(type => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              {/* Room Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Room
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={deviceFilters.room || 'all'}
                  onChange={(e) => setDeviceFilters({ ...deviceFilters, room: e.target.value })}
                >
                  <option value="all">All Rooms</option>
                  {[...new Set(Object.values(devices).map(device => device.room).filter(Boolean))].map(room => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={deviceFilters.status || 'all'}
                  onChange={(e) => setDeviceFilters({ ...deviceFilters, status: e.target.value })}
                >
                  <option value="all">All Status</option>
                  <option value="online">Online Only</option>
                  <option value="offline">Offline Only</option>
                </select>
              </div>
            </div>

            {/* Active Filters Display */}
            {(deviceFilters.search || (deviceFilters.type && deviceFilters.type !== 'all') || (deviceFilters.room && deviceFilters.room !== 'all') || (deviceFilters.status && deviceFilters.status !== 'all')) && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Active filters:</span>
                    {deviceFilters.search && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        Search: "{deviceFilters.search}"
                        <button
                          onClick={() => setDeviceFilters({ ...deviceFilters, search: '' })}
                          className="ml-1 hover:text-blue-600 dark:hover:text-blue-300"
                        >
                          <Icon name="x" size={12} />
                        </button>
                      </span>
                    )}
                    {deviceFilters.type && deviceFilters.type !== 'all' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        Type: {deviceFilters.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        <button
                          onClick={() => setDeviceFilters({ ...deviceFilters, type: 'all' })}
                          className="ml-1 hover:text-green-600 dark:hover:text-green-300"
                        >
                          <Icon name="x" size={12} />
                        </button>
                      </span>
                    )}
                    {deviceFilters.room && deviceFilters.room !== 'all' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                        Room: {deviceFilters.room}
                        <button
                          onClick={() => setDeviceFilters({ ...deviceFilters, room: 'all' })}
                          className="ml-1 hover:text-purple-600 dark:hover:text-purple-300"
                        >
                          <Icon name="x" size={12} />
                        </button>
                      </span>
                    )}
                    {deviceFilters.status && deviceFilters.status !== 'all' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200">
                        Status: {deviceFilters.status}
                        <button
                          onClick={() => setDeviceFilters({ ...deviceFilters, status: 'all' })}
                          className="ml-1 hover:text-orange-600 dark:hover:text-orange-300"
                        >
                          <Icon name="x" size={12} />
                        </button>
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setDeviceFilters({ type: 'all', status: 'all', search: '', room: 'all', controllable: 'all', enabled: 'all' })}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            )}

            {/* Filter Results Summary */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {deviceList.length} of {Object.values(devices).filter(device => device.enabled !== false).length} devices
                {deviceList.length !== Object.values(devices).filter(device => device.enabled !== false).length && (
                  <span className="ml-1 text-indigo-600 dark:text-indigo-400">
                    (filtered)
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Device Grid */}
      <div className="mb-4">
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 }}
          rowHeight={80}
          margin={[4, 4]}
          containerPadding={[0, 0]}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          onLayoutChange={handleLayoutChange}
          compactType="vertical"
          preventCollision={false}
          useCSSTransforms={true}
          autoSize={true}
          resizeHandles={isEditMode && window.innerWidth >= 768 ? ['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne'] : []}
          allowOverlap={false}
          isBounded={true}
          transformScale={1}
          draggableHandle={isEditMode ? ".widget-card" : ""}
        >
          {deviceList.map((device) => {
            const layout = deviceLayouts.find(l => l.i === device.id);
            return (
              <div 
                key={device.id} 
                data-grid={{
                  i: device.id,
                  x: layout?.x || 0,
                  y: layout?.y || Infinity,
                  w: layout?.w || 6,
                  h: layout?.h || 6,
                  minW: 2,
                  maxW: 12,
                  minH: 2,
                  maxH: 8
                }}
                className="touch-manipulation"
              >
                <DeviceWidget device={device} isEditMode={isEditMode} />
              </div>
            );
          })}
        </ResponsiveGridLayout>

        {/* No Results Message */}
        {deviceList.length === 0 && totalDevices.length > 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <Icon name="search" size={24} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No devices found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No devices match your current filters. Try adjusting your search or filters.
            </p>
            <button
              onClick={() => setDeviceFilters({ type: 'all', status: 'all', search: '', room: 'all', controllable: 'all', enabled: 'all' })}
              className="btn btn-secondary text-sm"
            >
              <Icon name="x" size={16} className="mr-2" />
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 
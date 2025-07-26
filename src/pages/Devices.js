import React, { useState } from 'react';
import { useDevices } from '../contexts/DeviceContext';
import { useMqtt } from '../contexts/MqttContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import Icon from '../components/ui/Icon';

const Devices = () => {
  const { 
    devices, 
    deviceConfig, 
    addDevice, 
    removeDevice, 
    updateDevice,
    toggleDeviceEnabled,
    autoDetectDevices, 
    getFilteredDevices,
    deviceFilters,
    setDeviceFilters,
    clearAllDevices,
    cleanupInvalidDevices
  } = useDevices();
  const { connectionStatus, publishMessage, messages } = useMqtt();
  const { user, getUserSetting } = useAuth();
  const { showError, showWarning, showSuccess, showInfo } = useNotification();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState(new Set());
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [newDevice, setNewDevice] = useState({
    name: '',
    type: 'temperature_sensor',
    topic: '',
    room: 'Living Room'
  });
  const [editDevice, setEditDevice] = useState(null);

  // Filter devices based on user's MAC ID (except for admin users)
  const getFilteredDevicesForUser = () => {
    const allFilteredDevices = getFilteredDevices();
    
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

  const deviceList = getFilteredDevicesForUser();
  const deviceTypes = Object.keys(deviceConfig);
  const rooms = [...new Set(deviceList.filter(device => device && device.room).map(device => device.room))];
  
  // Device statistics - use filtered device list
  const totalDevices = deviceList.length;
  const onlineDevices = deviceList.filter(device => device.isOnline).length;
  const offlineDevices = totalDevices - onlineDevices;
  const devicesByType = deviceTypes.map(type => ({
    type,
    count: deviceList.filter(device => device.type === type).length,
    online: deviceList.filter(device => device.type === type && device.isOnline).length
  })).filter(stat => stat.count > 0);

  const handleAddDevice = async () => {
    if (newDevice.name && newDevice.topic) {
      await addDevice(newDevice);
      setNewDevice({
        name: '',
        type: 'temperature_sensor',
        topic: '',
        room: 'Living Room'
      });
      setShowAddModal(false);
      showSuccess('Cihaz başarıyla eklendi.');
    } else {
      showWarning('Cihaz adı veya MQTT konusu boş bırakılamaz.');
    }
  };

  const handleEditDevice = (device) => {
    setEditDevice({
      id: device.id,
      name: device.name,
      type: device.type,
      topic: device.topic,
      room: device.room
    });
    setShowEditModal(true);
  };

  const handleSaveEditDevice = async () => {
    if (editDevice && editDevice.name && editDevice.topic) {
      // Update the device using the updateDevice function from context
      await updateDevice(editDevice.id, {
        name: editDevice.name,
        type: editDevice.type,
        topic: editDevice.topic,
        room: editDevice.room,
        icon: deviceConfig[editDevice.type]?.icon || 'alert-circle',
        controllable: deviceConfig[editDevice.type]?.controllable || false,
        config: deviceConfig[editDevice.type] || {}
      });
      
      setEditDevice(null);
      setShowEditModal(false);
      showSuccess('Cihaz başarıyla güncellendi.');
    } else {
      showWarning('Cihaz adı veya MQTT konusu boş bırakılamaz.');
    }
  };

  const handleAutoDetect = async () => {
    const detectedDevices = autoDetectDevices();
    
    if (user?.role === 'admin') {
      // Admin users can add all detected devices
      if (detectedDevices.length > 0) {
        for (let i = 0; i < detectedDevices.length; i++) {
          await addDevice(detectedDevices[i]);
        }
        showSuccess(`${detectedDevices.length} cihaz başarıyla eklendi.`);
      }
    } else {
      // Regular users can only add devices matching their MAC ID
      const userMacId = getUserSetting('mac_address', '');
      if (!userMacId || userMacId.trim() === '') {
        showError('MAC adresi boş! Lütfen önce Config sayfasından MAC adresinizi girin.');
        return;
      }
      
      const userMacIdClean = userMacId.replace(/:/g, '').toLowerCase();
      console.log('User MAC ID:', userMacIdClean);
      console.log('Detected devices:', detectedDevices);
      
      // Filter newly detected devices
      const filteredNewDevices = detectedDevices.filter(device => {
        if (!device || !device.topic) return false;
        
        const topicParts = device.topic.split('/');
        console.log('Device topic:', device.topic, 'Parts:', topicParts);
        
        if (topicParts.length >= 1) {
          const topicUserMac = topicParts[0].toLowerCase();
          console.log('Topic MAC:', topicUserMac, 'User MAC:', userMacIdClean, 'Match:', topicUserMac === userMacIdClean);
          return topicUserMac === userMacIdClean;
        }
        return false;
      });
      
      // Also check existing devices that match the MAC ID
      const existingMatchingDevices = Object.values(devices).filter(device => {
        if (!device || !device.topic) return false;
        
        const topicParts = device.topic.split('/');
        if (topicParts.length >= 1) {
          const topicUserMac = topicParts[0].toLowerCase();
          return topicUserMac === userMacIdClean;
        }
        return false;
      });
      
      // Check MQTT messages for devices matching the MAC ID
      const messageTopics = new Set();
      messages.forEach(msg => {
        if (msg.topic && !msg.topic.endsWith('_send')) {
          const topicParts = msg.topic.split('/');
          if (topicParts.length >= 1) {
            const topicUserMac = topicParts[0].toLowerCase();
            if (topicUserMac === userMacIdClean) {
              messageTopics.add(msg.topic);
            }
          }
        }
      });
      
      console.log('MQTT message topics matching MAC ID:', Array.from(messageTopics));
      
      // Create devices from MQTT messages that aren't already added
      const messageDevices = [];
      messageTopics.forEach(topic => {
        const existingDevice = Object.values(devices).find(device => device.topic === topic);
        if (!existingDevice) {
          const topicParts = topic.split('/');
          const deviceType = topicParts[topicParts.length - 1] || 'unknown';
          
          // Determine device type based on topic
          let detectedType = 'relay';
          let deviceName = 'Smart Relay';
          
          if (deviceType.includes('temp') || deviceType.includes('temperature')) {
            detectedType = 'temperature_sensor';
            deviceName = 'Temperature Sensor';
          } else if (deviceType.includes('door') || deviceType.includes('contact')) {
            detectedType = 'door_sensor';
            deviceName = 'Door Sensor';
          } else if (deviceType.includes('motion') || deviceType.includes('pir')) {
            detectedType = 'motion_sensor';
            deviceName = 'Motion Sensor';
          } else if (deviceType.includes('relay') || deviceType.includes('light') || deviceType.includes('switch')) {
            detectedType = 'relay';
            deviceName = 'Smart Relay';
          }
          
          messageDevices.push({
            name: `${deviceName} (${deviceType})`,
            type: detectedType,
            topic: topic,
            room: 'General'
          });
        }
      });
      
      console.log('Filtered new devices:', filteredNewDevices);
      console.log('Existing matching devices:', existingMatchingDevices);
      console.log('Message-based devices:', messageDevices);
      
      // Add new devices from auto-detect
      let addedCount = 0;
      if (filteredNewDevices.length > 0) {
        for (let i = 0; i < filteredNewDevices.length; i++) {
          await addDevice(filteredNewDevices[i]);
          addedCount++;
        }
      }
      
      // Add devices from MQTT messages
      if (messageDevices.length > 0) {
        for (let i = 0; i < messageDevices.length; i++) {
          await addDevice(messageDevices[i]);
          addedCount++;
        }
      }
      
      if (addedCount > 0) {
        showSuccess(`${addedCount} cihaz başarıyla eklendi.`);
      } else if (existingMatchingDevices.length > 0) {
        showInfo(`${existingMatchingDevices.length} cihaz zaten mevcut. Yeni cihaz tespit edilmedi.`);
      } else {
        showWarning(`MAC adresinizle eşleşen cihaz bulunamadı. (Aranan: ${userMacIdClean})`);
      }
    }
  };

  const handleRemoveDevice = async (deviceId) => {
    if (window.confirm('Bu cihazı kaldırmak istediğinizden emin misiniz?')) {
      // Immediate remove without delay for better UX
      await removeDevice(deviceId);
      setSelectedDevices(prev => {
        const newSet = new Set(prev);
        newSet.delete(deviceId);
        return newSet;
      });
      showSuccess('Cihaz başarıyla kaldırıldı.');
    }
  };

  const handleSelectDevice = (deviceId) => {
    setSelectedDevices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deviceId)) {
        newSet.delete(deviceId);
      } else {
        newSet.add(deviceId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedDevices.size === deviceList.length) {
      setSelectedDevices(new Set());
    } else {
      setSelectedDevices(new Set(deviceList.map(device => device.id)));
    }
  };

  const handleBulkAction = async (action) => {
    if (action === 'remove' && selectedDevices.size > 0) {
      if (window.confirm(`${selectedDevices.size} seçili cihazı kaldırmak istediğinizden emin misiniz?`)) {
        // Immediate bulk remove without delay for better UX
        await Promise.all(Array.from(selectedDevices).map(deviceId => removeDevice(deviceId)));
        setSelectedDevices(new Set());
        showSuccess(`${selectedDevices.size} cihaz başarıyla kaldırıldı.`);
      }
    }
  };

  const getDeviceTypeIcon = (type) => {
    return deviceConfig[type]?.icon || 'alert-circle';
  };

  const getDeviceTypeName = (type) => {
    return deviceConfig[type]?.name || type;
  };

  const getStatusColor = (isOnline) => {
    return isOnline ? 'text-success-600 dark:text-success-400' : 'text-gray-400 dark:text-gray-500';
  };

  const getStatusBgColor = (isOnline) => {
    return isOnline ? 'bg-success-100 dark:bg-success-900' : 'bg-gray-100 dark:bg-gray-700';
  };

  const handleCleanupInvalidDevices = () => {
    cleanupInvalidDevices();
    showInfo('Geçersiz cihazlar temizlendi.');
  };



  const handleSendTestMessage = () => {
    if (!connectionStatus.connected) {
      showError('MQTT bağlantısı yok! Lütfen önce MQTT broker\'a bağlanın.');
      return;
    }
    
    const testTopics = [
      {
        topic: 'home/livingroom/temperature',
        payload: { Temp: 22.5, Humidity: 65 }
      },
      {
        topic: 'home/kitchen/motion', 
        payload: { Motion: 'Detected', LastSeen: new Date().toISOString() }
      },
      {
        topic: 'home/frontdoor/door',
        payload: { Door: 'Closed', Battery: 95 }
      }
    ];

    testTopics.forEach(test => {
      publishMessage(test.topic, test.payload, 0);
    });

    showInfo(`${testTopics.length} test mesajı gönderildi. Birkaç saniye sonra auto-detect\'i kontrol edin!`);
  };

  const handleClearAllDevices = () => {
    if (window.confirm('Tüm cihazları silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
      clearAllDevices();
      setSelectedDevices(new Set());
      showSuccess('Tüm cihazlar sistemden ve depolamadan temizlendi.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Header with Actions */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Devices
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
            Manage your smart home devices
          </p>
        </div>
        
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3">
          {/* View Mode Toggle - Hidden on mobile */}
          <div className="hidden sm:flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <Icon name="grid-3x3" size={16} className="mr-1.5" />
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <Icon name="list" size={16} className="mr-1.5" />
              List
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary w-full sm:w-auto"
          >
            <Icon name="plus" size={18} className="mr-2" />
            Add Device
          </button>
          
          <button
            onClick={handleAutoDetect}
            className="btn btn-secondary w-full sm:w-auto"
          >
            <Icon name="search" size={18} className="mr-2" />
            Auto-Detect
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid mobile-grid-4 gap-3 sm:gap-4">
        <div className="card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
              <Icon name="home" size={20} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Devices</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {totalDevices}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-success-100 dark:bg-success-900 rounded-lg">
              <Icon name="check-circle" size={20} className="text-success-600 dark:text-success-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Online</p>
              <p className="text-xl font-semibold text-success-600 dark:text-success-400">
                {onlineDevices}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-danger-100 dark:bg-danger-900 rounded-lg">
              <Icon name="alert-circle" size={20} className="text-danger-600 dark:text-danger-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Offline</p>
              <p className="text-xl font-semibold text-danger-600 dark:text-danger-400">
                {offlineDevices}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Icon name="filter" size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Filtered</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {deviceList.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Device Types Quick Selection */}
      {devicesByType.length > 0 && (
        <div className="card p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Device Types
          </h3>
          <div className="grid mobile-grid-3 gap-3 sm:gap-4">
            <button
              onClick={() => setDeviceFilters({ ...deviceFilters, type: 'all' })}
              className={`p-3 sm:p-4 rounded-lg border-2 transition-colors ${
                deviceFilters.type === 'all' 
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <Icon name="grid-3x3" size={20} className="mx-auto mb-2 text-gray-600 dark:text-gray-400" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">All</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{totalDevices} devices</p>
            </button>
            
            {devicesByType.map(({ type, count, online }) => (
              <button
                key={type}
                onClick={() => setDeviceFilters({ ...deviceFilters, type })}
                className={`p-3 sm:p-4 rounded-lg border-2 transition-colors ${
                  deviceFilters.type === type 
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <Icon 
                  name={getDeviceTypeIcon(type)} 
                  size={20} 
                  className="mx-auto mb-2 text-gray-600 dark:text-gray-400" 
                />
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {getDeviceTypeName(type)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {count} total • {online} online
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters and Controls */}
      <div className="card p-4 sm:p-6">
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0 mb-6">
          <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Connected Devices ({deviceList.length})
            </h3>
            {selectedDevices.size > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedDevices.size} selected
                </span>
                <button
                  onClick={() => handleBulkAction('remove')}
                  className="text-sm text-danger-600 hover:text-danger-700 dark:text-danger-400 touch-manipulation"
                >
                  Remove Selected
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between sm:justify-end space-x-3">
            <button
              onClick={handleSelectAll}
              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 touch-manipulation"
            >
              {selectedDevices.size === deviceList.length ? 'Deselect All' : 'Select All'}
            </button>
            
            {/* View Mode Toggle - Show on mobile too */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors touch-manipulation ${
                  viewMode === 'grid' 
                    ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Icon name="grid-3x3" size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors touch-manipulation ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Icon name="list" size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="grid mobile-grid-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search
            </label>
            <div className="relative">
              <Icon name="search" size={16} className="absolute left-3 top-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search devices..."
                className="input pl-10"
                value={deviceFilters.search}
                onChange={(e) => setDeviceFilters({ ...deviceFilters, search: e.target.value })}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              className="select"
              value={deviceFilters.status}
              onChange={(e) => setDeviceFilters({ ...deviceFilters, status: e.target.value })}
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Room
            </label>
            <select
              className="select"
              value={deviceFilters.room || 'all'}
              onChange={(e) => setDeviceFilters({ ...deviceFilters, room: e.target.value === 'all' ? '' : e.target.value })}
            >
              <option value="all">All Rooms</option>
              {rooms.map(room => (
                <option key={room} value={room}>
                  {room}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type
            </label>
            <select
              className="select"
              value={deviceFilters.type || 'all'}
              onChange={(e) => setDeviceFilters({ ...deviceFilters, type: e.target.value === 'all' ? '' : e.target.value })}
            >
              <option value="all">All Types</option>
              {deviceTypes.map(type => (
                <option key={type} value={type}>
                  {getDeviceTypeName(type)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Device List/Grid */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
        {deviceList.map((device) => (
          <div 
            key={device.id}
            data-device-id={device.id}
            className={`card p-6 cursor-pointer transition-all ${
              selectedDevices.has(device.id) 
                ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900' 
                : 'hover:shadow-lg'
            }`}
            onClick={() => handleSelectDevice(device.id)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`
                  p-3 rounded-lg transition-colors
                  ${getStatusBgColor(device.isOnline)}
                `}>
                  <Icon 
                    name={device.icon || 'alert-circle'} 
                    size={24} 
                    className={getStatusColor(device.isOnline)}
                  />
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {device.name || 'Unknown Device'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {device.room || 'Unknown Room'} • {getDeviceTypeName(device.type || 'unknown')}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className={`
                  status-indicator
                  ${device.isOnline ? 'status-success' : 'status-gray'}
                `}>
                  {device.isOnline ? 'Online' : 'Offline'}
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditDevice(device);
                  }}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-primary-600"
                  title="Edit device"
                >
                  <Icon name="edit" size={16} />
                </button>
                
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await toggleDeviceEnabled(device.id);
                  }}
                  className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    device.enabled ? 'text-success-600' : 'text-gray-400'
                  }`}
                  title={device.enabled ? 'Disable device' : 'Enable device'}
                >
                  <Icon name={device.enabled ? "check-circle" : "pause-circle"} size={16} />
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveDevice(device.id);
                  }}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-danger-600"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Topic:</span>
                <span className="font-mono text-gray-900 dark:text-white text-xs break-all">
                  {device.topic || 'No topic'}
                </span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Controllable:</span>
                <span className="text-gray-900 dark:text-white">
                  {device.controllable ? (
                    <span className="text-success-600 dark:text-success-400">Yes</span>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">No</span>
                  )}
                </span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Status:</span>
                <span className="text-gray-900 dark:text-white">
                  {device.enabled ? (
                    <span className="text-success-600 dark:text-success-400">Enabled</span>
                  ) : (
                    <span className="text-warning-600 dark:text-warning-400">Disabled</span>
                  )}
                </span>
              </div>
              
              {device.lastUpdated && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Last Updated:</span>
                  <span className="text-gray-900 dark:text-white">
                    {new Date(device.lastUpdated).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {device.data && Object.keys(device.data).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Data
                </h4>
                <div className="space-y-1">
                  {Object.entries(device.data).slice(0, 3).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">{key}:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {typeof value === 'object' ? JSON.stringify(value) : value.toString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {deviceList.length === 0 && (
        <div className="text-center py-12">
          <Icon name="search" size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No devices found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Try adjusting your filters or add a new device.
          </p>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add New Device
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Device Name
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Living Room Temperature"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Device Type
                </label>
                <select
                  className="select"
                  value={newDevice.type}
                  onChange={(e) => setNewDevice({ ...newDevice, type: e.target.value })}
                >
                  {deviceTypes.map(type => (
                    <option key={type} value={type}>
                      {getDeviceTypeName(type)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  MQTT Topic
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="home/livingroom/temp"
                  value={newDevice.topic}
                  onChange={(e) => setNewDevice({ ...newDevice, topic: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Room
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Living Room"
                  value={newDevice.room}
                  onChange={(e) => setNewDevice({ ...newDevice, room: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDevice}
                className="btn btn-primary"
                disabled={!newDevice.name || !newDevice.topic}
              >
                Add Device
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit Device
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditDevice(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Device Name
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Living Room Temperature"
                  value={editDevice.name}
                  onChange={(e) => setEditDevice({ ...editDevice, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Device Type
                </label>
                <select
                  className="select"
                  value={editDevice.type}
                  onChange={(e) => setEditDevice({ ...editDevice, type: e.target.value })}
                >
                  {deviceTypes.map(type => (
                    <option key={type} value={type}>
                      {getDeviceTypeName(type)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  MQTT Topic
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="home/livingroom/temp"
                  value={editDevice.topic}
                  onChange={(e) => setEditDevice({ ...editDevice, topic: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Room
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Living Room"
                  value={editDevice.room}
                  onChange={(e) => setEditDevice({ ...editDevice, room: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditDevice(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditDevice}
                className="btn btn-primary"
                disabled={!editDevice.name || !editDevice.topic}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Floating clean buttons */}
      <div className="fixed bottom-4 right-4 flex flex-col space-y-2 z-40">
        <button
          onClick={handleCleanupInvalidDevices}
          className="btn btn-warning btn-sm text-xs px-2 py-1"
          title="Clean up null/invalid devices"
        >
          <Icon name="filter" size={14} className="mr-1" />
          Clean
        </button>

        <button
          onClick={handleClearAllDevices}
          className="btn btn-danger btn-sm text-xs px-2 py-1"
          title="Clear all devices and storage"
        >
          <Icon name="trash-2" size={14} className="mr-1" />
          Clear All
        </button>
      </div>
    </div>
  );
};

export default Devices; 
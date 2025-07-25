import React, { useState, useRef } from 'react';
import { useDevices } from '../../contexts/DeviceContext';
import Icon from '../ui/Icon';

const DeviceWidget = ({ device, isEditMode = false }) => {
  const { controlDevice, removeDevice } = useDevices();
  const [showControls, setShowControls] = useState(false);
  // Timer state
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerMs, setTimerMs] = useState(1000);
  const [countdown, setCountdown] = useState(null); // ms left
  const timerRef = useRef(null);
  
  // Don't render disabled devices
  if (device.enabled === false) {
    return null;
  }

  const getStatusColor = (key, value) => {
    const states = device.config?.states?.[key];
    if (states && states[value]) {
      return states[value].color;
    }
    
    // Default color based on value type
    if (typeof value === 'boolean') {
      return value ? 'success' : 'gray';
    }
    
    return 'primary';
  };

  const getStatusIcon = (key, value) => {
    const states = device.config?.states?.[key];
    if (states && states[value]) {
      return states[value].icon;
    }
    
    return device.icon;
  };

  const formatValue = (key, value) => {
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    if (typeof value === 'number') {
      const unit = device.config?.units?.[key] || device.config?.unit;
      return unit ? `${value} ${unit}` : value.toString();
    }
    
    if (key === 'LastSeen' || key === 'LastCheck') {
      try {
        return new Date(value).toLocaleString();
      } catch {
        return value;
      }
    }
    
    return value.toString();
  };

  const handleControl = (controlKey, value) => {
    const controlData = { [controlKey]: value };
    controlDevice(device.id, controlData);
  };

  // Timer handler for toggle controls
  const handleToggleWithTimer = (controlKey, control, currentValue) => {
    if (!timerEnabled) {
      // Normal instant control
      const newValue = control.states[0] === currentValue 
        ? control.states[1] 
        : control.states[0];
      handleControl(controlKey, newValue);
      return;
    }
    // If timer is enabled, start countdown and schedule control
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCountdown(timerMs);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(timerMs - elapsed, 0);
      setCountdown(left);
      if (left <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setCountdown(null);
        // Toggle after timer
        const newValue = control.states[0] === currentValue 
          ? control.states[1] 
          : control.states[0];
        handleControl(controlKey, newValue);
      }
    }, 100);
  };

  const renderControls = () => {
    if (!device.controllable || !device.config?.controls) return null;

    return (
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        {/* Timer Toggle UI */}
        <div className="flex items-center mb-2">
          <label className="flex items-center cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
            <span className="mr-2">Enable Timer</span>
            <span className="relative inline-block w-10 align-middle select-none transition duration-200 ease-in">
              <input
                type="checkbox"
                checked={timerEnabled}
                onChange={e => setTimerEnabled(e.target.checked)}
                className="absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{ left: timerEnabled ? '1.5rem' : '0', transition: 'left 0.2s' }}
              />
              <span
                className={`block overflow-hidden h-6 rounded-full bg-gray-300 dark:bg-gray-600 cursor-pointer transition-colors duration-200 ${timerEnabled ? 'bg-blue-500' : ''}`}
              ></span>
            </span>
          </label>
          {timerEnabled && (
            <div className="flex items-center ml-4">
              <input
                type="number"
                min={100}
                step={100}
                value={timerMs}
                onChange={e => setTimerMs(Number(e.target.value))}
                className="px-2 py-1 w-28 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="ms"
              />
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">ms</span>
            </div>
          )}
          {countdown !== null && (
            <span className="ml-4 text-xs text-blue-600 dark:text-blue-300">{Math.ceil(countdown / 1000 * 10) / 10}s</span>
          )}
        </div>
        {/* End Timer Toggle UI */}
        <div className="space-y-3">
          {Object.entries(device.config.controls).map(([key, control]) => (
            <div key={key} className="flex items-center justify-between space-x-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex-1">
                {key}
              </span>
              
              {control.type === 'toggle' && (
                <button
                  onClick={() => handleToggleWithTimer(key, control, device.data[key])}
                  className={
                    `px-3 py-1.5 rounded text-xs font-medium transition-colors flex-shrink-0 touch-manipulation min-h-8
                    ${getStatusColor(key, device.data[key]) === 'success' 
                      ? 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`
                  }
                  disabled={countdown !== null}
                >
                  {device.data[key] || control.states[1]}
                </button>
              )}
              
              {control.type === 'slider' && (
                <input
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step || 1}
                  value={device.data[key] || control.min}
                  onChange={(e) => handleControl(key, parseFloat(e.target.value))}
                  className="w-16 sm:w-20 h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 flex-shrink-0 touch-manipulation"
                />
              )}
              
              {control.type === 'select' && (
                <select
                  value={device.data[key] || control.options[0]}
                  onChange={(e) => handleControl(key, e.target.value)}
                  className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex-shrink-0 touch-manipulation min-h-8"
                >
                  {control.options.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getTimeSince = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  // Helper to get WiFi signal icon and color based on RSSI value
  const getWifiIconAndColor = (rssiRaw) => {
    const rssi = Number(rssiRaw);
    if (isNaN(rssi)) return { icon: 'wifi-off', color: 'text-gray-400 dark:text-gray-600' };
    if (rssi >= -60) return { icon: 'wifi', color: 'text-green-500 dark:text-green-400' };
    if (rssi >= -75) return { icon: 'wifi', color: 'text-yellow-500 dark:text-yellow-400' };
    if (rssi >= -90) return { icon: 'wifi', color: 'text-red-500 dark:text-red-400' };
    return { icon: 'wifi-off', color: 'text-gray-400 dark:text-gray-600' };
  };

  // Get responsive grid columns based on widget size
  const getDataGridClass = () => {
    const dataCount = device.data ? Object.keys(device.data).length : 0;
    if (dataCount <= 2) return 'grid-cols-1';
    if (dataCount <= 4) return 'grid-cols-2';
    return 'grid-cols-2 sm:grid-cols-3';
  };

  return (
    <div className={`widget-card h-full ${isEditMode ? 'edit-mode' : ''}`}>
      {/* Edit Mode Indicator */}
      {isEditMode && (
        <div className="absolute top-2 right-2 z-10 bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-medium">
          <Icon name="move" size={12} className="inline mr-1" />
          EDIT
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between mb-3 flex-shrink-0">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <div className={`
            p-1.5 sm:p-2 rounded-lg flex-shrink-0
            ${device.isOnline 
              ? 'bg-success-100 dark:bg-success-900' 
              : 'bg-gray-100 dark:bg-gray-700'
            }
          `}>
            <Icon 
              name={device.icon} 
              size={18} 
              className={`
                ${device.isOnline 
                  ? 'text-success-600 dark:text-success-400' 
                  : 'text-gray-400 dark:text-gray-500'
                }
              `}
            />
          </div>
          
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base leading-tight truncate">
              {device.name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {device.room} • {device.config?.name || device.type}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1 flex-shrink-0">
          {/* WiFi Signal Icon */}
          {typeof device.data?.RSSI !== 'undefined' && (
            (() => {
              // Debug log for RSSI value and type
              console.log('DeviceWidget RSSI:', device.data?.RSSI, typeof device.data?.RSSI);
              const { icon, color } = getWifiIconAndColor(device.data?.RSSI);
              console.log('DeviceWidget WiFi icon/color:', icon, color);
              // Always render the Icon if RSSI is defined
              return (
                <Icon
                  name={icon || 'wifi-off'}
                  size={18}
                  className={color + ' mr-1'}
                />
              );
            })()
          )}
          <div className={`
            px-2 py-1 rounded text-xs font-medium
            ${device.isOnline ? 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}
          `}>
            {device.isOnline ? 'On' : 'Off'}
          </div>
          
          <button
            onClick={() => setShowControls(!showControls)}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0 touch-manipulation"
            aria-label="Device settings"
          >
            <Icon name="settings" size={14} />
          </button>
        </div>
      </div>

      {/* Device Data - Responsive grid without scrollbars */}
      {device.data && Object.keys(device.data).length > 0 && (
        <div className="flex-1 min-h-0">
          <div className={`grid ${getDataGridClass()} gap-2 h-full`}>
            {Object.entries(device.data)
              .filter(([key]) => key.trim().toLowerCase() !== 'humudity' && key.trim().toLowerCase() !== 'rssi')
              .map(([key, value]) => (
                <div key={key} className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg flex flex-col justify-center min-h-0">
                  <div className="flex items-center justify-center space-x-1 mb-1">
                    <Icon 
                      name={getStatusIcon(key, value)} 
                      size={14} 
                      className={`
                        flex-shrink-0
                        ${getStatusColor(key, value) === 'success' && 'text-success-600 dark:text-success-400'}
                        ${getStatusColor(key, value) === 'warning' && 'text-warning-600 dark:text-warning-400'}
                        ${getStatusColor(key, value) === 'danger' && 'text-danger-600 dark:text-danger-400'}
                        ${getStatusColor(key, value) === 'primary' && 'text-primary-600 dark:text-primary-400'}
                        ${getStatusColor(key, value) === 'gray' && 'text-gray-600 dark:text-gray-400'}
                      `}
                    />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate">
                      {key}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white leading-tight break-words">
                    {formatValue(key, value)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Controls */}
      {showControls && renderControls()}

      {/* Footer */}
      <div className="mt-auto pt-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span className="truncate">{getTimeSince(device.lastUpdated)}</span>
          <span className="truncate text-right ml-2" title={device.topic}>{device.topic.split('/').pop()}</span>
        </div>
      </div>
    </div>
  );
};

export default DeviceWidget; 
import React, { useState, useEffect } from 'react';
import Icon from '../ui/Icon';
import Notification from '../ui/Notification';
import sensorFormats from '../../config/message-formats.json';

const SensorManager = () => {
  const [sensors, setSensors] = useState({});
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadSensorFormats();
  }, []);

  const loadSensorFormats = () => {
    setSensors(sensorFormats);
    setLoading(false);
  };

  const openSensorModal = (sensorKey, sensorData) => {
    setSelectedSensor({ key: sensorKey, ...sensorData });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedSensor(null);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
  };

  const getSensorIcon = (sensorType) => {
    const iconMap = {
      temperature_sensor: 'thermometer',
      door_sensor: 'door-open',
      relay: 'zap',
      motion_sensor: 'activity',
      distance_sensor: 'ruler',
      smart_thermostat: 'thermometer-snowflake',
      air_quality: 'wind',
      security_camera: 'video',
      smart_lock: 'lock',
      water_leak_sensor: 'droplets',
      light_sensor: 'sun',
      smoke_detector: 'flame',
      gas_sensor: 'alert-triangle',
      soil_moisture: 'sprout',
      wind_sensor: 'wind',
      rain_sensor: 'cloud-rain'
    };
    return iconMap[sensorType] || 'sensor';
  };

  const getSensorCategory = (sensorType) => {
    const categoryMap = {
      temperature_sensor: 'environmental',
      door_sensor: 'security',
      relay: 'control',
      motion_sensor: 'security',
      distance_sensor: 'environmental',
      smart_thermostat: 'climate',
      air_quality: 'environmental',
      security_camera: 'security',
      smart_lock: 'security',
      water_leak_sensor: 'safety',
      light_sensor: 'environmental',
      smoke_detector: 'safety',
      gas_sensor: 'safety',
      soil_moisture: 'garden',
      wind_sensor: 'weather',
      rain_sensor: 'weather'
    };
    return categoryMap[sensorType] || 'other';
  };

  const getCategoryColor = (category) => {
    const colorMap = {
      environmental: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      security: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      control: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      climate: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      safety: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
      garden: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400',
      weather: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400',
      other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    };
    return colorMap[category] || colorMap.other;
  };

  const filteredSensors = Object.entries(sensors).filter(([key, sensor]) => {
    const matchesSearch = sensor.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         key.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || getSensorCategory(key) === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', 'environmental', 'security', 'control', 'climate', 'safety', 'garden', 'weather'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading sensors...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Sensor Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Browse and configure available sensor types for your smart home system
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {Object.keys(sensors).length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Available Sensors
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Icon name="search" size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search sensors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="sm:w-48">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sensor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredSensors.map(([key, sensor]) => {
          const category = getSensorCategory(key);
          return (
            <div
              key={key}
              onClick={() => openSensorModal(key, sensor)}
              className="card p-4 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50 transition-colors">
                  <Icon name={getSensorIcon(key)} size={24} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(category)}`}>
                  {category}
                </span>
              </div>
              
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {sensor.description}
              </h3>
              
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center">
                  <Icon name="message-square" size={14} className="mr-2" />
                  <span className="truncate">{sensor.topic}</span>
                </div>
                <div className="flex items-center">
                  <Icon name="send" size={14} className="mr-2" />
                  <span className="truncate">{sensor.send_topic}</span>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Fields: {Object.keys(sensor.message).length}</span>
                  <span>Optional: {Object.keys(sensor.optional_fields || {}).length}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredSensors.length === 0 && (
        <div className="text-center py-12">
          <Icon name="search" size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No sensors found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your search terms or filter criteria
          </p>
        </div>
      )}

      {/* Sensor Detail Modal */}
      {showModal && selectedSensor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg mr-4">
                    <Icon name={getSensorIcon(selectedSensor.key)} size={32} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {selectedSensor.description}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Sensor Type: {selectedSensor.key}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Icon name="x" size={24} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Topic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="card p-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                    <Icon name="message-square" size={16} className="mr-2" />
                    Subscribe Topic
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                    <code className="text-sm text-gray-900 dark:text-white font-mono break-all">
                      {selectedSensor.topic}
                    </code>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    Topic to listen for sensor data
                  </p>
                </div>

                <div className="card p-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                    <Icon name="send" size={16} className="mr-2" />
                    Publish Topic
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                    <code className="text-sm text-gray-900 dark:text-white font-mono break-all">
                      {selectedSensor.send_topic}
                    </code>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    Topic to send commands to sensor
                  </p>
                </div>
              </div>

              {/* Message Format */}
              <div className="space-y-4">
                <div className="card p-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                    <Icon name="file-text" size={16} className="mr-2" />
                    Required Message Fields
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
                    <pre className="text-sm text-gray-900 dark:text-white overflow-x-auto">
                      <code>{JSON.stringify(selectedSensor.message, null, 2)}</code>
                    </pre>
                  </div>
                </div>

                {selectedSensor.optional_fields && Object.keys(selectedSensor.optional_fields).length > 0 && (
                  <div className="card p-4">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                      <Icon name="plus-circle" size={16} className="mr-2" />
                      Optional Message Fields
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
                      <pre className="text-sm text-gray-900 dark:text-white overflow-x-auto">
                        <code>{JSON.stringify(selectedSensor.optional_fields, null, 2)}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Usage Instructions */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center">
                  <Icon name="info" size={16} className="mr-2" />
                  Usage Instructions
                </h3>
                <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                  <p>• Replace <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{room}'}</code> in topics with your room name</p>
                  <p>• Send JSON messages in the exact format shown above</p>
                  <p>• Optional fields can be omitted if not needed</p>
                  <p>• Ensure your MQTT broker is configured and connected</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Close
                </button>
                                  <button
                    onClick={async () => {
                      try {
                        const config = {
                          type: selectedSensor.key,
                          topic: selectedSensor.topic,
                          send_topic: selectedSensor.send_topic,
                          message_format: selectedSensor.message,
                          optional_fields: selectedSensor.optional_fields
                        };
                        await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
                        showNotification('Sensor configuration copied to clipboard!', 'success');
                      } catch (error) {
                        showNotification('Failed to copy configuration', 'error');
                      }
                    }}
                    className="btn btn-primary"
                  >
                    <Icon name="copy" size={16} className="mr-2" />
                    Copy Configuration
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SensorManager; 
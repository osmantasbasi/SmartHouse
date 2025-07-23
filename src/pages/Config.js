import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDevices } from '../contexts/DeviceContext';

const Config = () => {
  const { saveUserSetting, getUserSetting } = useAuth();
  const { autoDetectDevices } = useDevices();
  const [mac, setMac] = useState('');
  const [saved, setSaved] = useState(false);
  const [detected, setDetected] = useState([]);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    const currentMac = getUserSetting('config_mac_id', '');
    setMac(currentMac);
  }, [getUserSetting]);

  const handleSave = async (e) => {
    e.preventDefault();
    await saveUserSetting('config_mac_id', mac);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleAutoDetect = async () => {
    setDetecting(true);
    const allDetected = autoDetectDevices();
    const filtered = allDetected.filter(device => device.topic.startsWith(mac + '/'));
    setDetected(filtered);
    setDetecting(false);
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white dark:bg-gray-800 rounded shadow">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Config Ayarları</h2>
      <form onSubmit={handleSave}>
        <label className="block mb-2 text-gray-700 dark:text-gray-300">Kullanıcı MAC Adresi</label>
        <input
          type="text"
          value={mac}
          onChange={e => setMac(e.target.value)}
          className="w-full px-3 py-2 border rounded mb-4 focus:outline-none focus:ring focus:border-blue-300 dark:bg-gray-700 dark:text-white"
          placeholder="Örn: AA:BB:CC:DD:EE:FF"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition mb-2"
        >
          Kaydet
        </button>
      </form>
      <button
        onClick={handleAutoDetect}
        className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition mb-4"
        disabled={detecting}
      >
        {detecting ? 'Tespit Ediliyor...' : 'Auto Detect'}
      </button>
      {saved && <div className="mt-2 text-green-600">Kaydedildi!</div>}
      {detected.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Tespit Edilen Cihazlar</h3>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {detected.map((device, idx) => (
              <li key={idx} className="py-2">
                <span className="font-medium">{device.name}</span> <span className="text-xs text-gray-500">({device.topic})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {detected.length === 0 && detecting === false && (
        <div className="mt-4 text-gray-500 dark:text-gray-400 text-center text-sm">Tespit edilen cihaz yok.</div>
      )}
    </div>
  );
};

export default Config; 
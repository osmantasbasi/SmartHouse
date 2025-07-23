import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Config = () => {
  const { saveUserSetting, getUserSetting } = useAuth();
  const [mac, setMac] = useState('');
  const [saved, setSaved] = useState(false);

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
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
        >
          Kaydet
        </button>
        {saved && <div className="mt-2 text-green-600">Kaydedildi!</div>}
      </form>
    </div>
  );
};

export default Config; 
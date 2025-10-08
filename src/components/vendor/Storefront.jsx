import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import Loader from '../common/Loader';

const Storefront = () => {
  const { currentUser } = useAuth();
  const [storefront, setStorefront] = useState({
    banner: '',
    featured: [],
    theme: 'light',
    customCSS: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStorefront();
  }, [currentUser]);

  const fetchStorefront = async () => {
    try {
      const docRef = doc(db, 'vendors', currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setStorefront(docSnap.data().storefront || storefront);
      }
    } catch (error) {
      console.error('Error fetching storefront:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, 'vendors', currentUser.uid);
      await updateDoc(docRef, { storefront });
      alert('Storefront updated successfully!');
    } catch (error) {
      console.error('Error updating storefront:', error);
      alert('Error updating storefront');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Customize Storefront
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Banner Settings</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Banner Image URL</label>
          <input
            type="text"
            value={storefront.banner}
            onChange={(e) => setStorefront({ ...storefront, banner: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
            placeholder="https://example.com/banner.jpg"
          />
        </div>
        {storefront.banner && (
          <img
            src={storefront.banner}
            alt="Banner preview"
            className="w-full h-48 object-cover rounded-lg"
          />
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Theme Settings</h2>
        <div className="flex gap-4">
          <button
            onClick={() => setStorefront({ ...storefront, theme: 'light' })}
            className={`px-6 py-3 rounded-lg border-2 ${
              storefront.theme === 'light'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-300'
            }`}
          >
            Light Theme
          </button>
          <button
            onClick={() => setStorefront({ ...storefront, theme: 'dark' })}
            className={`px-6 py-3 rounded-lg border-2 ${
              storefront.theme === 'dark'
                ? 'border-blue-600 bg-gray-700'
                : 'border-gray-300'
            }`}
          >
            Dark Theme
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Custom CSS (Advanced)</h2>
        <textarea
          value={storefront.customCSS}
          onChange={(e) => setStorefront({ ...storefront, customCSS: e.target.value })}
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 font-mono text-sm"
          rows="8"
          placeholder=".store-header { background: #333; }"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
      >
        {saving ? 'Saving...' : 'Save Storefront Settings'}
      </button>
    </div>
  );
};

export default Storefront;
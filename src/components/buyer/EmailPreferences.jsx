import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

const EmailPreferences = () => {
  const { currentUser } = useAuth();
  const [preferences, setPreferences] = useState({
    orderUpdates: true,
    promotions: true,
    newProducts: false,
    flashSales: true,
    newsletter: true,
    reviews: true
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchPreferences();
  }, [currentUser]);

  const fetchPreferences = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists() && userDoc.data().emailPreferences) {
        setPreferences(userDoc.data().emailPreferences);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        emailPreferences: preferences,
        updatedAt: new Date().toISOString()
      });
      setMessage('Email preferences saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);
      setMessage('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Email Preferences</h1>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium">Order Updates</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Receive notifications about your order status
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.orderUpdates}
                onChange={(e) => setPreferences({...preferences, orderUpdates: e.target.checked})}
                className="w-5 h-5"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium">Promotions & Deals</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get exclusive deals and coupon codes
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.promotions}
                onChange={(e) => setPreferences({...preferences, promotions: e.target.checked})}
                className="w-5 h-5"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium">New Products</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Be the first to know about new arrivals
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.newProducts}
                onChange={(e) => setPreferences({...preferences, newProducts: e.target.checked})}
                className="w-5 h-5"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium">Flash Sales</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get notified about limited-time flash sales
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.flashSales}
                onChange={(e) => setPreferences({...preferences, flashSales: e.target.checked})}
                className="w-5 h-5"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium">Newsletter</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Receive our weekly newsletter with tips and trends
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.newsletter}
                onChange={(e) => setPreferences({...preferences, newsletter: e.target.checked})}
                className="w-5 h-5"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium">Review Reminders</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get reminded to review your purchases
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.reviews}
                onChange={(e) => setPreferences({...preferences, reviews: e.target.checked})}
                className="w-5 h-5"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:bg-gray-400"
          >
            {loading ? 'Saving...' : 'Save Preferences'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EmailPreferences;
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updatePassword, updateEmail } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

const VendorSettings = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('security');

  // Security Settings
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Notification Settings
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    orderUpdates: true,
    newMessages: true,
    productReviews: true,
    lowStock: true,
    paymentReceived: true,
    promotionalEmails: false,
    weeklyReport: true,
    monthlyReport: true,
    pushNotifications: true,
    smsNotifications: false
  });

  // Privacy Settings
  const [privacy, setPrivacy] = useState({
    showEmail: false,
    showPhone: false,
    showAddress: false,
    allowMessages: true,
    showOnline: true,
    showLastSeen: false,
    profileVisibility: 'public',
    searchEngineIndexing: true
  });

  // Store Settings
  const [storeSettings, setStoreSettings] = useState({
    storeName: '',
    storeSlug: '',
    storeDescription: '',
    autoApproveOrders: false,
    allowReviews: true,
    requireLogin: false,
    maintenanceMode: false,
    vacationMode: false,
    vacationMessage: '',
    currency: 'NGN',
    taxRate: 0,
    shippingFee: 0,
    freeShippingThreshold: 0,
    minimumOrder: 0
  });

  // Display Settings
  const [displaySettings, setDisplaySettings] = useState({
    theme: 'light',
    language: 'en',
    timezone: 'Africa/Lagos',
    dateFormat: 'DD/MM/YYYY',
    productsPerPage: 12,
    showOutOfStock: true,
    showPrices: true
  });

  // Two-Factor Authentication
  const [twoFactor, setTwoFactor] = useState({
    enabled: false,
    method: 'email',
    backupCodes: []
  });

  useEffect(() => {
    fetchSettings();
  }, [currentUser]);

  const fetchSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'vendorSettings', currentUser.uid));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        setNotifications(data.notifications || notifications);
        setPrivacy(data.privacy || privacy);
        setStoreSettings(data.storeSettings || storeSettings);
        setDisplaySettings(data.displaySettings || displaySettings);
        setTwoFactor(data.twoFactor || twoFactor);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    
    setLoading(true);
    try {
      await updatePassword(auth.currentUser, passwordData.newPassword);
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to change password' });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (settingsType, data) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'vendorSettings', currentUser.uid), {
        [settingsType]: data,
        updatedAt: new Date().toISOString()
      });
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setLoading(false);
    }
  };

  const generateBackupCodes = () => {
    const codes = Array.from({ length: 10 }, () => 
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );
    setTwoFactor({ ...twoFactor, backupCodes: codes });
  };

  const tabs = [
    { id: 'security', label: 'Security', icon: '🔐' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'privacy', label: 'Privacy', icon: '🔒' },
    { id: 'store', label: 'Store Settings', icon: '🏪' },
    { id: 'display', label: 'Display', icon: '🎨' },
    { id: 'account', label: 'Account', icon: '👤' }
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Settings</h1>

      {message.text && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Change Password */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Change Password</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Current Password</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:bg-gray-400"
              >
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>

          {/* Two-Factor Authentication */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Two-Factor Authentication</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable 2FA</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Add an extra layer of security</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={twoFactor.enabled}
                    onChange={(e) => setTwoFactor({...twoFactor, enabled: e.target.checked})}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {twoFactor.enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Authentication Method</label>
                    <select
                      value={twoFactor.method}
                      onChange={(e) => setTwoFactor({...twoFactor, method: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    >
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="app">Authenticator App</option>
                    </select>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={generateBackupCodes}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg"
                    >
                      Generate Backup Codes
                    </button>
                    {twoFactor.backupCodes.length > 0 && (
                      <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <p className="font-medium mb-2">Save these backup codes:</p>
                        <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                          {twoFactor.backupCodes.map((code, i) => (
                            <div key={i}>{code}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => saveSettings('twoFactor', twoFactor)}
              className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Save 2FA Settings
            </button>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Notification Preferences</h2>
          <div className="space-y-4">
            {Object.entries(notifications).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setNotifications({...notifications, [key]: e.target.checked})}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            ))}
          </div>
          <button
            onClick={() => saveSettings('notifications', notifications)}
            className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Save Notification Settings
          </button>
        </div>
      )}

      {/* Privacy Tab */}
      {activeTab === 'privacy' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Privacy Settings</h2>
          <div className="space-y-4">
            {Object.entries(privacy).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                </div>
                {typeof value === 'boolean' ? (
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setPrivacy({...privacy, [key]: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                ) : (
                  <select
                    value={value}
                    onChange={(e) => setPrivacy({...privacy, [key]: e.target.value})}
                    className="px-4 py-2 border rounded-lg dark:bg-gray-700"
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                    <option value="friends">Friends Only</option>
                  </select>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => saveSettings('privacy', privacy)}
            className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Save Privacy Settings
          </button>
        </div>
      )}

      {/* Store Settings Tab */}
      {activeTab === 'store' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Store Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Store Name</label>
              <input
                type="text"
                value={storeSettings.storeName}
                onChange={(e) => setStoreSettings({...storeSettings, storeName: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Store URL Slug</label>
              <input
                type="text"
                value={storeSettings.storeSlug}
                onChange={(e) => setStoreSettings({...storeSettings, storeSlug: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                placeholder="my-store"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Currency</label>
              <select
                value={storeSettings.currency}
                onChange={(e) => setStoreSettings({...storeSettings, currency: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              >
                <option value="NGN">Nigerian Naira (NGN)</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="GBP">British Pound (GBP)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tax Rate (%)</label>
                <input
                  type="number"
                  value={storeSettings.taxRate}
                  onChange={(e) => setStoreSettings({...storeSettings, taxRate: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Shipping Fee</label>
                <input
                  type="number"
                  value={storeSettings.shippingFee}
                  onChange={(e) => setStoreSettings({...storeSettings, shippingFee: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Free Shipping Threshold</label>
                <input
                  type="number"
                  value={storeSettings.freeShippingThreshold}
                  onChange={(e) => setStoreSettings({...storeSettings, freeShippingThreshold: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Minimum Order Amount</label>
                <input
                  type="number"
                  value={storeSettings.minimumOrder}
                  onChange={(e) => setStoreSettings({...storeSettings, minimumOrder: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  min="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              {['autoApproveOrders', 'allowReviews', 'requireLogin', 'maintenanceMode', 'vacationMode'].map(key => (
                <div key={key} className="flex items-center justify-between">
                  <p className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={storeSettings[key]}
                      onChange={(e) => setStoreSettings({...storeSettings, [key]: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>

            {storeSettings.vacationMode && (
              <div>
                <label className="block text-sm font-medium mb-2">Vacation Message</label>
                <textarea
                  value={storeSettings.vacationMessage}
                  onChange={(e) => setStoreSettings({...storeSettings, vacationMessage: e.target.value})}
                  rows="3"
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  placeholder="We're on vacation. Back on..."
                />
              </div>
            )}
          </div>
          <button
            onClick={() => saveSettings('storeSettings', storeSettings)}
            className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Save Store Settings
          </button>
        </div>
      )}

      {/* Display Settings Tab */}
      {activeTab === 'display' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Display Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Theme</label>
              <select
                value={displaySettings.theme}
                onChange={(e) => setDisplaySettings({...displaySettings, theme: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Language</label>
              <select
                value={displaySettings.language}
                onChange={(e) => setDisplaySettings({...displaySettings, language: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              >
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="es">Spanish</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Timezone</label>
              <select
                value={displaySettings.timezone}
                onChange={(e) => setDisplaySettings({...displaySettings, timezone: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              >
                <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                <option value="America/New_York">America/New York (EST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Date Format</label>
              <select
                value={displaySettings.dateFormat}
                onChange={(e) => setDisplaySettings({...displaySettings, dateFormat: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Products Per Page</label>
              <input
                type="number"
                value={displaySettings.productsPerPage}
                onChange={(e) => setDisplaySettings({...displaySettings, productsPerPage: parseInt(e.target.value)})}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                min="6"
                max="48"
              />
            </div>

            {['showOutOfStock', 'showPrices'].map(key => (
              <div key={key} className="flex items-center justify-between">
                <p className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={displaySettings[key]}
                    onChange={(e) => setDisplaySettings({...displaySettings, [key]: e.target.checked})}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            ))}
          </div>
          <button
            onClick={() => saveSettings('displaySettings', displaySettings)}
            className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Save Display Settings
          </button>
        </div>
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Account Information</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Account Type:</span>
                <span className="font-semibold">Vendor</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Email:</span>
                <span className="font-semibold">{currentUser?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Account Status:</span>
                <span className="font-semibold text-green-600">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Member Since:</span>
                <span className="font-semibold">{new Date(currentUser?.metadata?.creationTime).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg shadow-md p-6 border border-red-200 dark:border-red-800">
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-400 mb-4">Danger Zone</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Deactivate Account</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Temporarily disable your store. You can reactivate anytime.
                </p>
                <button className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg">
                  Deactivate Account
                </button>
              </div>

              <div className="border-t border-red-200 dark:border-red-800 pt-4">
                <h3 className="font-semibold mb-2">Delete Account</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Permanently delete your account and all data. This action cannot be undone.
                </p>
                <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorSettings;
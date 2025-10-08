import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [generalSettings, setGeneralSettings] = useState({
    siteName: 'Abu Mafhal Marketplace',
    siteEmail: 'info@abumafhal.com',
    sitePhone: '+234 XXX XXX XXXX',
    currency: 'NGN',
    timezone: 'Africa/Lagos',
    maintenanceMode: false
  });

  const [paymentSettings, setPaymentSettings] = useState({
    platformCommission: 10,
    minimumPayout: 5000,
    payoutSchedule: 'weekly',
    taxRate: 0,
    enableCOD: true,
    enableCardPayment: true,
    enableBankTransfer: true
  });

  const [shippingSettings, setShippingSettings] = useState({
    defaultShippingFee: 1000,
    freeShippingThreshold: 10000,
    enableLocalPickup: true,
    maxDeliveryDays: 7
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    orderNotifications: true,
    productNotifications: true,
    paymentNotifications: true,
    adminEmail: 'admin@abumafhal.com'
  });

  const [securitySettings, setSecuritySettings] = useState({
    requireEmailVerification: true,
    requirePhoneVerification: false,
    enableTwoFactor: false,
    sessionTimeout: 3600,
    maxLoginAttempts: 5
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'platform'));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        if (data.general) setGeneralSettings(data.general);
        if (data.payment) setPaymentSettings(data.payment);
        if (data.shipping) setShippingSettings(data.shipping);
        if (data.notification) setNotificationSettings(data.notification);
        if (data.security) setSecuritySettings(data.security);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (category, settings) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'settings', 'platform'), {
        [category]: settings,
        updatedAt: new Date().toISOString()
      });
      alert('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Creating new settings document...');
      // If document doesn't exist, create it
      try {
        await updateDoc(doc(db, 'settings', 'platform'), {
          [category]: settings,
          createdAt: new Date().toISOString()
        });
        alert('Settings saved successfully');
      } catch (err) {
        alert('Failed to save settings');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Platform Settings</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b overflow-x-auto">
        {['general', 'payment', 'shipping', 'notifications', 'security'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium capitalize whitespace-nowrap ${
              activeTab === tab
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">General Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Site Name</label>
              <input
                type="text"
                value={generalSettings.siteName}
                onChange={(e) => setGeneralSettings({ ...generalSettings, siteName: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Contact Email</label>
              <input
                type="email"
                value={generalSettings.siteEmail}
                onChange={(e) => setGeneralSettings({ ...generalSettings, siteEmail: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Contact Phone</label>
              <input
                type="text"
                value={generalSettings.sitePhone}
                onChange={(e) => setGeneralSettings({ ...generalSettings, sitePhone: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Currency</label>
              <select
                value={generalSettings.currency}
                onChange={(e) => setGeneralSettings({ ...generalSettings, currency: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              >
                <option value="NGN">Nigerian Naira (₦)</option>
                <option value="USD">US Dollar ($)</option>
                <option value="EUR">Euro (€)</option>
                <option value="GBP">British Pound (£)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Timezone</label>
              <select
                value={generalSettings.timezone}
                onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              >
                <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New York (EST)</option>
              </select>
            </div>
            <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <input
                type="checkbox"
                checked={generalSettings.maintenanceMode}
                onChange={(e) => setGeneralSettings({ ...generalSettings, maintenanceMode: e.target.checked })}
                className="w-5 h-5"
              />
              <div>
                <label className="font-medium">Maintenance Mode</label>
                <p className="text-sm text-gray-600">Enable to temporarily disable the site for maintenance</p>
              </div>
            </div>
            <button
              onClick={() => saveSettings('general', generalSettings)}
              disabled={saving}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save General Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Payment Settings */}
      {activeTab === 'payment' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Payment Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Platform Commission (%)</label>
              <input
                type="number"
                value={paymentSettings.platformCommission}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, platformCommission: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                min="0"
                max="100"
              />
              <p className="text-sm text-gray-600 mt-1">Percentage taken from each sale</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Minimum Payout Amount (₦)</label>
              <input
                type="number"
                value={paymentSettings.minimumPayout}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, minimumPayout: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Payout Schedule</label>
              <select
                value={paymentSettings.payoutSchedule}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, payoutSchedule: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Tax Rate (%)</label>
              <input
                type="number"
                value={paymentSettings.taxRate}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, taxRate: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                min="0"
                max="100"
              />
            </div>
            <div className="space-y-3 border-t pt-4">
              <p className="font-medium">Payment Methods</p>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={paymentSettings.enableCOD}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, enableCOD: e.target.checked })}
                  className="w-5 h-5"
                />
                <label>Enable Cash on Delivery</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={paymentSettings.enableCardPayment}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, enableCardPayment: e.target.checked })}
                  className="w-5 h-5"
                />
                <label>Enable Card Payment</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={paymentSettings.enableBankTransfer}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, enableBankTransfer: e.target.checked })}
                  className="w-5 h-5"
                />
                <label>Enable Bank Transfer</label>
              </div>
            </div>
            <button
              onClick={() => saveSettings('payment', paymentSettings)}
              disabled={saving}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Payment Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Shipping Settings */}
      {activeTab === 'shipping' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Shipping Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Default Shipping Fee (₦)</label>
              <input
                type="number"
                value={shippingSettings.defaultShippingFee}
                onChange={(e) => setShippingSettings({ ...shippingSettings, defaultShippingFee: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Free Shipping Threshold (₦)</label>
              <input
                type="number"
                value={shippingSettings.freeShippingThreshold}
                onChange={(e) => setShippingSettings({ ...shippingSettings, freeShippingThreshold: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              />
              <p className="text-sm text-gray-600 mt-1">Orders above this amount get free shipping</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Maximum Delivery Days</label>
              <input
                type="number"
                value={shippingSettings.maxDeliveryDays}
                onChange={(e) => setShippingSettings({ ...shippingSettings, maxDeliveryDays: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={shippingSettings.enableLocalPickup}
                onChange={(e) => setShippingSettings({ ...shippingSettings, enableLocalPickup: e.target.checked })}
                className="w-5 h-5"
              />
              <label>Enable Local Pickup Option</label>
            </div>
            <button
              onClick={() => saveSettings('shipping', shippingSettings)}
              disabled={saving}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Shipping Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Notification Settings */}
      {activeTab === 'notifications' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Notification Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Admin Email</label>
              <input
                type="email"
                value={notificationSettings.adminEmail}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, adminEmail: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              />
            </div>
            <div className="space-y-3 border-t pt-4">
              <p className="font-medium">Notification Channels</p>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notificationSettings.emailNotifications}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, emailNotifications: e.target.checked })}
                  className="w-5 h-5"
                />
                <label>Email Notifications</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notificationSettings.smsNotifications}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, smsNotifications: e.target.checked })}
                  className="w-5 h-5"
                />
                <label>SMS Notifications</label>
              </div>
            </div>
            <div className="space-y-3 border-t pt-4">
              <p className="font-medium">Notification Types</p>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notificationSettings.orderNotifications}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, orderNotifications: e.target.checked })}
                  className="w-5 h-5"
                />
                <label>Order Notifications</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notificationSettings.productNotifications}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, productNotifications: e.target.checked })}
                  className="w-5 h-5"
                />
                <label>Product Notifications</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notificationSettings.paymentNotifications}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, paymentNotifications: e.target.checked })}
                  className="w-5 h-5"
                />
                <label>Payment Notifications</label>
              </div>
            </div>
            <button
              onClick={() => saveSettings('notification', notificationSettings)}
              disabled={saving}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Notification Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Security Settings */}
      {activeTab === 'security' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Security Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Session Timeout (seconds)</label>
              <input
                type="number"
                value={securitySettings.sessionTimeout}
                onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Max Login Attempts</label>
              <input
                type="number"
                value={securitySettings.maxLoginAttempts}
                onChange={(e) => setSecuritySettings({ ...securitySettings, maxLoginAttempts: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              />
            </div>
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={securitySettings.requireEmailVerification}
                  onChange={(e) => setSecuritySettings({ ...securitySettings, requireEmailVerification: e.target.checked })}
                  className="w-5 h-5"
                />
                <label>Require Email Verification</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={securitySettings.requirePhoneVerification}
                  onChange={(e) => setSecuritySettings({ ...securitySettings, requirePhoneVerification: e.target.checked })}
                  className="w-5 h-5"
                />
                <label>Require Phone Verification</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={securitySettings.enableTwoFactor}
                  onChange={(e) => setSecuritySettings({ ...securitySettings, enableTwoFactor: e.target.checked })}
                  className="w-5 h-5"
                />
                <label>Enable Two-Factor Authentication</label>
              </div>
            </div>
            <button
              onClick={() => saveSettings('security', securitySettings)}
              disabled={saving}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Security Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
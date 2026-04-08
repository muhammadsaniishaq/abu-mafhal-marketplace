import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';

const Settings = () => {
  const [settings, setSettings] = useState({
    siteName: 'Abu Mafhal',
    commission: 10,
    currency: 'NGN',
    maintenanceMode: false,
    allowRegistration: true,
    emailNotifications: true,
    smsNotifications: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('id', 'app')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setSettings({
          siteName: data.site_name || data.siteName || 'Abu Mafhal',
          commission: data.commission || 10,
          currency: data.currency || 'NGN',
          maintenanceMode: data.maintenance_mode || data.maintenanceMode || false,
          allowRegistration: data.allow_registration || data.allowRegistration || true,
          emailNotifications: data.email_notifications || data.emailNotifications || true,
          smsNotifications: data.sms_notifications || data.smsNotifications || false
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsData = {
        id: 'app',
        site_name: settings.siteName,
        commission: settings.commission,
        currency: settings.currency,
        maintenance_mode: settings.maintenanceMode,
        allow_registration: settings.allowRegistration,
        email_notifications: settings.emailNotifications,
        sms_notifications: settings.smsNotifications,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('platform_settings')
        .upsert(settingsData, { onConflict: 'id' });

      if (error) throw error;
      alert('Settings updated successfully!');
    } catch (error) {
      console.error('Error updating settings:', error.message);
      alert('Error updating settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Platform Settings
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Site Name</label>
          <input
            type="text"
            value={settings.siteName}
            onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Commission Rate (%)</label>
          <input
            type="number"
            value={settings.commission}
            onChange={(e) => setSettings({ ...settings, commission: Number(e.target.value) })}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
            min="0"
            max="100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Currency</label>
          <select
            value={settings.currency}
            onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
          >
            <option value="NGN">Nigerian Naira (₦)</option>
            <option value="USD">US Dollar ($)</option>
            <option value="EUR">Euro (€)</option>
          </select>
        </div>

        <div className="space-y-4 border-t pt-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.maintenanceMode}
              onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
              className="mr-3"
            />
            <span>Maintenance Mode</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.allowRegistration}
              onChange={(e) => setSettings({ ...settings, allowRegistration: e.target.checked })}
              className="mr-3"
            />
            <span>Allow New User Registration</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.emailNotifications}
              onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
              className="mr-3"
            />
            <span>Email Notifications</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.smsNotifications}
              onChange={(e) => setSettings({ ...settings, smsNotifications: e.target.checked })}
              className="mr-3"
            />
            <span>SMS Notifications</span>
          </label>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default Settings;
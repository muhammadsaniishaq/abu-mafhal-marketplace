import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AppSettingsContext = createContext();

export const AppSettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({
        app_name: 'Abu Mafhal Marketplace',
        logo_url: null,
        primary_color: '#0F172A',
        secondary_color: '#3B82F6',
        features: {},
        payment_methods: { paystack: true, crypto: true, manual: true },
        loading: true
    });

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .single();

            if (error) {
                console.log('Error fetching app settings:', error);
                return;
            }

            if (data) {
                setSettings({ ...data, loading: false });
            }
        } catch (error) {
            console.log('Exception fetching settings:', error);
        } finally {
            setSettings(prev => ({ ...prev, loading: false }));
        }
    };

    useEffect(() => {
        fetchSettings();

        // Subscribe to changes (Realtime)
        const subscription = supabase
            .channel('app_settings_changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, payload => {
                console.log('Settings updated realtime:', payload.new);
                setSettings(prev => ({ ...prev, ...payload.new }));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    const updateSettings = async (newSettings) => {
        try {
            const { error } = await supabase
                .from('app_settings')
                .update(newSettings)
                .eq('is_singleton', true);

            if (error) throw error;
            // State will update via realtime subscription usually, but we can optimistically update too
            setSettings(prev => ({ ...prev, ...newSettings }));
            return { error: null };
        } catch (error) {
            console.log('Error updating settings:', error);
            return { error };
        }
    };

    return (
        <AppSettingsContext.Provider value={{ settings, updateSettings, refreshSettings: fetchSettings }}>
            {children}
        </AppSettingsContext.Provider>
    );
};

export const useAppSettings = () => useContext(AppSettingsContext);

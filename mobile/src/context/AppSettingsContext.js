import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AppSettingsContext = createContext();

const DEFAULT_VENDOR_PLANS = [
    { id: 'free_trial', label: '1 Month Free Trial', price: 0, badge: 'TRY FREE', is_active: true },
    { id: '1_month', label: '1 Month', price: 2000, is_active: true },
    { id: '3_months', label: '3 Months', price: 5500, is_active: true },
    { id: '6_months', label: '6 Months', price: 10000, is_active: true },
    { id: '1_year', label: '1 Year', price: 18000, recommended: true, is_active: true },
    { id: 'lifetime', label: 'Lifetime', price: 40000, badge: 'BEST VALUE', is_active: true }
];

export const AppSettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({
        app_name: 'Abu Mafhal Marketplace',
        logo_url: null,
        primary_color: '#0F172A',
        secondary_color: '#3B82F6',
        features: {},
        payment_methods: { paystack: true, crypto: true, manual: true },
        default_shipping_address: '',
        paystack_secret_key: '',
        prembly_app_id: '',
        prembly_secret_key: '',
        vendor_plans: DEFAULT_VENDOR_PLANS,
        loading: true
    });

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*, default_shipping_address')
                .single();

            if (error) {
                console.log('Error fetching app settings:', error);
                return;
            }

            if (data) {
                // Ensure default arrays and addresses exist
                const hasValidPlans = Array.isArray(data.vendor_plans) && data.vendor_plans.length > 0;
                const enriched = {
                    ...data,
                    default_shipping_address: data.default_shipping_address || '',
                    vendor_plans: hasValidPlans ? data.vendor_plans : DEFAULT_VENDOR_PLANS
                };
                setSettings({ ...enriched, loading: false });
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

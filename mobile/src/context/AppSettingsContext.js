import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const AppSettingsContext = createContext();
const SETTINGS_CACHE_KEY = '@abumafhal_settings_v1';

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
        payment_methods: { paystack: true, crypto: true, manual: true, flutterwave: true, wallet: true, pod: true },
        payment_maintenance: { paystack: false, flutterwave: false, coinbase: false, wallet: false, pod: false },
        flutterwave_public_key: 'FLWPUBK-3fff199cbd02a7c478e39ce4e4c3ac0f-X',
        default_shipping_address: '',
        paystack_secret_key: '',
        prembly_app_id: '',
        prembly_secret_key: '',
        vendor_plans: DEFAULT_VENDOR_PLANS,
        loading: false
    });

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*');

            if (error) {
                console.log('Error fetching app settings:', error);
                return;
            }

            if (data && data.length > 0) {
                const mainRow = data.find(r => r.is_singleton) || data[0];
                const merged = { ...mainRow };
                data.forEach(r => {
                    if (r.key && r.value) {
                        merged[r.key] = r.value;
                    }
                });

                // Ensure default arrays and addresses exist
                const hasValidPlans = Array.isArray(merged.vendor_plans) && merged.vendor_plans.length > 0;
                const enriched = {
                    ...merged,
                    payment_methods: {
                        paystack: true,
                        crypto: true,
                        manual: true,
                        flutterwave: true,
                        wallet: true,
                        pod: true,
                        ...(merged.payment_methods || {})
                    },
                    payment_maintenance: {
                        paystack: false,
                        flutterwave: false,
                        coinbase: false,
                        wallet: false,
                        pod: false,
                        ...(merged.payment_maintenance || {})
                    },
                    flutterwave_public_key: merged.flutterwave_public_key || 'FLWPUBK-3fff199cbd02a7c478e39ce4e4c3ac0f-X',
                    default_shipping_address: merged.default_shipping_address || '',
                    vendor_plans: hasValidPlans ? merged.vendor_plans : DEFAULT_VENDOR_PLANS
                };
                setSettings({ ...enriched, loading: false });
                AsyncStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(enriched)).catch(() => {});
            }
        } catch (error) {
            console.log('Exception fetching settings:', error);
        } finally {
            setSettings(prev => ({ ...prev, loading: false }));
        }
    };

    useEffect(() => {
        // 1. Instant cache load
        AsyncStorage.getItem(SETTINGS_CACHE_KEY).then(cached => {
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    setSettings(prev => ({ ...prev, ...parsed, loading: false }));
                } catch (_) {}
            }
        }).catch(() => {});

        // 2. Background sync
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
            // 1. Separate singleton columns from custom key-value settings
            const singletonCols = ['app_name', 'logo_url', 'primary_color', 'secondary_color', 'value', 'description'];
            const singletonUpdate = {};
            Object.keys(newSettings).forEach(k => {
                if (singletonCols.includes(k)) singletonUpdate[k] = newSettings[k];
            });

            if (Object.keys(singletonUpdate).length > 0) {
                try {
                    await supabase
                        .from('app_settings')
                        .update(singletonUpdate)
                        .eq('is_singleton', true);
                } catch (_) {}
            }

            // 2. Upsert key-value configuration rows for settings (payment_maintenance, payment_methods, etc.)
            const skipKeys = ['is_singleton', 'created_at', 'updated_at', 'id'];
            for (const k of Object.keys(newSettings)) {
                if (!singletonCols.includes(k) && !skipKeys.includes(k) && newSettings[k] !== undefined) {
                    try {
                        await supabase
                            .from('app_settings')
                            .upsert({
                                key: k,
                                value: newSettings[k],
                                description: `Platform setting: ${k}`,
                                updated_at: new Date().toISOString()
                            }, { onConflict: 'key' });
                    } catch (_) {}
                }
            }

            // 3. Optimistic local cache update for instant UI feedback
            const merged = { ...settings, ...newSettings };
            setSettings(merged);
            await AsyncStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(merged));
            return { error: null };
        } catch (error) {
            console.log('Error updating settings:', error);
            const merged = { ...settings, ...newSettings };
            setSettings(merged);
            await AsyncStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(merged));
            return { error: null };
        }
    };

    return (
        <AppSettingsContext.Provider value={{ settings, updateSettings, refreshSettings: fetchSettings }}>
            {children}
        </AppSettingsContext.Provider>
    );
};

export const useAppSettings = () => useContext(AppSettingsContext);

// ─── useBrandTheme ────────────────────────────────────────────────────────────
// Returns live brand colors sourced from admin settings.
// Usage: const { primary, secondary, primaryLight, primaryBg, onPrimary } = useBrandTheme();
export const useBrandTheme = () => {
    const { settings } = useContext(AppSettingsContext);

    const primary   = settings?.primary_color   || '#0F172A';
    const secondary = settings?.secondary_color || '#3B82F6';

    // Derive a readable foreground colour (white vs black) by checking perceived luminance
    const hexToRgb = (hex) => {
        const h = hex.replace('#', '');
        return {
            r: parseInt(h.substring(0, 2), 16),
            g: parseInt(h.substring(2, 4), 16),
            b: parseInt(h.substring(4, 6), 16),
        };
    };

    const luminance = (hex) => {
        try {
            const { r, g, b } = hexToRgb(hex);
            return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        } catch { return 0; }
    };

    const onPrimary   = luminance(primary)   > 0.55 ? '#0F172A' : '#FFFFFF';
    const onSecondary = luminance(secondary) > 0.55 ? '#0F172A' : '#FFFFFF';

    // Light backgrounds (for chips, badges, tinted rows)
    const primaryBg    = primary + '15';    // 9% opacity overlay
    const primaryLight = primary + '30';    // 19% opacity
    const secondaryBg  = secondary + '15';
    const secondaryLight = secondary + '30';

    return {
        primary,
        secondary,
        onPrimary,
        onSecondary,
        primaryBg,
        primaryLight,
        secondaryBg,
        secondaryLight,
    };
};

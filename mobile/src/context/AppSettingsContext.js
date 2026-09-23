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

export const unwrapSettingValue = (val) => {
    if (val === null || val === undefined) return val;
    if (typeof val === 'object' && !Array.isArray(val)) {
        if ('value' in val) {
            const keys = Object.keys(val);
            if (keys.length === 1 || keys.every(k => ['value', 'updated_at', 'description', 'key'].includes(k))) {
                return val.value;
            }
        }
    }
    return val;
};

export const AppSettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({
        app_name: 'Abu Mafhal Marketplace',
        logo_url: null,
        primary_color: '#0F172A',
        secondary_color: '#3B82F6',
        features: {},
        payment_methods: { paystack: true, crypto: true, manual: true, flutterwave: true, wallet: true, pod: true },
        payment_maintenance: { paystack: false, flutterwave: false, nowpayments: false, wallet: false, pod: false },
        flutterwave_public_key: (typeof process !== 'undefined' ? (process.env?.EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || process.env?.VITE_FLUTTERWAVE_PUBLIC_KEY) : '') || '',
        default_shipping_address: '',
        paystack_secret_key: '',
        nowpayments_api_key: '',
        nowpayments_ipn_key: '',
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
                const merged = {};
                if (mainRow && typeof mainRow === 'object') {
                    Object.keys(mainRow).forEach(k => {
                        merged[k] = unwrapSettingValue(mainRow[k]);
                    });
                }
                data.forEach(r => {
                    if (r.key && r.value !== undefined && r.value !== null) {
                        merged[r.key] = unwrapSettingValue(r.value);
                    }
                });

                // Synchronize shipping_settings into merged top-level fields
                if (merged.shipping_settings && typeof merged.shipping_settings === 'object') {
                    if (merged.shipping_settings.price_per_km !== undefined) {
                        merged.price_per_km = merged.shipping_settings.price_per_km;
                    }
                    if (merged.shipping_settings.base_fee !== undefined) {
                        merged.base_fee = merged.shipping_settings.base_fee;
                    }
                    if (merged.shipping_settings.free_shipping_enabled !== undefined) {
                        merged.free_shipping_enabled = merged.shipping_settings.free_shipping_enabled;
                    }
                    if (merged.shipping_settings.free_shipping_threshold !== undefined) {
                        merged.free_shipping_threshold = merged.shipping_settings.free_shipping_threshold;
                    }
                }

                // Merge payment_gateways object if present in database
                if (merged.payment_gateways && typeof merged.payment_gateways === 'object') {
                    const unwrappedGateways = {};
                    Object.keys(merged.payment_gateways).forEach(gk => {
                        unwrappedGateways[gk] = unwrapSettingValue(merged.payment_gateways[gk]);
                    });
                    Object.assign(merged, unwrappedGateways);
                }

                // Preserve local dedicated gateway keys if database has empty values
                try {
                    const cachedGatewayKeys = await AsyncStorage.getItem('@abumafhal_gateway_keys');
                    if (cachedGatewayKeys) {
                        const parsedGk = JSON.parse(cachedGatewayKeys);
                        if (parsedGk.paystack_public_key && !merged.paystack_public_key) merged.paystack_public_key = parsedGk.paystack_public_key;
                        if (parsedGk.paystack_secret_key && !merged.paystack_secret_key) merged.paystack_secret_key = parsedGk.paystack_secret_key;
                        if (parsedGk.flutterwave_public_key && !merged.flutterwave_public_key) merged.flutterwave_public_key = parsedGk.flutterwave_public_key;
                        if (parsedGk.flutterwave_secret_key && !merged.flutterwave_secret_key) merged.flutterwave_secret_key = parsedGk.flutterwave_secret_key;
                        if (parsedGk.nowpayments_api_key && !merged.nowpayments_api_key) merged.nowpayments_api_key = parsedGk.nowpayments_api_key;
                        if (parsedGk.nowpayments_ipn_key && !merged.nowpayments_ipn_key) merged.nowpayments_ipn_key = parsedGk.nowpayments_ipn_key;
                    }
                } catch (_) {}

                // Ensure default arrays and addresses exist
                const hasValidPlans = Array.isArray(merged.vendor_plans) && merged.vendor_plans.length > 0;
                const safeFlwKey = (merged.flutterwave_public_key && typeof merged.flutterwave_public_key === 'string' && !merged.flutterwave_public_key.includes('FLWPUBK-3fff'))
                    ? merged.flutterwave_public_key
                    : ((typeof process !== 'undefined' ? (process.env?.EXPO_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || process.env?.VITE_FLUTTERWAVE_PUBLIC_KEY) : '') || '');

                const safeDefaultAddr = typeof merged.default_shipping_address === 'object' && merged.default_shipping_address !== null
                    ? (merged.default_shipping_address.value || merged.default_shipping_address.address || '')
                    : (merged.default_shipping_address || '');

                const enriched = {
                    ...merged,
                    payment_methods: {
                        paystack: true,
                        crypto: true,
                        manual: true,
                        flutterwave: true,
                        wallet: true,
                        pod: true,
                        ...(typeof merged.payment_methods === 'object' ? merged.payment_methods : {})
                    },
                    payment_maintenance: {
                        paystack: false,
                        flutterwave: false,
                        nowpayments: false,
                        wallet: false,
                        pod: false,
                        ...(typeof merged.payment_maintenance === 'object' ? merged.payment_maintenance : {})
                    },
                    flutterwave_public_key: safeFlwKey,
                    default_shipping_address: safeDefaultAddr,
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
        // 1. Instant cache load with unwrap safety
        AsyncStorage.getItem(SETTINGS_CACHE_KEY).then(cached => {
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    const cleaned = {};
                    Object.keys(parsed).forEach(k => {
                        cleaned[k] = unwrapSettingValue(parsed[k]);
                    });
                    setSettings(prev => ({ ...prev, ...cleaned, loading: false }));
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
                if (payload.new) {
                    const updated = payload.new;
                    if (updated.key && updated.value !== undefined) {
                        setSettings(prev => ({
                            ...prev,
                            [updated.key]: unwrapSettingValue(updated.value)
                        }));
                    } else {
                        const cleaned = {};
                        Object.keys(updated).forEach(k => {
                            cleaned[k] = unwrapSettingValue(updated[k]);
                        });
                        setSettings(prev => ({ ...prev, ...cleaned }));
                    }
                }
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

            // 2. Dedicated Payment Gateway Keys group
            const gatewayKeys = {
                paystack_public_key: newSettings.paystack_public_key || '',
                paystack_secret_key: newSettings.paystack_secret_key || '',
                flutterwave_public_key: newSettings.flutterwave_public_key || '',
                flutterwave_secret_key: newSettings.flutterwave_secret_key || '',
                nowpayments_api_key: newSettings.nowpayments_api_key || '',
                nowpayments_ipn_key: newSettings.nowpayments_ipn_key || '',
                updated_at: new Date().toISOString()
            };

            // Save to database without relying on .env:
            // 1. Try secure RPC function (SECURITY DEFINER)
            // 2. Fallback to Edge Function (Service Role Key)
            // 3. Fallback to direct upsert
            try {
                let saved = false;
                try {
                    const { error: rpcErr } = await supabase.rpc('save_payment_gateways', { gateway_data: gatewayKeys });
                    if (!rpcErr) saved = true;
                } catch (_) {}

                if (!saved) {
                    try {
                        const { data: fnData, error: fnErr } = await supabase.functions.invoke('initiate-paystack-payment', {
                            body: { action: 'save_gateway_settings', gateway_data: gatewayKeys, gateway_keys: gatewayKeys }
                        });
                        if (!fnErr && fnData?.success) saved = true;
                    } catch (_) {}
                }

                if (!saved) {
                    await supabase
                        .from('app_settings')
                        .upsert({
                            key: 'payment_gateways',
                            value: gatewayKeys,
                            description: 'Payment Gateway API Credentials',
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'key' });
                }
            } catch (gwSaveErr) {
                console.warn('Gateway keys database persistence notice:', gwSaveErr);
            }

            // 3. Upsert key-value configuration rows for settings (using RPC then direct upsert)
            const skipKeys = ['is_singleton', 'created_at', 'updated_at', 'id'];
            for (const k of Object.keys(newSettings)) {
                if (!singletonCols.includes(k) && !skipKeys.includes(k) && newSettings[k] !== undefined) {
                    const formattedVal = typeof newSettings[k] === 'object' ? newSettings[k] : { value: newSettings[k] };
                    try {
                        const { error: rpcErr } = await supabase.rpc('save_app_setting', {
                            p_key: k,
                            p_value: formattedVal,
                            p_description: `Platform setting: ${k}`
                        });
                        if (rpcErr) throw rpcErr;
                    } catch (_) {
                        try {
                            await supabase
                                .from('app_settings')
                                .upsert({
                                    key: k,
                                    value: formattedVal,
                                    description: `Platform setting: ${k}`,
                                    updated_at: new Date().toISOString()
                                }, { onConflict: 'key' });
                        } catch (upsertErr) {
                            console.log(`Setting ${k} save notice:`, upsertErr?.message);
                        }
                    }
                }
            }

            // 4. Update local caches (both main settings & dedicated gateway keys)
            const cleanNewSettings = {};
            Object.keys(newSettings).forEach(k => {
                cleanNewSettings[k] = unwrapSettingValue(newSettings[k]);
            });
            const merged = { ...settings, ...cleanNewSettings };
            setSettings(merged);
            await AsyncStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(merged));
            await AsyncStorage.setItem('@abumafhal_gateway_keys', JSON.stringify(gatewayKeys));
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(merged));
                window.localStorage.setItem('@abumafhal_gateway_keys', JSON.stringify(gatewayKeys));
            }
            return { error: null };
        } catch (error) {
            console.log('Error updating settings:', error);
            const cleanNewSettings = {};
            Object.keys(newSettings).forEach(k => {
                cleanNewSettings[k] = unwrapSettingValue(newSettings[k]);
            });
            const merged = { ...settings, ...cleanNewSettings };
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

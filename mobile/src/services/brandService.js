import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const BRANDS_CACHE_KEY = '@abumafhal_brands_unified_v1';
const HOME_CACHE_KEY = '@abumafhal_home_cache_v2';
const APP_SETTINGS_KEY = 'marketplace_brands';

// In-memory subscribers for live reactive updates across screens
const subscribers = new Set();

export const subscribeToBrandChanges = (callback) => {
    if (typeof callback === 'function') {
        subscribers.add(callback);
        return () => subscribers.delete(callback);
    }
    return () => {};
};

const notifySubscribers = (data) => {
    subscribers.forEach((cb) => {
        try {
            cb(data);
        } catch (e) {
            console.log('[brandService] subscriber notification error:', e);
        }
    });
};

/**
 * Invalidate caches so home screen and shop reflect changes immediately
 */
export const invalidateBrandCaches = async () => {
    try {
        const keys = [BRANDS_CACHE_KEY, HOME_CACHE_KEY];
        await Promise.allSettled(keys.map(k => AsyncStorage.removeItem(k)));
        if (typeof window !== 'undefined' && window.localStorage) {
            keys.forEach(k => {
                try { window.localStorage.removeItem(k); } catch (_) {}
            });
        }
    } catch (e) {
        console.log('[brandService] Cache invalidation err:', e);
    }
};

/**
 * 32 Global Curated Verified Marketplace Brand Presets
 * Crisp official 128px PNG logos via Google Favicon CDN + fallbacks
 */
export const GLOBAL_BRAND_PRESETS = [
    { name: "Apple", domain: "apple.com", category: "Phones & Electronics", is_featured: true, logo_url: "https://www.google.com/s2/favicons?domain=apple.com&sz=128" },
    { name: "Samsung", domain: "samsung.com", category: "Phones & Electronics", is_featured: true, logo_url: "https://www.google.com/s2/favicons?domain=samsung.com&sz=128" },
    { name: "Sony", domain: "sony.com", category: "Audio & Entertainment", is_featured: true, logo_url: "https://www.google.com/s2/favicons?domain=sony.com&sz=128" },
    { name: "HP", domain: "hp.com", category: "Computers & Laptops", is_featured: true, logo_url: "https://www.google.com/s2/favicons?domain=hp.com&sz=128" },
    { name: "Dell", domain: "dell.com", category: "Computers & Monitors", is_featured: true, logo_url: "https://www.google.com/s2/favicons?domain=dell.com&sz=128" },
    { name: "Lenovo", domain: "lenovo.com", category: "Laptops & ThinkPad", is_featured: true, logo_url: "https://www.google.com/s2/favicons?domain=lenovo.com&sz=128" },
    { name: "Asus", domain: "asus.com", category: "Gaming & Computers", is_featured: false, logo_url: "https://www.google.com/s2/favicons?domain=asus.com&sz=128" },
    { name: "Xiaomi", domain: "mi.com", category: "Smartphones & Smart Home", is_featured: true, logo_url: "https://www.google.com/s2/favicons?domain=mi.com&sz=128" },
    { name: "LG", domain: "lg.com", category: "Appliances & Displays", is_featured: true, logo_url: "https://www.google.com/s2/favicons?domain=lg.com&sz=128" },
    { name: "Philips", domain: "philips.com", category: "Home & Personal Care", is_featured: false, logo_url: "https://www.google.com/s2/favicons?domain=philips.com&sz=128" },
    { name: "Nike", domain: "nike.com", category: "Sportswear & Footwear", is_featured: true, logo_url: "https://www.google.com/s2/favicons?domain=nike.com&sz=128" },
    { name: "Adidas", domain: "adidas.com", category: "Sportswear & Shoes", is_featured: true, logo_url: "https://www.google.com/s2/favicons?domain=adidas.com&sz=128" },
    { name: "Puma", domain: "puma.com", category: "Athletics & Lifestyle", is_featured: false, logo_url: "https://www.google.com/s2/favicons?domain=puma.com&sz=128" },
    { name: "Zara", domain: "zara.com", category: "Contemporary Fashion", is_featured: true, logo_url: "https://www.google.com/s2/favicons?domain=zara.com&sz=128" },
    { name: "Gucci", domain: "gucci.com", category: "Luxury Designer Fashion", is_featured: true, logo_url: "https://www.google.com/s2/favicons?domain=gucci.com&sz=128" },
    { name: "Rolex", domain: "rolex.com", category: "Luxury Timepieces", is_featured: true, logo_url: "https://www.google.com/s2/favicons?domain=rolex.com&sz=128" },
    { name: "Casio", domain: "casio.com", category: "Watches & Electronics", is_featured: false, logo_url: "https://www.google.com/s2/favicons?domain=casio.com&sz=128" },
    { name: "Ray-Ban", domain: "ray-ban.com", category: "Eyewear & Sunglasses", is_featured: false, logo_url: "https://www.google.com/s2/favicons?domain=ray-ban.com&sz=128" },
    { name: "Dior", domain: "dior.com", category: "Luxury Fashion & Fragrance", is_featured: false, logo_url: "https://www.google.com/s2/favicons?domain=dior.com&sz=128" },
    { name: "Chanel", domain: "chanel.com", category: "Haute Couture & Perfumes", is_featured: false, logo_url: "https://www.google.com/s2/favicons?domain=chanel.com&sz=128" },
    { name: "L'Oréal", domain: "loreal.com", category: "Cosmetics & Skincare", is_featured: false, logo_url: "https://www.google.com/s2/favicons?domain=loreal.com&sz=128" },
    { name: "Nivea", domain: "nivea.com", category: "Personal Care & Beauty", is_featured: false, logo_url: "https://www.google.com/s2/favicons?domain=nivea.com&sz=128" },
    { name: "Canon", domain: "canon.com", category: "Cameras & Optics", is_featured: false, logo_url: "https://www.google.com/s2/favicons?domain=canon.com&sz=128" },
    { name: "JBL", domain: "jbl.com", category: "Audio & Speakers", is_featured: true, logo_url: "https://www.google.com/s2/favicons?domain=jbl.com&sz=128" },
    { name: "Anker", domain: "anker.com", category: "Power & Mobile Tech", is_featured: true, logo_url: "https://www.google.com/s2/favicons?domain=anker.com&sz=128" },
    { name: "Toyota", domain: "toyota.com", category: "Automotive & Genuine Parts", is_featured: false, logo_url: "https://www.google.com/s2/favicons?domain=toyota.com&sz=128" },
    { name: "Mercedes-Benz", domain: "mercedes-benz.com", category: "Luxury Automotive", is_featured: false, logo_url: "https://www.google.com/s2/favicons?domain=mercedes-benz.com&sz=128" },
    { name: "Bosch", domain: "bosch.com", category: "Power Tools & Appliances", is_featured: false, logo_url: "https://www.google.com/s2/favicons?domain=bosch.com&sz=128" },
    { name: "Makita", domain: "makita.com", category: "Industrial Power Tools", is_featured: false, logo_url: "https://www.google.com/s2/favicons?domain=makita.com&sz=128" },
    { name: "Oral-B", domain: "oralb.com", category: "Oral Care & Health", is_featured: false, logo_url: "https://www.google.com/s2/favicons?domain=oralb.com&sz=128" },
    { name: "Intel", domain: "intel.com", category: "Processors & Microchips", is_featured: false, logo_url: "https://www.google.com/s2/favicons?domain=intel.com&sz=128" },
    { name: "Microsoft", domain: "microsoft.com", category: "Software & Hardware", is_featured: false, logo_url: "https://www.google.com/s2/favicons?domain=microsoft.com&sz=128" }
];

/**
 * Fetch all brands with local storage cache fallback
 */
export const fetchAllBrands = async ({ forceRefresh = false } = {}) => {
    // 1. Try local cache if not forcing refresh
    if (!forceRefresh) {
        try {
            const cached = await AsyncStorage.getItem(BRANDS_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (_) {}
    }

    let fetched = [];

    // 2. First check app_settings which contains admin modifications
    try {
        const { data: setRes } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', APP_SETTINGS_KEY)
            .maybeSingle();

        if (setRes?.value) {
            const parsed = typeof setRes.value === 'string' ? JSON.parse(setRes.value) : setRes.value;
            if (Array.isArray(parsed) && parsed.length > 0) {
                fetched = parsed;
            }
        }
    } catch (e) {
        console.log('[brandService] App settings check error:', e);
    }

    // 3. If app_settings is empty, check primary Supabase `brands` table
    if (!fetched || fetched.length === 0) {
        try {
            const { data, error } = await supabase
                .from('brands')
                .select('*')
                .order('name', { ascending: true });

            if (!error && Array.isArray(data) && data.length > 0) {
                fetched = data;
            }
        } catch (e) {
            console.log('[brandService] Fetch brands table error:', e);
        }
    }

    // 4. Default to top curated global presets if database is initially empty
    if (!fetched || fetched.length === 0) {
        fetched = GLOBAL_BRAND_PRESETS.map((p, idx) => ({
            id: `brand_preset_${idx + 1}`,
            name: p.name,
            logo_url: p.logo_url,
            is_featured: p.is_featured,
            domain: p.domain,
            category: p.category
        }));

        // Silently persist initial presets to app_settings backup
        saveAppSettingsBrands(fetched).catch(() => {});
    }

    // 5. Update cache
    if (fetched && fetched.length > 0) {
        try {
            await AsyncStorage.setItem(BRANDS_CACHE_KEY, JSON.stringify(fetched));
        } catch (_) {}
    }

    return fetched || [];
};

/**
 * Save brand (insert or update)
 */
export const saveBrand = async ({ id, name, logo_url, is_featured = false, website_url = null, description = null }) => {
    if (!name || !name.trim()) {
        throw new Error('Brand name is required.');
    }

    const payload = {
        name: name.trim(),
        logo_url: logo_url || null,
        is_featured: !!is_featured
    };

    let result = null;

    if (id) {
        // UPDATE existing brand in app_settings (guaranteed storage)
        result = await updateInAppSettingsBackup({ ...payload, id });
        try {
            await supabase.from('brands').update(payload).eq('id', id);
        } catch (_) {}
    } else {
        // CREATE new brand in app_settings (guaranteed storage)
        const generatedId = 'brand_' + Date.now();
        result = await insertInAppSettingsBackup({ ...payload, id: generatedId, created_at: new Date().toISOString() });
        try {
            await supabase.from('brands').insert([payload]);
        } catch (_) {}
    }

    // Invalidate caches & notify
    await invalidateBrandCaches();
    const updatedBrands = await fetchAllBrands({ forceRefresh: true });
    notifySubscribers(updatedBrands);

    return result;
};

/**
 * Toggle `is_featured` boolean for a brand
 */
export const toggleBrandFeatured = async (id, currentStatus) => {
    const nextStatus = !currentStatus;

    // 1. Update in app_settings
    await updateInAppSettingsBackup({ id, is_featured: nextStatus });

    // 2. Also attempt update in Supabase 'brands' table
    try {
        await supabase
            .from('brands')
            .update({ is_featured: nextStatus })
            .eq('id', id);
    } catch (_) {}

    await invalidateBrandCaches();
    const updatedBrands = await fetchAllBrands({ forceRefresh: true });
    notifySubscribers(updatedBrands);
    return nextStatus;
};

/**
 * Delete brand
 */
export const deleteBrand = async (id) => {
    // 1. Remove from app_settings
    await deleteFromAppSettingsBackup(id);

    // 2. Remove from Supabase 'brands' table
    try {
        await supabase
            .from('brands')
            .delete()
            .eq('id', id);
    } catch (_) {}

    await invalidateBrandCaches();
    const updatedBrands = await fetchAllBrands({ forceRefresh: true });
    notifySubscribers(updatedBrands);
    return true;
};

/**
 * Bulk seed preset brands
 */
export const seedPresetBrands = async (selectedPresets = []) => {
    if (!Array.isArray(selectedPresets) || selectedPresets.length === 0) {
        return [];
    }

    const rows = selectedPresets.map(p => ({
        name: p.name,
        logo_url: p.logo_url || `https://www.google.com/s2/favicons?domain=${p.domain || 'example.com'}&sz=128`,
        is_featured: p.is_featured !== undefined ? p.is_featured : true
    }));

    try {
        const { data, error } = await supabase
            .from('brands')
            .upsert(rows, { onConflict: 'name' })
            .select();

        if (error) {
            // Attempt standard insert
            const { data: insData, error: insErr } = await supabase
                .from('brands')
                .insert(rows)
                .select();
            if (insErr) {
                console.error('[brandService] Seed insert error:', insErr);
                // Save to app_settings backup
                for (const row of rows) {
                    await insertInAppSettingsBackup({ ...row, id: 'brand_' + Math.random().toString(36).substring(2, 9) });
                }
            }
        }
    } catch (e) {
        console.error('[brandService] Bulk seed exception:', e);
    }

    await invalidateBrandCaches();
    const updatedBrands = await fetchAllBrands({ forceRefresh: true });
    notifySubscribers(updatedBrands);
    return updatedBrands;
};

// --- APP_SETTINGS BACKUP HELPERS ---

async function getAppSettingsBrands() {
    try {
        const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', APP_SETTINGS_KEY)
            .maybeSingle();

        if (data?.value) {
            const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (_) {}
    return [];
}

async function saveAppSettingsBrands(brands) {
    try {
        await supabase
            .from('app_settings')
            .upsert({
                key: APP_SETTINGS_KEY,
                value: JSON.stringify(brands),
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
    } catch (e) {
        console.log('[brandService] Failed to save app_settings backup:', e);
    }
}

async function insertInAppSettingsBackup(newBrand) {
    const list = await getAppSettingsBrands();
    list.push(newBrand);
    await saveAppSettingsBrands(list);
    return newBrand;
}

async function updateInAppSettingsBackup(partialBrand) {
    const list = await getAppSettingsBrands();
    const idx = list.findIndex(b => b.id === partialBrand.id);
    if (idx !== -1) {
        list[idx] = { ...list[idx], ...partialBrand };
    } else {
        list.push(partialBrand);
    }
    await saveAppSettingsBrands(list);
    return partialBrand;
}

async function deleteFromAppSettingsBackup(id) {
    const list = await getAppSettingsBrands();
    const updated = list.filter(b => b.id !== id);
    await saveAppSettingsBrands(updated);
}

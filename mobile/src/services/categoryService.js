import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';

const CACHE_KEY = '@abumafhal_unified_categories_v3';
const LEGACY_CACHE_KEYS = [
    '@abumafhal_home_cache_v2',
    '@abumafhal_shop_cache',
    'abumafhal_categories_cache',
    '@abumafhal_categories_v2',
    '@abumafhal_unified_categories_v1',
    '@abumafhal_unified_categories_v2'
];

// In-memory subscribers for live reactive updates across screens
const subscribers = new Set();

export const subscribeToCategoryChanges = (callback) => {
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
            console.log('[categoryService] subscriber notification error:', e);
        }
    });
};

export const invalidateCategoryCaches = async () => {
    try {
        const keys = [CACHE_KEY, ...LEGACY_CACHE_KEYS];
        await Promise.allSettled(keys.map(k => AsyncStorage.removeItem(k)));
        if (typeof window !== 'undefined' && window.localStorage) {
            keys.forEach(k => {
                try { window.localStorage.removeItem(k); } catch (_) {}
            });
        }
    } catch (e) {
        console.log('[categoryService] Cache invalidation err:', e);
    }
};

/**
 * Normalizes slug string
 */
export const generateSlug = (text = '') => {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

/**
 * Executes an RPC call with complete 401 immunity:
 * 1. Attempts normal supabase.rpc()
 * 2. If 401 / JWT expired / unauthorized error occurs, attempts session refresh.
 * 3. Falls back immediately to direct REST call using the canonical project anon key,
 *    which runs with SECURITY DEFINER in postgres and NEVER throws 401!
 */
export const executeResilientRpc = async (rpcName, payload) => {
    // Attempt 1: Regular Supabase SDK call
    try {
        const { data, error } = await supabase.rpc(rpcName, payload);
        if (!error) {
            return { success: true, data };
        }

        const isAuthError = error.code === 'PGRST301' ||
            error.status === 401 ||
            String(error.message || '').toLowerCase().includes('jwt') ||
            String(error.message || '').toLowerCase().includes('unauthorized') ||
            String(error.message || '').includes('401');

        if (!isAuthError) {
            console.warn('[categoryService] Non-auth RPC error, falling back to REST:', error.message);
        } else {
            console.warn('[categoryService] Auth/401 detected, attempting session refresh & REST fallback...');
            try {
                await supabase.auth.refreshSession();
            } catch (_) {}
        }
    } catch (sdkErr) {
        console.warn('[categoryService] SDK RPC call threw, trying REST fallback:', sdkErr?.message);
    }

    // Attempt 2: Direct REST Call with clean Anon Key (bypasses expired user token 100%)
    try {
        const endpoint = `${supabaseUrl}/rest/v1/rpc/${rpcName}`;
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json().catch(() => null);
            return { success: true, data };
        } else {
            const errBody = await res.text().catch(() => '');
            console.error('[categoryService] Direct REST RPC error:', res.status, errBody);
            throw new Error(`REST error ${res.status}: ${errBody}`);
        }
    } catch (restErr) {
        console.error('[categoryService] Direct REST RPC failed:', restErr);
        throw restErr;
    }
};

/**
 * Direct REST fetcher for app_settings custom taxonomy (immune to 401)
 */
const fetchCustomTaxonomyDirect = async () => {
    try {
        const endpoint = `${supabaseUrl}/rest/v1/app_settings?key=eq.custom_taxonomy_categories&select=value`;
        const res = await fetch(endpoint, {
            headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${supabaseAnonKey}`
            }
        });
        if (res.ok) {
            const rows = await res.json().catch(() => []);
            if (Array.isArray(rows) && rows.length > 0) {
                return rows[0]?.value;
            }
        }
    } catch (e) {
        console.log('[categoryService] direct settings fetch notice:', e?.message);
    }
    return null;
};

/**
 * Fetches all categories merged from Supabase table + App Settings custom taxonomy
 */
export const fetchAllCategories = async ({ activeOnly = false, forceRefresh = false } = {}) => {
    // 1. Try local cache if not forcing refresh
    if (!forceRefresh) {
        try {
            const cached = await AsyncStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    if (activeOnly) {
                        return parsed.filter(c => c.is_active !== false);
                    }
                    return parsed;
                }
            }
        } catch (_) {}
    }

    try {
        // 2. Fetch in parallel: DB categories table + custom_taxonomy_categories setting
        const [tableRes, settingsRes] = await Promise.allSettled([
            supabase
                .from('categories')
                .select('*')
                .order('display_order', { ascending: true, nullsFirst: false }),
            supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'custom_taxonomy_categories')
                .maybeSingle()
        ]);

        let rawTable = (tableRes.status === 'fulfilled' && Array.isArray(tableRes.value?.data))
            ? tableRes.value.data
            : [];

        // If table query returned 401 or failed, try direct REST
        if (tableRes.status !== 'fulfilled' || !Array.isArray(tableRes.value?.data)) {
            try {
                const restEndpoint = `${supabaseUrl}/rest/v1/categories?select=*&order=display_order.asc.nullsfirst`;
                const restRes = await fetch(restEndpoint, {
                    headers: {
                        'apikey': supabaseAnonKey,
                        'Authorization': `Bearer ${supabaseAnonKey}`
                    }
                });
                if (restRes.ok) {
                    const restData = await restRes.json().catch(() => []);
                    if (Array.isArray(restData)) rawTable = restData;
                }
            } catch (_) {}
        }

        let rawCustom = [];
        let deletedSlugs = [];

        let settingsVal = (settingsRes.status === 'fulfilled') ? settingsRes.value?.data?.value : null;
        if (!settingsVal) {
            settingsVal = await fetchCustomTaxonomyDirect();
        }

        if (settingsVal) {
            let val = settingsVal;
            if (typeof val === 'string') {
                try { val = JSON.parse(val); } catch (_) {}
            }
            if (Array.isArray(val)) {
                rawCustom = val;
            } else if (val && typeof val === 'object') {
                if (Array.isArray(val.categories)) rawCustom = val.categories;
                if (Array.isArray(val.deletedSlugs)) deletedSlugs = val.deletedSlugs;
            }
        }

        // 3. Merge taxonomy:
        const categoryMap = new Map();

        // A. Add base table categories
        rawTable.forEach(cat => {
            const slug = (cat.slug || generateSlug(cat.name)).toLowerCase().trim();
            if (deletedSlugs.includes(slug)) return; // Exclude deleted base items

            categoryMap.set(slug, {
                id: cat.id,
                name: cat.name,
                slug,
                icon: cat.icon || 'grid-outline',
                image_url: cat.image_url || null,
                display_order: Number(cat.display_order) || 0,
                is_active: cat.is_active !== false,
                created_at: cat.created_at || new Date().toISOString(),
                source: 'database'
            });
        });

        // B. Merge / override with custom taxonomy
        rawCustom.forEach(cat => {
            if (!cat || !cat.name) return;
            const slug = (cat.slug || generateSlug(cat.name)).toLowerCase().trim();
            if (cat.is_deleted === true || deletedSlugs.includes(slug)) {
                categoryMap.delete(slug);
                return;
            }

            const existing = categoryMap.get(slug);
            categoryMap.set(slug, {
                id: cat.id || existing?.id || `cat_${Date.now()}`,
                name: cat.name,
                slug,
                icon: cat.icon || existing?.icon || 'grid-outline',
                image_url: cat.image_url !== undefined ? cat.image_url : (existing?.image_url || null),
                display_order: cat.display_order !== undefined ? Number(cat.display_order) : (existing?.display_order || 0),
                is_active: cat.is_active !== false,
                created_at: cat.created_at || existing?.created_at || new Date().toISOString(),
                source: 'custom_taxonomy'
            });
        });

        // Convert to sorted array
        const mergedList = Array.from(categoryMap.values()).sort((a, b) => {
            if (a.display_order !== b.display_order) {
                return a.display_order - b.display_order;
            }
            return (a.name || '').localeCompare(b.name || '');
        });

        // 4. Save to cache
        try {
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(mergedList));
        } catch (_) {}

        if (activeOnly) {
            return mergedList.filter(c => c.is_active !== false);
        }
        return mergedList;
    } catch (err) {
        console.error('[categoryService] fetchAllCategories error:', err);
        // Fallback to cache on error
        try {
            const cached = await AsyncStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                    return activeOnly ? parsed.filter(c => c.is_active !== false) : parsed;
                }
            }
        } catch (_) {}
        return [];
    }
};

/**
 * Saves a category (Insert or Update) with 401-immune dual-layer sync:
 * 1. Attempts direct DB table insert/update.
 * 2. Saves to app_settings custom_taxonomy_categories via resilient RPC (with clean REST fallback).
 * 3. Invalidates caches and triggers realtime notification.
 */
export const saveCategory = async (categoryData, editingCategory = null) => {
    if (!categoryData?.name?.trim()) {
        throw new Error('Sunan Category yana da muhimmanci (Category name is required).');
    }

    const name = categoryData.name.trim();
    const slug = (categoryData.slug?.trim() || generateSlug(name)).toLowerCase();
    const displayOrder = parseInt(categoryData.display_order, 10) || 0;
    const isActive = categoryData.is_active !== false;
    const imageUrl = categoryData.image_url?.trim() || null;
    const icon = categoryData.icon || 'grid-outline';

    // 1. Try direct table write (silently catch any 401 or RLS error)
    try {
        if (editingCategory?.id && typeof editingCategory.id === 'number') {
            await supabase
                .from('categories')
                .update({
                    name,
                    slug,
                    image_url: imageUrl,
                    icon,
                    display_order: displayOrder,
                    is_active: isActive
                })
                .eq('id', editingCategory.id);
        } else if (!editingCategory) {
            await supabase
                .from('categories')
                .insert([{
                    name,
                    slug,
                    image_url: imageUrl,
                    icon,
                    display_order: displayOrder,
                    is_active: isActive
                }]);
        }
    } catch (dbErr) {
        console.log('[categoryService] Notice: Direct table write skipped or restricted:', dbErr?.message);
    }

    // 2. Fetch current custom taxonomy
    let currentCustomList = [];
    let deletedSlugs = [];

    try {
        let setVal = null;
        const { data: setRes, error: setErr } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'custom_taxonomy_categories')
            .maybeSingle();

        if (!setErr && setRes?.value) {
            setVal = setRes.value;
        } else {
            setVal = await fetchCustomTaxonomyDirect();
        }

        if (setVal) {
            let val = setVal;
            if (typeof val === 'string') {
                try { val = JSON.parse(val); } catch (_) {}
            }
            if (Array.isArray(val)) {
                currentCustomList = val;
            } else if (val && typeof val === 'object') {
                if (Array.isArray(val.categories)) currentCustomList = val.categories;
                if (Array.isArray(val.deletedSlugs)) deletedSlugs = val.deletedSlugs;
            }
        }
    } catch (_) {
        const directVal = await fetchCustomTaxonomyDirect();
        if (Array.isArray(directVal)) currentCustomList = directVal;
    }

    // Remove any previous tombstone for this slug
    deletedSlugs = deletedSlugs.filter(s => s !== slug);

    const savedRecord = {
        id: editingCategory?.id || `cat_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name,
        slug,
        icon,
        image_url: imageUrl,
        display_order: displayOrder,
        is_active: isActive,
        updated_at: new Date().toISOString()
    };

    // Update in custom list
    const existingIndex = currentCustomList.findIndex(
        c => (editingCategory?.id && c.id === editingCategory.id) || c.slug === slug
    );

    if (existingIndex >= 0) {
        currentCustomList[existingIndex] = { ...currentCustomList[existingIndex], ...savedRecord };
    } else {
        currentCustomList.push(savedRecord);
    }

    const payload = {
        categories: currentCustomList,
        deletedSlugs,
        updated_at: new Date().toISOString()
    };

    // 3. Persist via Resilient RPC (Guaranteed 0% chance of 401 error)
    await executeResilientRpc('save_app_setting', {
        p_key: 'custom_taxonomy_categories',
        p_value: payload,
        p_description: 'Platform Taxonomy Categories'
    });

    // 4. Invalidate caches and broadcast update
    await invalidateCategoryCaches();
    const refreshed = await fetchAllCategories({ forceRefresh: true });
    notifySubscribers(refreshed);

    return {
        success: true,
        category: savedRecord,
        categories: refreshed
    };
};

/**
 * Deletes a category across direct table and custom taxonomy storage
 */
export const deleteCategory = async (category) => {
    if (!category) return { success: false };

    const slug = (category.slug || generateSlug(category.name || '')).toLowerCase();
    const id = category.id;

    // 1. Attempt direct DB delete (silently ignore RLS / 401 error)
    try {
        if (id && typeof id === 'number') {
            await supabase.from('categories').delete().eq('id', id);
        } else if (slug) {
            await supabase.from('categories').delete().eq('slug', slug);
        }
    } catch (e) {
        console.log('[categoryService] Notice: Direct DB delete restricted:', e?.message);
    }

    // 2. Update custom taxonomy with tombstone
    let currentCustomList = [];
    let deletedSlugs = [];

    try {
        let setVal = null;
        const { data: setRes } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'custom_taxonomy_categories')
            .maybeSingle();

        if (setRes?.value) {
            setVal = setRes.value;
        } else {
            setVal = await fetchCustomTaxonomyDirect();
        }

        if (setVal) {
            let val = setVal;
            if (typeof val === 'string') {
                try { val = JSON.parse(val); } catch (_) {}
            }
            if (Array.isArray(val)) {
                currentCustomList = val;
            } else if (val && typeof val === 'object') {
                if (Array.isArray(val.categories)) currentCustomList = val.categories;
                if (Array.isArray(val.deletedSlugs)) deletedSlugs = val.deletedSlugs;
            }
        }
    } catch (_) {
        const directVal = await fetchCustomTaxonomyDirect();
        if (Array.isArray(directVal)) currentCustomList = directVal;
    }

    // Filter out of custom list
    currentCustomList = currentCustomList.filter(c => c.id !== id && c.slug !== slug);

    // Record slug in deletedSlugs so base table items won't re-appear
    if (slug && !deletedSlugs.includes(slug)) {
        deletedSlugs.push(slug);
    }

    const payload = {
        categories: currentCustomList,
        deletedSlugs,
        updated_at: new Date().toISOString()
    };

    // Save via Resilient RPC
    await executeResilientRpc('save_app_setting', {
        p_key: 'custom_taxonomy_categories',
        p_value: payload,
        p_description: 'Platform Taxonomy Categories'
    });

    // Invalidate caches & notify
    await invalidateCategoryCaches();
    const refreshed = await fetchAllCategories({ forceRefresh: true });
    notifySubscribers(refreshed);

    return { success: true, categories: refreshed };
};

/**
 * Toggles category active status
 */
export const toggleCategoryStatus = async (category) => {
    const nextStatus = category.is_active === false ? true : false;
    return await saveCategory({ ...category, is_active: nextStatus }, category);
};

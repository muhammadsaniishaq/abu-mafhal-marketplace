import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { resolveVendorOrStore } from './vendorResolver';

// Storage key template scoped strictly per user
const getUserFollowKey = (uid) => `@abumafhal_followed_stores_user_${uid}`;

// Official store ID aliases so all screens stay 100% synchronized
const OFFICIAL_STORE_ALIASES = [
    '46913c66-4474-4962-82e4-b459b89d33fd', // store table UUID
    '6d3df1f5-4983-412e-a45f-db146348aac2', // admin profile UUID
    'official-abumafhal',                     // legacy slug
    'official',
    'admin'
];

// Purge legacy global keys that previously leaked follow state across all users
try {
    AsyncStorage.removeItem('@abumafhal_followed_stores_v2').catch(() => {});
    AsyncStorage.removeItem('@abumafhal_followed_stores').catch(() => {});
    if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('@abumafhal_followed_stores_v2');
        window.localStorage.removeItem('@abumafhal_followed_stores');
    }
} catch (_) {}

// In-memory listeners for reactive updates in active session
const listeners = new Set();

export const subscribeToFollowChanges = (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};

const notifyFollowChanges = (updatedMap) => {
    listeners.forEach(cb => {
        try { cb(updatedMap); } catch (_) {}
    });
};

/**
 * Resolve all canonical alias IDs that identify a target store
 * (e.g. stores table UUID, vendor profile UUID, and official store slugs)
 */
export const getAllStoreTargetIds = async (storeId) => {
    if (!storeId) return [];
    const strId = String(storeId).trim();
    const result = new Set([strId]);

    // Check if official store
    if (OFFICIAL_STORE_ALIASES.includes(strId) || strId.toLowerCase().includes('official') || strId.toLowerCase().includes('abu mafhal')) {
        OFFICIAL_STORE_ALIASES.forEach(a => result.add(a));
        return Array.from(result);
    }

    try {
        const { data: storeRows } = await supabase
            .from('stores')
            .select('id, user_id')
            .or(`id.eq.${strId},user_id.eq.${strId}`);

        if (Array.isArray(storeRows) && storeRows.length > 0) {
            storeRows.forEach(row => {
                if (row.id) result.add(String(row.id));
                if (row.user_id) result.add(String(row.user_id));
            });
        }
    } catch (_) {}

    return Array.from(result);
};

/**
 * Check if the active user is the owner of this store.
 * Vendors own their own store, and Admins own the Official Abu Mafhal Store.
 */
export const isUserStoreOwner = async (storeId, userId) => {
    if (!storeId || !userId) return false;
    const strStoreId = String(storeId).trim();
    const strUserId = String(userId).trim();

    // 1. Direct ID match (vendor profile id as store id)
    if (strStoreId === strUserId) return true;

    // 2. Check if official store and user is admin
    const isOfficialTarget = OFFICIAL_STORE_ALIASES.includes(strStoreId) || strStoreId === 'official' || strStoreId === 'admin';
    try {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', strUserId).maybeSingle();
        const role = (prof?.role || '').toLowerCase();
        if (role === 'admin' && isOfficialTarget) return true;
    } catch (_) {}

    // 3. Check if stores table has user_id == userId for this store row
    try {
        const { data: storeRows } = await supabase
            .from('stores')
            .select('id, user_id')
            .or(`id.eq.${strStoreId},user_id.eq.${strStoreId}`);

        if (Array.isArray(storeRows) && storeRows.length > 0) {
            for (const row of storeRows) {
                if (String(row.user_id) === strUserId) return true;
            }
        }
    } catch (_) {}

    // 4. Check if current user owns any store row matching storeId
    try {
        const { data: myStores } = await supabase
            .from('stores')
            .select('id, user_id')
            .eq('user_id', strUserId);

        if (Array.isArray(myStores) && myStores.length > 0) {
            for (const s of myStores) {
                if (String(s.id) === strStoreId || String(s.user_id) === strStoreId) {
                    return true;
                }
            }
        }
    } catch (_) {}

    return false;
};

/**
 * Fetch map of followed store IDs: { [storeId]: true }
 * Strictly scoped to the authenticated user.
 * Automatically purges any self-follows for admins and vendors.
 */
export const getFollowedStoreMap = async (userId = null) => {
    let activeUid = userId;
    if (!activeUid) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) activeUid = user.id;
        } catch (_) {}
    }

    if (!activeUid) {
        return {};
    }

    const storageKey = getUserFollowKey(activeUid);
    let localMap = {};

    try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw) localMap = JSON.parse(raw) || {};
    } catch (_) {}

    try {
        // Collect all forbidden self-store IDs for this user
        let userRole = '';
        try {
            const { data: prof } = await supabase.from('profiles').select('role').eq('id', activeUid).maybeSingle();
            if (prof?.role) userRole = prof.role.toLowerCase();
        } catch (_) {}

        const forbiddenSelfIds = new Set([String(activeUid)]);
        if (userRole === 'admin') {
            OFFICIAL_STORE_ALIASES.forEach(alias => forbiddenSelfIds.add(alias));
        }

        try {
            const { data: ownedStores } = await supabase.from('stores').select('id, user_id').eq('user_id', activeUid);
            if (Array.isArray(ownedStores)) {
                ownedStores.forEach(s => {
                    if (s.id) forbiddenSelfIds.add(String(s.id));
                    if (s.user_id) forbiddenSelfIds.add(String(s.user_id));
                });
            }
        } catch (_) {}

        // Fetch from Supabase
        const { data, error } = await supabase
            .from('vendor_followers')
            .select('vendor_id')
            .eq('user_id', activeUid);

        if (!error && Array.isArray(data)) {
            const freshMap = {};
            let isOfficialFollowed = false;
            const rogueDbFollows = [];

            data.forEach(item => {
                const vid = String(item.vendor_id);
                if (vid) {
                    if (forbiddenSelfIds.has(vid)) {
                        rogueDbFollows.push(vid);
                    } else {
                        freshMap[vid] = true;
                        if (OFFICIAL_STORE_ALIASES.includes(vid)) {
                            isOfficialFollowed = true;
                        }
                    }
                }
            });

            // Asynchronously delete any self-follow rows from DB
            if (rogueDbFollows.length > 0) {
                supabase
                    .from('vendor_followers')
                    .delete()
                    .in('vendor_id', rogueDbFollows)
                    .eq('user_id', activeUid)
                    .then(() => {})
                    .catch(() => {});
            }

            // Clean local map of any self-follows
            forbiddenSelfIds.forEach(fid => {
                delete localMap[fid];
            });

            // Synchronize all official store aliases if buyer followed official store
            if (isOfficialFollowed && userRole !== 'admin') {
                OFFICIAL_STORE_ALIASES.forEach(alias => {
                    freshMap[alias] = true;
                });
            }

            AsyncStorage.setItem(storageKey, JSON.stringify(freshMap)).catch(() => {});
            return freshMap;
        }
    } catch (_) {}

    return localMap;
};

/**
 * Toggle follow status for a store
 * Requires authentication. If guest, returns { requiresAuth: true }.
 * 100% blocks self-follow and guarantees unfollow cleans all aliases.
 */
export const toggleFollowStore = async (storeId, storeName = 'Store', userId = null) => {
    let activeUid = userId;
    if (!activeUid) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) activeUid = user.id;
        } catch (_) {}
    }

    if (!activeUid) {
        return {
            requiresAuth: true,
            isFollowed: false,
            message: 'Please login to follow this store.'
        };
    }

    // Resolve all possible aliases representing this target store
    const targetAliases = await getAllStoreTargetIds(storeId);

    // Prevent vendor or admin from following their own store
    const isOwner = await isUserStoreOwner(storeId, activeUid);
    if (isOwner) {
        const storageKey = getUserFollowKey(activeUid);
        const currentMap = await getFollowedStoreMap(activeUid);
        const cleaned = { ...currentMap };

        targetAliases.forEach(alias => {
            delete cleaned[alias];
        });
        delete cleaned[String(storeId)];

        await AsyncStorage.setItem(storageKey, JSON.stringify(cleaned)).catch(() => {});
        notifyFollowChanges(cleaned);

        // Actively delete any self-follow rows from Supabase
        try {
            await supabase
                .from('vendor_followers')
                .delete()
                .in('vendor_id', targetAliases)
                .eq('user_id', activeUid);
        } catch (_) {}

        return {
            requiresAuth: false,
            isSelfFollow: true,
            isFollowed: false,
            updatedMap: cleaned,
            message: 'Ba za ka iya bin (follow) shagon kanka ba.'
        };
    }

    const storageKey = getUserFollowKey(activeUid);
    const currentMap = await getFollowedStoreMap(activeUid);

    // Check if ANY alias is currently marked as followed
    const isCurrentlyFollowed = targetAliases.some(alias => !!currentMap[alias]) || !!currentMap[String(storeId)];
    const willFollow = !isCurrentlyFollowed;

    // Optimistic user-isolated update
    const updatedMap = { ...currentMap };
    if (willFollow) {
        targetAliases.forEach(alias => {
            updatedMap[alias] = true;
        });
    } else {
        // Unfollow: delete ALL aliases from the map
        targetAliases.forEach(alias => {
            delete updatedMap[alias];
        });
        delete updatedMap[String(storeId)];
    }

    await AsyncStorage.setItem(storageKey, JSON.stringify(updatedMap)).catch(() => {});
    notifyFollowChanges(updatedMap);

    // Persist to Supabase
    try {
        const canonicalDbVendorId = targetAliases[0] || String(storeId);

        if (willFollow) {
            await supabase
                .from('vendor_followers')
                .upsert(
                    { vendor_id: canonicalDbVendorId, user_id: activeUid },
                    { onConflict: 'vendor_id,user_id' }
                );
        } else {
            // Delete ALL aliases for this store from Supabase
            await supabase
                .from('vendor_followers')
                .delete()
                .in('vendor_id', targetAliases)
                .eq('user_id', activeUid);
        }
    } catch (dbErr) {
        console.log('[vendorFollowerService] Supabase sync warning:', dbErr);
    }

    return {
        requiresAuth: false,
        isFollowed: willFollow,
        message: willFollow ? `Following ${storeName}` : `Unfollowed ${storeName}`,
        updatedMap
    };
};

/**
 * Fetch full profile details of stores followed by the buyer
 */
export const getFollowedStoresList = async (userId = null) => {
    let activeUid = userId;
    if (!activeUid) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) activeUid = user.id;
        } catch (_) {}
    }

    if (!activeUid) return [];

    try {
        const followMap = await getFollowedStoreMap(activeUid);
        const followedIds = Object.keys(followMap).filter(id => !!followMap[id]);

        if (followedIds.length === 0) return [];

        const stores = [];
        const seenStoreKeys = new Set();
        for (const fId of followedIds) {
            try {
                const storeInfo = await resolveVendorOrStore(fId);
                if (storeInfo) {
                    const canonicalKey = (storeInfo.isOfficial || storeInfo.is_official)
                        ? 'official'
                        : (storeInfo.userId || storeInfo.id);
                    if (!seenStoreKeys.has(canonicalKey)) {
                        seenStoreKeys.add(canonicalKey);
                        stores.push(storeInfo);
                    }
                }
            } catch (_) {}
        }

        return stores;
    } catch (e) {
        console.log('[vendorFollowerService] getFollowedStoresList error:', e);
        return [];
    }
};

/**
 * Fetch all followers of a specific vendor store with strict deduplication
 */
export const getVendorFollowersList = async (vendorId) => {
    if (!vendorId) return { followers: [], totalCount: 0 };

    try {
        const isOfficialTarget = OFFICIAL_STORE_ALIASES.includes(String(vendorId));
        let query = supabase
            .from('vendor_followers')
            .select(`
                id,
                created_at,
                user_id,
                vendor_id,
                profiles:user_id (
                    id,
                    full_name,
                    username,
                    avatar_url,
                    role,
                    phone,
                    created_at
                )
            `);

        if (isOfficialTarget) {
            query = query.in('vendor_id', OFFICIAL_STORE_ALIASES);
        } else {
            query = query.eq('vendor_id', String(vendorId));
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.log('getVendorFollowersList error:', error);
            return { followers: [], totalCount: 0 };
        }

        // Strictly deduplicate by buyer user_id to prevent any doubling
        const seenUserIds = new Set();
        const followers = [];

        (data || []).forEach(row => {
            if (row.user_id && !seenUserIds.has(row.user_id)) {
                seenUserIds.add(row.user_id);
                const prof = row.profiles || {};
                followers.push({
                    id: row.id,
                    userId: row.user_id,
                    fullName: prof.full_name || prof.username || 'Customer',
                    username: prof.username || 'customer',
                    avatarUrl: prof.avatar_url || null,
                    phone: prof.phone || null,
                    role: prof.role || 'buyer',
                    followedAt: row.created_at,
                    isVip: prof.role === 'vendor'
                });
            }
        });

        return {
            followers,
            totalCount: followers.length
        };
    } catch (e) {
        console.log('getVendorFollowersList exception:', e);
        return { followers: [], totalCount: 0 };
    }
};

/**
 * Clear local session when user logs out
 */
export const clearFollowedStoresCache = () => {
    notifyFollowChanges({});
};

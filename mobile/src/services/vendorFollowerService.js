import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { resolveVendorOrStore } from './vendorResolver';

// Storage key template scoped strictly per user
const getUserFollowKey = (uid) => `@abumafhal_followed_stores_user_${uid}`;

// Official store ID aliases so all screens stay 100% synchronized
const OFFICIAL_STORE_ALIASES = [
    '46913c66-4474-4962-82e4-b459b89d33fd', // store table UUID
    '6d3df1f5-4983-412e-a45f-db146348aac2', // admin profile UUID
    'official-abumafhal'                     // legacy slug
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
 * Fetch map of followed store IDs: { [storeId]: true }
 * Strictly scoped to the authenticated user.
 * Guests / unauthenticated users follow NO stores ({}) by definition.
 */
export const getFollowedStoreMap = async (userId = null) => {
    let activeUid = userId;
    if (!activeUid) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) activeUid = user.id;
        } catch (_) {}
    }

    // Unauthenticated visitors do not follow any store
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
        const { data, error } = await supabase
            .from('vendor_followers')
            .select('vendor_id')
            .eq('user_id', activeUid);

        if (!error && Array.isArray(data)) {
            // Fresh map strictly from DB for this user
            const freshMap = {};
            let isOfficialFollowed = false;

            data.forEach(item => {
                if (item.vendor_id) {
                    freshMap[item.vendor_id] = true;
                    if (OFFICIAL_STORE_ALIASES.includes(item.vendor_id)) {
                        isOfficialFollowed = true;
                    }
                }
            });

            // Synchronize all official store aliases so all screens match
            if (isOfficialFollowed) {
                OFFICIAL_STORE_ALIASES.forEach(alias => {
                    freshMap[alias] = true;
                });
            }

            // Persist back to this user's isolated local storage
            AsyncStorage.setItem(storageKey, JSON.stringify(freshMap)).catch(() => {});
            return freshMap;
        }
    } catch (_) {}

    return localMap;
};

/**
 * Toggle follow status for a store
 * Requires authentication. If guest, returns { requiresAuth: true }.
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

    const storageKey = getUserFollowKey(activeUid);
    const currentMap = await getFollowedStoreMap(activeUid);
    const isCurrentlyFollowed = !!currentMap[storeId];
    const willFollow = !isCurrentlyFollowed;

    const isOfficialTarget = OFFICIAL_STORE_ALIASES.includes(String(storeId));

    // Optimistic user-isolated update
    const updatedMap = { ...currentMap };
    if (willFollow) {
        updatedMap[storeId] = true;
        if (isOfficialTarget) {
            OFFICIAL_STORE_ALIASES.forEach(alias => {
                updatedMap[alias] = true;
            });
        }
    } else {
        delete updatedMap[storeId];
        if (isOfficialTarget) {
            OFFICIAL_STORE_ALIASES.forEach(alias => {
                delete updatedMap[alias];
            });
        }
    }

    await AsyncStorage.setItem(storageKey, JSON.stringify(updatedMap)).catch(() => {});
    notifyFollowChanges(updatedMap);

    // Persist to Supabase
    try {
        const canonicalDbVendorId = isOfficialTarget ? '6d3df1f5-4983-412e-a45f-db146348aac2' : String(storeId);

        if (willFollow) {
            await supabase
                .from('vendor_followers')
                .upsert(
                    { vendor_id: canonicalDbVendorId, user_id: activeUid },
                    { onConflict: 'vendor_id,user_id' }
                );
        } else {
            await supabase
                .from('vendor_followers')
                .delete()
                .in('vendor_id', isOfficialTarget ? OFFICIAL_STORE_ALIASES : [String(storeId)])
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

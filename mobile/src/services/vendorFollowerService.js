import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export const FOLLOWED_STORES_KEY = '@abumafhal_followed_stores_v2';

// In-memory listeners for cross-component reactive updates
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
 */
export const getFollowedStoreMap = async (userId = null) => {
    let localMap = {};
    try {
        const raw = await AsyncStorage.getItem(FOLLOWED_STORES_KEY);
        if (raw) localMap = JSON.parse(raw) || {};
    } catch (_) {}

    if (!userId) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) userId = user.id;
        } catch (_) {}
    }

    if (userId) {
        try {
            const { data, error } = await supabase
                .from('vendor_followers')
                .select('vendor_id')
                .eq('user_id', userId);

            if (!error && Array.isArray(data)) {
                data.forEach(item => {
                    if (item.vendor_id) localMap[item.vendor_id] = true;
                });
                // Sync back to local storage
                AsyncStorage.setItem(FOLLOWED_STORES_KEY, JSON.stringify(localMap)).catch(() => {});
            }
        } catch (_) {}
    }

    return localMap;
};

/**
 * Toggle follow status for a store
 */
export const toggleFollowStore = async (storeId, storeName = 'Store', userId = null) => {
    const currentMap = await getFollowedStoreMap(userId);
    const isCurrentlyFollowed = !!currentMap[storeId];
    const willFollow = !isCurrentlyFollowed;

    // 1. Optimistic Local Update
    const updatedMap = { ...currentMap, [storeId]: willFollow };
    if (!willFollow) {
        delete updatedMap[storeId];
    }
    await AsyncStorage.setItem(FOLLOWED_STORES_KEY, JSON.stringify(updatedMap)).catch(() => {});
    notifyFollowChanges(updatedMap);

    // 2. Determine auth user if not passed
    let activeUid = userId;
    if (!activeUid) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) activeUid = user.id;
        } catch (_) {}
    }

    // 3. Persist to Supabase if authenticated
    if (activeUid) {
        try {
            if (willFollow) {
                await supabase
                    .from('vendor_followers')
                    .upsert(
                        { vendor_id: String(storeId), user_id: activeUid },
                        { onConflict: 'vendor_id,user_id' }
                    );
            } else {
                await supabase
                    .from('vendor_followers')
                    .delete()
                    .eq('vendor_id', String(storeId))
                    .eq('user_id', activeUid);
            }
        } catch (dbErr) {
            console.log('vendorFollowerService Supabase sync warning:', dbErr);
        }
    }

    return {
        isFollowed: willFollow,
        message: willFollow ? `Kina bin ${storeName}` : `Ka daina bin ${storeName}`,
        updatedMap
    };
};

/**
 * Fetch full profile details of stores followed by the buyer
 */
export const getFollowedStoresList = async (userId = null) => {
    try {
        const followMap = await getFollowedStoreMap(userId);
        const followedIds = Object.keys(followMap).filter(id => !!followMap[id]);

        if (followedIds.length === 0) return [];

        const stores = [];

        // 1. Check for official flagship store
        if (followedIds.includes('official-abumafhal')) {
            stores.push({
                id: 'official-abumafhal',
                name: 'Abu Mafhal Official Store',
                category: 'Official Mall & Flagship Store',
                rating: 5.0,
                reviews: '3.8K',
                productsCount: 120,
                logo: null,
                banner: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=900&auto=format&fit=crop',
                isVerified: true,
                isOfficial: true,
                phone: '2349021486162',
                address: 'Main Commercial Plaza, Gashua, Yobe State, Nigeria',
                bio: 'The official verified flagship mall of Abu Mafhal Marketplace. Genuine brand warranty, authentic products, and 100% buyer protection across Nigeria.'
            });
        }

        // 2. Fetch vendor profiles from database
        const vendorUids = followedIds.filter(id => id !== 'official-abumafhal');
        if (vendorUids.length > 0) {
            const [profilesRes, productsRes] = await Promise.allSettled([
                supabase
                    .from('profiles')
                    .select('id, full_name, username, business_name, avatar_url, role, phone, created_at')
                    .in('id', vendorUids),
                supabase
                    .from('products')
                    .select('id, vendor_id')
                    .in('vendor_id', vendorUids)
                    .eq('status', 'approved')
            ]);

            const profileList = (profilesRes.status === 'fulfilled' && profilesRes.value?.data) ? profilesRes.value.data : [];
            const prodList = (productsRes.status === 'fulfilled' && productsRes.value?.data) ? productsRes.value.data : [];

            profileList.forEach(p => {
                const pCount = prodList.filter(item => item.vendor_id === p.id).length;
                stores.push({
                    id: p.id,
                    name: p.business_name || p.full_name || p.username || 'Verified Merchant',
                    category: p.role === 'vendor' ? 'Verified Seller' : 'Registered Merchant',
                    rating: 4.9,
                    reviews: '120+',
                    productsCount: pCount,
                    logo: p.avatar_url || null,
                    banner: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=900&auto=format&fit=crop',
                    isVerified: true,
                    isOfficial: false,
                    phone: p.phone || '2349021486162',
                    address: 'Verified Merchant Center, Nigeria',
                    bio: `Authentic merchant verified on Abu Mafhal Marketplace. Providing top quality goods with trusted direct delivery.`
                });
            });
        }

        return stores;
    } catch (e) {
        console.log('getFollowedStoresList error:', e);
        return [];
    }
};

/**
 * Fetch all followers of a specific vendor store
 */
export const getVendorFollowersList = async (vendorId) => {
    if (!vendorId) return { followers: [], totalCount: 0 };

    try {
        const { data, error } = await supabase
            .from('vendor_followers')
            .select(`
                id,
                created_at,
                user_id,
                profiles:user_id (
                    id,
                    full_name,
                    username,
                    avatar_url,
                    role,
                    phone,
                    created_at
                )
            `)
            .eq('vendor_id', String(vendorId))
            .order('created_at', { ascending: false });

        if (error) {
            console.log('getVendorFollowersList error:', error);
            return { followers: [], totalCount: 0 };
        }

        const formatted = (data || []).map(row => {
            const prof = row.profiles || {};
            return {
                id: row.id,
                userId: row.user_id,
                fullName: prof.full_name || prof.username || 'Loyal Customer',
                username: prof.username || 'customer',
                avatarUrl: prof.avatar_url || null,
                phone: prof.phone || null,
                role: prof.role || 'buyer',
                followedAt: row.created_at,
                isVip: (prof.role === 'vendor' || (prof.created_at && new Date(prof.created_at).getFullYear() <= 2024))
            };
        });

        return {
            followers: formatted,
            totalCount: formatted.length
        };
    } catch (e) {
        console.log('getVendorFollowersList exception:', e);
        return { followers: [], totalCount: 0 };
    }
};

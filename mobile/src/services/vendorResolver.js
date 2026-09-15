import { supabase } from '../lib/supabase';

// In-memory cache to avoid duplicate network fetches during user navigation
const vendorCache = new Map();
let officialStoreCache = null;
let lastOfficialFetch = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Fetch and cache the official Abu Mafhal flagship store
 */
export const getOfficialStoreProfile = async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && officialStoreCache && (now - lastOfficialFetch < CACHE_TTL)) {
        return officialStoreCache;
    }

    try {
        // Query stores table for official store or primary admin
        const [storesRes, adminProfileRes] = await Promise.allSettled([
            supabase
                .from('stores')
                .select('*')
                .or('is_official.eq.true,name.ilike.%Abu Mafhal%')
                .limit(1)
                .maybeSingle(),
            supabase
                .from('profiles')
                .select('*')
                .eq('role', 'admin')
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle()
        ]);

        const store = storesRes.status === 'fulfilled' ? storesRes.value?.data : null;
        const adminProf = adminProfileRes.status === 'fulfilled' ? adminProfileRes.value?.data : null;

        const resolvedId = store?.user_id || adminProf?.id || store?.id || 'official';
        const cleanName = (store?.name || adminProf?.business_name || 'ABU MAFHAL').trim();
        const logo = store?.logo || adminProf?.avatar_url || null;
        const phone = store?.phone || adminProf?.phone || adminProf?.phone_number || '08145853539';
        const whatsapp = store?.whatsapp || store?.phone || phone;

        officialStoreCache = {
            id: resolvedId,
            userId: adminProf?.id || store?.user_id || resolvedId,
            name: cleanName,
            business_name: cleanName,
            role: 'admin',
            isOfficial: true,
            is_official: true,
            is_verified: true,
            rating: store?.rating ? Number(store.rating) : 5.0,
            reviews: '1.2k+',
            phone: phone,
            whatsapp: whatsapp,
            avatar: logo,
            logo: logo,
            tagline: store?.tagline || 'Official Flagship Mall • 100% Genuine Guaranteed',
            about: store?.about || 'The official verified flagship store of Abu Mafhal Marketplace.',
            address: store?.address || adminProf?.address || 'Main Commercial Center, Gashua, Yobe State, Nigeria'
        };

        lastOfficialFetch = now;
        return officialStoreCache;
    } catch (err) {
        console.log('[vendorResolver] getOfficialStoreProfile error:', err);
        return {
            id: 'official',
            userId: 'official',
            name: 'ABU MAFHAL',
            business_name: 'ABU MAFHAL',
            role: 'admin',
            isOfficial: true,
            is_official: true,
            is_verified: true,
            rating: 5.0,
            reviews: '1.2k+',
            phone: '08145853539',
            whatsapp: '08145853539',
            avatar: null,
            logo: null,
            tagline: 'Official Flagship Mall • 100% Genuine Guaranteed',
            about: 'The official verified flagship store of Abu Mafhal Marketplace.',
            address: 'Main Commercial Center, Gashua, Yobe State, Nigeria'
        };
    }
};

/**
 * Unified resolver for any vendor / store identity across the marketplace
 * Guarantees 100% consistency across StoresPage, ProductDetails, ChatScreen, and ConversationsScreen.
 *
 * @param {string|null} targetId - Profile UUID, Store UUID, or 'admin'/'official'
 * @param {boolean} forceRefresh - If true, bypass in-memory cache
 * @returns {Promise<Object>} Clean, consistent vendor profile object
 */
export const resolveVendorOrStore = async (targetId, forceRefresh = false) => {
    // 1. If target is empty, null, 'admin', or 'official' -> Return official flagship store
    if (!targetId || targetId === 'admin' || targetId === 'official' || targetId === 'admin_support' || targetId === 'official-abumafhal') {
        return getOfficialStoreProfile(forceRefresh);
    }

    const cleanId = String(targetId).trim();

    // Check cache
    if (!forceRefresh && vendorCache.has(cleanId)) {
        return vendorCache.get(cleanId);
    }

    try {
        // Query both profiles and stores
        const [profileRes, storeRes, storeByIdRes] = await Promise.allSettled([
            supabase.from('profiles').select('*').eq('id', cleanId).maybeSingle(),
            supabase.from('stores').select('*').eq('user_id', cleanId).maybeSingle(),
            supabase.from('stores').select('*').eq('id', cleanId).maybeSingle()
        ]);

        const profile = profileRes.status === 'fulfilled' ? profileRes.value?.data : null;
        const store = (storeRes.status === 'fulfilled' && storeRes.value?.data)
            ? storeRes.value.data
            : (storeByIdRes.status === 'fulfilled' ? storeByIdRes.value?.data : null);

        // If this profile happens to be admin, return the official store branding
        if (profile?.role === 'admin') {
            const off = await getOfficialStoreProfile(forceRefresh);
            // Ensure ID is the real admin UUID
            const resolvedAdmin = { ...off, id: cleanId, userId: cleanId };
            vendorCache.set(cleanId, resolvedAdmin);
            return resolvedAdmin;
        }

        // If neither profile nor store was found, fallback to official
        if (!profile && !store) {
            return getOfficialStoreProfile(forceRefresh);
        }

        // Parse custom JSON metadata from profile address if present
        let addrMeta = null;
        if (profile?.address && typeof profile.address === 'string' && profile.address.startsWith('{')) {
            try { addrMeta = JSON.parse(profile.address); } catch (_) {}
        }

        const resolvedName = (
            store?.name ||
            profile?.business_name ||
            addrMeta?.business_name ||
            profile?.full_name ||
            profile?.username ||
            'Marketplace Seller'
        ).trim();

        const resolvedLogo = (
            store?.logo ||
            profile?.avatar_url ||
            addrMeta?.logo ||
            null
        );

        const resolvedPhone = (
            store?.phone ||
            addrMeta?.phone ||
            profile?.phone ||
            profile?.phone_number ||
            ''
        ).trim();

        const resolvedWhatsapp = (
            store?.whatsapp ||
            addrMeta?.whatsapp ||
            resolvedPhone ||
            ''
        ).trim();

        const resolvedTagline = (
            store?.tagline ||
            addrMeta?.tagline ||
            store?.about ||
            'Verified Marketplace Merchant'
        ).trim();

        const resolved = {
            id: cleanId,
            userId: profile?.id || store?.user_id || cleanId,
            name: resolvedName,
            business_name: resolvedName,
            role: profile?.role || (store?.is_official ? 'admin' : 'vendor'),
            isOfficial: !!store?.is_official || profile?.role === 'admin',
            is_official: !!store?.is_official || profile?.role === 'admin',
            is_verified: true,
            rating: store?.rating ? Number(store.rating) : 4.9,
            reviews: '24+',
            phone: resolvedPhone,
            whatsapp: resolvedWhatsapp,
            avatar: resolvedLogo,
            logo: resolvedLogo,
            tagline: resolvedTagline,
            about: store?.about || addrMeta?.about || profile?.about || `Welcome to ${resolvedName}.`,
            address: store?.address || addrMeta?.address || profile?.address || 'Nigeria'
        };

        vendorCache.set(cleanId, resolved);
        return resolved;
    } catch (err) {
        console.log('[vendorResolver] resolveVendorOrStore error:', err);
        return getOfficialStoreProfile(false);
    }
};

/**
 * Invalidate cache if store details are updated
 */
export const clearVendorCache = (targetId = null) => {
    if (targetId) {
        vendorCache.delete(String(targetId).trim());
    } else {
        vendorCache.clear();
        officialStoreCache = null;
    }
};

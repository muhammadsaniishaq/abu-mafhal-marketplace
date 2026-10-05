import { supabase } from '../lib/supabase';

const SETTINGS_KEY = 'platform_live_reviews';

/**
 * Helper to fetch fallback reviews stored in app_settings
 */
const getFallbackReviews = async () => {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', SETTINGS_KEY)
            .maybeSingle();

        if (error || !data || !data.value) return [];
        return Array.isArray(data.value) ? data.value : [];
    } catch (err) {
        console.warn('ReviewsService: Failed to fetch fallback reviews', err);
        return [];
    }
};

/**
 * Helper to save fallback reviews into app_settings
 */
const saveFallbackReviews = async (reviewsList) => {
    try {
        await supabase.rpc('save_app_setting', {
            p_key: SETTINGS_KEY,
            p_value: reviewsList
        });
    } catch (err) {
        console.warn('ReviewsService: Failed to persist fallback reviews', err);
    }
};

export const reviewsService = {
    /**
     * Fetch approved reviews for a specific product
     */
    fetchProductReviews: async (productId) => {
        if (!productId) return { reviews: [], totalCount: 0, averageRating: 0 };

        try {
            // 1. Try real Supabase reviews table
            const { data, error } = await supabase
                .from('reviews')
                .select('*')
                .eq('product_id', productId)
                .eq('status', 'approved')
                .order('created_at', { ascending: false });

            if (!error && Array.isArray(data)) {
                const totalCount = data.length;
                const sum = data.reduce((acc, curr) => acc + (Number(curr.rating) || 5), 0);
                const averageRating = totalCount > 0 ? (sum / totalCount).toFixed(1) : 0;
                return { reviews: data, totalCount, averageRating };
            }
        } catch (_) {}

        // 2. Fallback to app_settings persistence
        const fallback = await getFallbackReviews();
        const filtered = fallback.filter(
            r => String(r.product_id) === String(productId) && (r.status === 'approved' || !r.status)
        );
        const totalCount = filtered.length;
        const sum = filtered.reduce((acc, curr) => acc + (Number(curr.rating) || 5), 0);
        const averageRating = totalCount > 0 ? (sum / totalCount).toFixed(1) : 0;

        return { reviews: filtered, totalCount, averageRating };
    },

    /**
     * Fetch approved reviews for a specific driver
     */
    fetchDriverReviews: async (driverId) => {
        if (!driverId) return { reviews: [], totalCount: 0, averageRating: 0 };

        try {
            const { data, error } = await supabase
                .from('reviews')
                .select('*')
                .eq('driver_id', driverId)
                .eq('status', 'approved')
                .order('created_at', { ascending: false });

            if (!error && Array.isArray(data)) {
                const totalCount = data.length;
                const sum = data.reduce((acc, curr) => acc + (Number(curr.rating) || 5), 0);
                const averageRating = totalCount > 0 ? (sum / totalCount).toFixed(1) : 0;
                return { reviews: data, totalCount, averageRating };
            }
        } catch (_) {}

        const fallback = await getFallbackReviews();
        const filtered = fallback.filter(
            r => String(r.driver_id) === String(driverId) && (r.status === 'approved' || !r.status)
        );
        const totalCount = filtered.length;
        const sum = filtered.reduce((acc, curr) => acc + (Number(curr.rating) || 5), 0);
        const averageRating = totalCount > 0 ? (sum / totalCount).toFixed(1) : 0;

        return { reviews: filtered, totalCount, averageRating };
    },

    /**
     * Submit a review (Product or Driver)
     */
    submitReview: async (reviewPayload) => {
        const id = 'rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        const newReview = {
            id,
            user_id: reviewPayload.user_id || null,
            user_name: reviewPayload.user_name || 'Verified Customer',
            product_id: reviewPayload.product_id || null,
            driver_id: reviewPayload.driver_id || null,
            order_id: reviewPayload.order_id || null,
            review_type: reviewPayload.review_type || 'product',
            rating: Number(reviewPayload.rating) || 5,
            title: reviewPayload.title || '',
            comment: reviewPayload.comment || '',
            images: Array.isArray(reviewPayload.images) ? reviewPayload.images : [],
            status: reviewPayload.status || 'approved',
            helpful: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // 1. Try insert to Supabase 'reviews' table
        let dbSuccess = false;
        try {
            const { error } = await supabase.from('reviews').insert(newReview);
            if (!error) {
                dbSuccess = true;
            }
        } catch (err) {
            console.warn('ReviewsService: Direct DB insert failed, using fallback', err);
        }

        // 2. Always sync to fallback store in app_settings for 100% live reliability
        try {
            const existing = await getFallbackReviews();
            const updated = [newReview, ...existing.filter(r => r.id !== newReview.id)];
            await saveFallbackReviews(updated);
        } catch (err) {
            console.warn('ReviewsService: Fallback save error', err);
        }

        return { success: true, data: newReview };
    },

    /**
     * Fetch all reviews for Admin moderation
     */
    fetchAdminReviews: async ({ statusFilter = 'all', typeFilter = 'all' } = {}) => {
        let list = [];

        try {
            // 1. Attempt query from real Supabase reviews table with relations
            let query = supabase
                .from('reviews')
                .select(`
                    *,
                    profiles(full_name, email, username),
                    drivers(name),
                    products(name)
                `)
                .order('created_at', { ascending: false })
                .limit(200);

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }
            if (typeFilter !== 'all') {
                query = query.eq('review_type', typeFilter);
            }

            const { data, error } = await query;
            if (!error && Array.isArray(data) && data.length > 0) {
                return data;
            }
        } catch (_) {}

        // 2. Fallback to app_settings
        const fallback = await getFallbackReviews();
        list = fallback;

        // Fetch product names and driver names to enrich fallback records
        try {
            const productIds = [...new Set(list.filter(r => r.product_id).map(r => r.product_id))];
            const driverIds = [...new Set(list.filter(r => r.driver_id).map(r => r.driver_id))];

            let prodMap = {};
            let driverMap = {};

            if (productIds.length > 0) {
                const { data: prods } = await supabase.from('products').select('id, name').in('id', productIds);
                if (prods) prods.forEach(p => { prodMap[p.id] = p.name; });
            }

            if (driverIds.length > 0) {
                const { data: drivers } = await supabase.from('drivers').select('id, name').in('id', driverIds);
                if (drivers) drivers.forEach(d => { driverMap[d.id] = d.name; });
            }

            list = list.map(r => ({
                ...r,
                products: r.product_id && prodMap[r.product_id] ? { name: prodMap[r.product_id] } : null,
                drivers: r.driver_id && driverMap[r.driver_id] ? { name: driverMap[r.driver_id] } : null,
                profiles: { full_name: r.user_name || 'Customer' }
            }));
        } catch (_) {}

        // Apply in-memory filters
        if (statusFilter !== 'all') {
            list = list.filter(r => (r.status || 'approved') === statusFilter);
        }
        if (typeFilter !== 'all') {
            list = list.filter(r => (r.review_type || 'product') === typeFilter);
        }

        return list;
    },

    /**
     * Update review status (approve/reject)
     */
    updateReviewStatus: async (reviewId, newStatus) => {
        try {
            await supabase.from('reviews').update({ status: newStatus }).eq('id', reviewId);
        } catch (_) {}

        try {
            const existing = await getFallbackReviews();
            const updated = existing.map(r => r.id === reviewId ? { ...r, status: newStatus } : r);
            await saveFallbackReviews(updated);
        } catch (_) {}

        return true;
    },

    /**
     * Delete a review permanently
     */
    deleteReview: async (reviewId) => {
        try {
            await supabase.from('reviews').delete().eq('id', reviewId);
        } catch (_) {}

        try {
            const existing = await getFallbackReviews();
            const updated = existing.filter(r => r.id !== reviewId);
            await saveFallbackReviews(updated);
        } catch (_) {}

        return true;
    }
};

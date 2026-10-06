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

/**
 * Helper to enrich reviews with live profile avatars & full names
 */
const enrichReviewsWithProfiles = async (reviews) => {
    if (!Array.isArray(reviews) || reviews.length === 0) return reviews || [];
    try {
        const userIds = [...new Set(reviews.filter(r => r.user_id).map(r => r.user_id))];
        if (userIds.length === 0) return reviews;

        const { data: profs, error } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, username')
            .in('id', userIds);

        if (error || !profs) return reviews;

        const map = {};
        profs.forEach(p => { map[p.id] = p; });

        return reviews.map(r => {
            const profile = r.user_id ? map[r.user_id] : null;
            return {
                ...r,
                user_name: profile?.full_name || profile?.username || r.user_name || 'Verified Customer',
                user_avatar: profile?.avatar_url || r.user_avatar || null
            };
        });
    } catch (_) {
        return reviews;
    }
};

/**
 * Helper to compute average and rating distribution
 */
const calculateReviewStats = (reviewsList) => {
    const totalCount = reviewsList.length;
    if (totalCount === 0) {
        return {
            totalCount: 0,
            averageRating: 0,
            distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
            percentages: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
        };
    }

    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;

    reviewsList.forEach(r => {
        const val = Number(r.rating) || 5;
        sum += val;
        const star = Math.min(5, Math.max(1, Math.round(val)));
        dist[star] = (dist[star] || 0) + 1;
    });

    const averageRating = (sum / totalCount).toFixed(1);
    const percentages = {
        5: Math.round((dist[5] / totalCount) * 100),
        4: Math.round((dist[4] / totalCount) * 100),
        3: Math.round((dist[3] / totalCount) * 100),
        2: Math.round((dist[2] / totalCount) * 100),
        1: Math.round((dist[1] / totalCount) * 100)
    };

    return {
        totalCount,
        averageRating,
        distribution: dist,
        percentages
    };
};

export const reviewsService = {
    /**
     * Fetch approved reviews for a specific product with full breakdown stats and live user avatars
     */
    fetchProductReviews: async (productId) => {
        if (!productId) {
            return {
                reviews: [],
                totalCount: 0,
                averageRating: 0,
                distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
                percentages: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
            };
        }

        try {
            // 1. Try real Supabase reviews table
            const { data, error } = await supabase
                .from('reviews')
                .select('*')
                .eq('product_id', productId)
                .eq('status', 'approved')
                .order('created_at', { ascending: false });

            if (!error && Array.isArray(data)) {
                const enriched = await enrichReviewsWithProfiles(data);
                const stats = calculateReviewStats(enriched);
                return { reviews: enriched, ...stats };
            }
        } catch (_) {}

        // 2. Fallback to app_settings persistence
        const fallback = await getFallbackReviews();
        const filtered = fallback.filter(
            r => String(r.product_id) === String(productId) && (r.status === 'approved' || !r.status)
        );
        const enrichedFallback = await enrichReviewsWithProfiles(filtered);
        const stats = calculateReviewStats(enrichedFallback);
        return { reviews: enrichedFallback, ...stats };
    },

    /**
     * Fetch approved reviews for a specific driver
     */
    fetchDriverReviews: async (driverId) => {
        if (!driverId) {
            return {
                reviews: [],
                totalCount: 0,
                averageRating: 0,
                distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
                percentages: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
            };
        }

        try {
            const { data, error } = await supabase
                .from('reviews')
                .select('*')
                .eq('driver_id', driverId)
                .eq('status', 'approved')
                .order('created_at', { ascending: false });

            if (!error && Array.isArray(data)) {
                const enriched = await enrichReviewsWithProfiles(data);
                const stats = calculateReviewStats(enriched);
                return { reviews: enriched, ...stats };
            }
        } catch (_) {}

        const fallback = await getFallbackReviews();
        const filtered = fallback.filter(
            r => String(r.driver_id) === String(driverId) && (r.status === 'approved' || !r.status)
        );
        const enrichedFallback = await enrichReviewsWithProfiles(filtered);
        const stats = calculateReviewStats(enrichedFallback);
        return { reviews: enrichedFallback, ...stats };
    },

    /**
     * Submit a review (Product or Driver) with automatic profile linking & avatar
     */
    submitReview: async (reviewPayload) => {
        const isUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        const dbPayload = {
            product_id: isUUID(reviewPayload.product_id) ? reviewPayload.product_id : null,
            driver_id: isUUID(reviewPayload.driver_id) ? reviewPayload.driver_id : null,
            order_id: isUUID(reviewPayload.order_id) ? reviewPayload.order_id : null,
            user_id: isUUID(reviewPayload.user_id) ? reviewPayload.user_id : null,
            user_name: reviewPayload.user_name || 'Verified Customer',
            review_type: reviewPayload.review_type || 'product',
            rating: Number(reviewPayload.rating) || 5,
            title: reviewPayload.title || '',
            comment: reviewPayload.comment || '',
            images: Array.isArray(reviewPayload.images) ? reviewPayload.images : [],
            status: reviewPayload.status || 'approved',
            helpful: 0
        };

        let savedRecord = null;

        // 1. Try inserting to Supabase 'reviews' table
        try {
            // First try with user_avatar if provided
            let insertObj = { ...dbPayload };
            if (reviewPayload.user_avatar) {
                insertObj.user_avatar = reviewPayload.user_avatar;
            }

            let { data, error } = await supabase.from('reviews').insert(insertObj).select();

            // If user_avatar column doesn't exist yet on SQL table (PGRST204), retry without it
            if (error && error.code === 'PGRST204') {
                delete insertObj.user_avatar;
                const retry = await supabase.from('reviews').insert(insertObj).select();
                data = retry.data;
                error = retry.error;
            }

            if (!error && data && data.length > 0) {
                savedRecord = {
                    ...data[0],
                    user_avatar: reviewPayload.user_avatar || data[0].user_avatar || null
                };
            }
        } catch (err) {
            console.warn('ReviewsService: Direct DB insert exception:', err);
        }

        // 2. Fallback memory record
        if (!savedRecord) {
            savedRecord = {
                ...dbPayload,
                id: 'rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                product_id: reviewPayload.product_id || null,
                driver_id: reviewPayload.driver_id || null,
                user_avatar: reviewPayload.user_avatar || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        }

        // 3. Mirror to app_settings as fallback persistence
        try {
            const existing = await getFallbackReviews();
            const updated = [savedRecord, ...existing.filter(r => r.id !== savedRecord.id)];
            await saveFallbackReviews(updated);
        } catch (_) {}

        // 4. Live Synchronization of Product & Driver Rating Counters
        if (dbPayload.product_id) {
            reviewsService.syncProductRating(dbPayload.product_id).catch(() => {});
        }
        if (dbPayload.driver_id) {
            reviewsService.syncDriverRating(dbPayload.driver_id).catch(() => {});
        }

        return { success: true, data: savedRecord };
    },

    /**
     * Re-calculate and sync approved review average rating and count to the 'products' table
     */
    syncProductRating: async (productId) => {
        if (!productId) return;
        try {
            const { data: revs } = await supabase
                .from('reviews')
                .select('rating')
                .eq('product_id', productId)
                .eq('status', 'approved');

            let count = 0;
            let avg = 5.0;

            if (revs && revs.length > 0) {
                count = revs.length;
                const sum = revs.reduce((a, b) => a + (Number(b.rating) || 5), 0);
                avg = Number((sum / count).toFixed(1));
            } else {
                const fallbackList = await getFallbackReviews();
                const matched = fallbackList.filter(r => String(r.product_id) === String(productId) && (r.status || 'approved') === 'approved');
                if (matched.length > 0) {
                    count = matched.length;
                    const sum = matched.reduce((a, b) => a + (Number(b.rating) || 5), 0);
                    avg = Number((sum / count).toFixed(1));
                }
            }

            // Sync to products table with fallbacks
            try {
                await supabase
                    .from('products')
                    .update({
                        rating: avg,
                        average_rating: avg,
                        reviews: count,
                        reviews_count: count
                    })
                    .eq('id', productId);
            } catch (_) {
                try {
                    await supabase
                        .from('products')
                        .update({
                            rating: avg,
                            reviews: count
                        })
                        .eq('id', productId);
                } catch (_) {}
            }
        } catch (e) {
            console.warn('ReviewsService: failed to sync product rating:', e);
        }
    },

    /**
     * Re-calculate and sync approved driver rating to the 'drivers' table
     */
    syncDriverRating: async (driverId) => {
        if (!driverId) return;
        try {
            const { data: revs } = await supabase
                .from('reviews')
                .select('rating')
                .eq('driver_id', driverId)
                .eq('status', 'approved');

            let count = 0;
            let avg = 5.0;

            if (revs && revs.length > 0) {
                count = revs.length;
                const sum = revs.reduce((a, b) => a + (Number(b.rating) || 5), 0);
                avg = Number((sum / count).toFixed(1));
            }

            await supabase
                .from('drivers')
                .update({
                    rating: avg,
                    review_count: count
                })
                .eq('id', driverId);
        } catch (_) {}
    },

    /**
     * Fetch all reviews for Admin moderation
     */
    fetchAdminReviews: async ({ statusFilter = 'all', typeFilter = 'all' } = {}) => {
        let list = [];

        try {
            let query = supabase
                .from('reviews')
                .select(`
                    *,
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
            if (!error && Array.isArray(data)) {
                list = await enrichReviewsWithProfiles(data);
                return list;
            }
        } catch (_) {}

        // Fallback
        const fallback = await getFallbackReviews();
        list = fallback;

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
                drivers: r.driver_id && driverMap[r.driver_id] ? { name: driverMap[r.driver_id] } : null
            }));

            list = await enrichReviewsWithProfiles(list);
        } catch (_) {}

        if (statusFilter !== 'all') {
            list = list.filter(r => (r.status || 'approved') === statusFilter);
        }
        if (typeFilter !== 'all') {
            list = list.filter(r => (r.review_type || 'product') === typeFilter);
        }

        return list;
    },

    /**
     * Update review status
     */
    updateReviewStatus: async (reviewId, newStatus) => {
        let revItem = null;
        try {
            const { data } = await supabase.from('reviews').select('product_id, driver_id').eq('id', reviewId).maybeSingle();
            revItem = data;
            await supabase.from('reviews').update({ status: newStatus }).eq('id', reviewId);
        } catch (_) {}

        try {
            const existing = await getFallbackReviews();
            if (!revItem) revItem = existing.find(r => r.id === reviewId);
            const updated = existing.map(r => r.id === reviewId ? { ...r, status: newStatus } : r);
            await saveFallbackReviews(updated);
        } catch (_) {}

        if (revItem?.product_id) reviewsService.syncProductRating(revItem.product_id).catch(() => {});
        if (revItem?.driver_id) reviewsService.syncDriverRating(revItem.driver_id).catch(() => {});

        return true;
    },

    /**
     * Delete a review permanently
     */
    deleteReview: async (reviewId) => {
        let revItem = null;
        try {
            const { data } = await supabase.from('reviews').select('product_id, driver_id').eq('id', reviewId).maybeSingle();
            revItem = data;
            await supabase.from('reviews').delete().eq('id', reviewId);
        } catch (_) {}

        try {
            const existing = await getFallbackReviews();
            if (!revItem) revItem = existing.find(r => r.id === reviewId);
            const updated = existing.filter(r => r.id !== reviewId);
            await saveFallbackReviews(updated);
        } catch (_) {}

        if (revItem?.product_id) reviewsService.syncProductRating(revItem.product_id).catch(() => {});
        if (revItem?.driver_id) reviewsService.syncDriverRating(revItem.driver_id).catch(() => {});

        return true;
    },

    /**
     * Mark review helpful
     */
    markHelpful: async (reviewId) => {
        try {
            const { data } = await supabase.from('reviews').select('helpful').eq('id', reviewId).maybeSingle();
            if (data) {
                await supabase.from('reviews').update({ helpful: (data.helpful || 0) + 1 }).eq('id', reviewId);
            }
        } catch (_) {}

        try {
            const existing = await getFallbackReviews();
            const updated = existing.map(r => r.id === reviewId ? { ...r, helpful: (r.helpful || 0) + 1 } : r);
            await saveFallbackReviews(updated);
        } catch (_) {}

        return true;
    }
};

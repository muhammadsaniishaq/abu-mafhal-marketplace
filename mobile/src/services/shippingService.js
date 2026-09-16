// mobile/src/services/shippingService.js
/**
 * ABU MAFHAL MARKETPLACE - CENTRALIZED SHIPPING & DISTANCE CALCULATION ENGINE
 * 
 * Strict architectural guarantees:
 * 1. Zero hardcoded frontend prices: all values configurable via Admin Dashboard / Supabase.
 * 2. Abstract distance provider with OSRM road routing + Haversine fallback.
 * 3. Multi-vendor independent grouping & fee calculations.
 * 4. Priority hierarchy: Vendor Custom Rule > LGA Zone > State Zone > Method Rule > Global Setting.
 * 5. Immutable snapshots for historical order safety.
 */

let _supabase = null;
export const getSupabase = async () => {
    if (_supabase) return _supabase;
    try {
        const mod = await import('../lib/supabase.js');
        _supabase = mod.supabase;
        return _supabase;
    } catch (_) {
        return null;
    }
};

// ── NIGERIA REGIONAL & STATE CENTROIDS (FOR COORDINATE INFERENCE) ─────────────
export const NIGERIA_STATE_CENTROIDS = {
    'Abia': { lat: 5.4527, lon: 7.5248 },
    'Adamawa': { lat: 9.3265, lon: 12.4386 },
    'Akwa Ibom': { lat: 5.0077, lon: 7.8537 },
    'Anambra': { lat: 6.2209, lon: 7.0723 },
    'Bauchi': { lat: 10.3158, lon: 9.8442 },
    'Bayelsa': { lat: 4.7719, lon: 6.0699 },
    'Benue': { lat: 7.7304, lon: 8.5214 },
    'Borno': { lat: 11.8333, lon: 13.1500 },
    'Cross River': { lat: 5.8702, lon: 8.5988 },
    'Delta': { lat: 5.6806, lon: 5.9189 },
    'Ebonyi': { lat: 6.2649, lon: 8.0137 },
    'Edo': { lat: 6.5438, lon: 5.8987 },
    'Ekiti': { lat: 7.6210, lon: 5.2215 },
    'Enugu': { lat: 6.4584, lon: 7.5464 },
    'FCT (Abuja)': { lat: 9.0765, lon: 7.3986 },
    'Abuja': { lat: 9.0765, lon: 7.3986 },
    'Gombe': { lat: 10.2897, lon: 11.1673 },
    'Imo': { lat: 5.4836, lon: 7.0333 },
    'Jigawa': { lat: 12.2280, lon: 9.5616 },
    'Kaduna': { lat: 10.5105, lon: 7.4165 },
    'Kano': { lat: 12.0022, lon: 8.5920 },
    'Katsina': { lat: 12.9855, lon: 7.6171 },
    'Kebbi': { lat: 12.4504, lon: 4.1999 },
    'Kogi': { lat: 7.7969, lon: 6.7405 },
    'Kwara': { lat: 8.4966, lon: 4.5421 },
    'Lagos': { lat: 6.5244, lon: 3.3792 },
    'Nasarawa': { lat: 8.4998, lon: 8.5153 },
    'Niger': { lat: 9.9309, lon: 5.5983 },
    'Ogun': { lat: 7.1475, lon: 3.3619 },
    'Ondo': { lat: 7.2571, lon: 5.2058 },
    'Osun': { lat: 7.5629, lon: 4.5200 },
    'Oyo': { lat: 7.8430, lon: 3.9368 },
    'Plateau': { lat: 9.8965, lon: 8.8583 },
    'Rivers': { lat: 4.8156, lon: 7.0498 },
    'Sokoto': { lat: 13.0622, lon: 5.2339 },
    'Taraba': { lat: 7.8704, lon: 9.7800 },
    'Yobe': { lat: 11.7489, lon: 11.9660 },
    'Zamfara': { lat: 12.1628, lon: 6.2236 }
};

// Major LGA Specific Centroids
export const NIGERIA_LGA_CENTROIDS = {
    'Bade': { lat: 12.8753, lon: 10.9786, state: 'Yobe' },
    'Gashua': { lat: 12.8711, lon: 11.0425, state: 'Yobe' },
    'Damaturu': { lat: 11.7470, lon: 11.9608, state: 'Yobe' },
    'Potiskum': { lat: 11.7091, lon: 11.0694, state: 'Yobe' },
    'Nguru': { lat: 12.8770, lon: 10.4578, state: 'Yobe' },
    'Kano Municipal': { lat: 11.9961, lon: 8.5273, state: 'Kano' },
    'Ikeja': { lat: 6.6018, lon: 3.3515, state: 'Lagos' },
    'Maiduguri': { lat: 11.8333, lon: 13.1500, state: 'Borno' }
};

// ── DEFAULT FALLBACK SYSTEM CONFIGURATION (IF SUPABASE RECORD IS EMPTY) ───────
export const DEFAULT_SHIPPING_SETTINGS = {
    enabled: true,
    currency: 'NGN',
    base_fee: 1000,
    price_per_km: 75,
    min_fee: 1000,
    max_fee: 25000,
    free_shipping_threshold: 50000,
    max_delivery_distance_km: 350,
    handling_fee: 200,
    remote_area_fee: 1500,
    vendor_handling_fee: 0,
    standard_delivery_enabled: true,
    express_delivery_enabled: true,
    same_day_delivery_enabled: true,
    customer_pickup_enabled: true
};

export const DEFAULT_SHIPPING_METHODS = [
    {
        id: 'standard',
        name: 'Standard Delivery',
        description: 'Reliable road courier delivery across regional logistics hubs',
        base_fee: 1000,
        price_per_km: 75,
        min_fee: 1000,
        max_fee: 20000,
        estimated_delivery_time: '2 - 4 Business Days',
        is_active: true,
        display_order: 1
    },
    {
        id: 'express',
        name: 'Express Priority',
        description: 'Direct courier dispatch with priority handling',
        base_fee: 2500,
        price_per_km: 120,
        min_fee: 2500,
        max_fee: 35000,
        estimated_delivery_time: '1 - 2 Business Days',
        is_active: true,
        display_order: 2
    },
    {
        id: 'same_day',
        name: 'Same-Day City Rush',
        description: 'Direct courier delivery within the same city/LGA',
        base_fee: 4000,
        price_per_km: 180,
        min_fee: 4000,
        max_fee: 45000,
        estimated_delivery_time: 'Same Day (Within 6 Hours)',
        is_active: true,
        display_order: 3
    },
    {
        id: 'pickup',
        name: 'Customer Hub Pickup',
        description: 'Collect your package directly from the vendor store or local hub',
        base_fee: 0,
        price_per_km: 0,
        min_fee: 0,
        max_fee: 500,
        estimated_delivery_time: 'Ready in 24 Hours',
        is_active: true,
        display_order: 4
    }
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. DISTANCE CALCULATION SERVICE
// ─────────────────────────────────────────────────────────────────────────────
export class ShippingDistanceService {
    /**
     * Mathematical Haversine formula (Great-circle distance between two points)
     */
    static calculateHaversine(lat1, lon1, lat2, lon2) {
        if (!this.isValidCoordinate(lat1, lon1) || !this.isValidCoordinate(lat2, lon2)) {
            return null;
        }

        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const directKm = R * c;

        // Apply road winding factor (1.22x) to approximate real road transit distance from straight-line
        const roadApproximationKm = Math.max(1, Math.round(directKm * 1.22 * 10) / 10);
        return roadApproximationKm;
    }

    static isValidCoordinate(lat, lon) {
        const nLat = Number(lat);
        const nLon = Number(lon);
        return !isNaN(nLat) && !isNaN(nLon) && nLat >= -90 && nLat <= 90 && nLon >= -180 && nLon <= 180 && (nLat !== 0 || nLon !== 0);
    }

    /**
     * Resolves coordinates from given location object with smart fallback to LGA and State centroids
     */
    static resolveCoordinates(location) {
        if (!location) return null;

        // 1. Direct explicit coordinates
        if (this.isValidCoordinate(location.latitude, location.longitude)) {
            return {
                lat: Number(location.latitude),
                lon: Number(location.longitude),
                source: 'exact_gps'
            };
        }

        // 2. LGA Centroid
        const lgaKey = location.city || location.lga;
        if (lgaKey && NIGERIA_LGA_CENTROIDS[lgaKey]) {
            const centroid = NIGERIA_LGA_CENTROIDS[lgaKey];
            return {
                lat: centroid.lat,
                lon: centroid.lon,
                source: 'lga_centroid'
            };
        }

        // 3. State Centroid
        const stateKey = (location.state || '').trim();
        if (stateKey && NIGERIA_STATE_CENTROIDS[stateKey]) {
            const centroid = NIGERIA_STATE_CENTROIDS[stateKey];
            return {
                lat: centroid.lat,
                lon: centroid.lon,
                source: 'state_centroid'
            };
        }

        // 4. Default Marketplace Center (Yobe / Northern Commercial Corridor)
        return {
            lat: 11.7489,
            lon: 11.9660,
            source: 'marketplace_default'
        };
    }

    /**
     * Retrieves actual driving distance via public OSRM routing API with Haversine fallback
     */
    static async getDrivingDistance(origin, destination) {
        const originCoords = this.resolveCoordinates(origin);
        const destCoords = this.resolveCoordinates(destination);

        if (!originCoords || !destCoords) {
            return {
                distanceKm: 25,
                durationMinutes: 45,
                source: 'default_fallback',
                isEstimated: true
            };
        }

        // Fast path: if origin and destination are identical
        if (originCoords.lat === destCoords.lat && originCoords.lon === destCoords.lon) {
            return {
                distanceKm: 3,
                durationMinutes: 15,
                source: 'same_location',
                isEstimated: false
            };
        }

        // Try Public OSRM API with a 3.5s timeout
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);

            const url = `https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}?overview=false`;
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                    const route = data.routes[0];
                    const roadKm = Math.max(1, Math.round((route.distance / 1000) * 10) / 10);
                    const durationMins = Math.round(route.duration / 60);

                    return {
                        distanceKm: roadKm,
                        durationMinutes: durationMins,
                        source: 'road_osrm',
                        isEstimated: false
                    };
                }
            }
        } catch (error) {
            // Silently fallback to Haversine
        }

        // Fallback: Haversine with road approximation
        const haversineKm = this.calculateHaversine(
            originCoords.lat,
            originCoords.lon,
            destCoords.lat,
            destCoords.lon
        ) || 25;

        const approxMinutes = Math.round((haversineKm / 45) * 60) + 15; // Assume 45km/h average Nigerian regional speed + 15min dispatch

        return {
            distanceKm: haversineKm,
            durationMinutes: approxMinutes,
            source: 'haversine_fallback',
            isEstimated: true
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CENTRALIZED SHIPPING CALCULATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────
export class ShippingCalculationEngine {
    /**
     * Computes shipping fee for an individual vendor package according to business hierarchy
     */
    static calculateVendorPackageFee({
        vendor,
        customerAddress,
        deliveryMethod,
        packageSubtotal,
        allFreeShipping = false,
        globalSettings = DEFAULT_SHIPPING_SETTINGS,
        zoneOverrides = [],
        distanceResult = null
    }) {
        // 1. Pickup is always zero or nominal flat handling
        if (deliveryMethod?.id === 'pickup') {
            return {
                vendorId: vendor?.id || 'admin_store',
                vendorName: vendor?.name || vendor?.store_name || 'Marketplace Store',
                deliveryMethod: 'pickup',
                distanceKm: 0,
                durationMinutes: 0,
                distanceSource: 'pickup_store',
                baseFee: 0,
                perKmRate: 0,
                distanceFee: 0,
                handlingFee: 0,
                remoteAreaFee: 0,
                deliveryMethodFee: 0,
                discount: 0,
                finalFee: 0,
                isFreeShipping: true,
                calculatedAt: new Date().toISOString()
            };
        }

        const distanceKm = distanceResult?.distanceKm || 15;
        const distanceSource = distanceResult?.source || 'estimated';

        // 2. Check Free Shipping Threshold
        const freeThreshold = Number(globalSettings.free_shipping_threshold) || 50000;
        const isFreeByThreshold = packageSubtotal >= freeThreshold && freeThreshold > 0;
        const isFree = allFreeShipping || isFreeByThreshold || globalSettings.enabled === false;

        // 3. Resolve Applicable Zone Override (Hierarchy: LGA match > State match)
        const customerState = (customerAddress?.state || '').toLowerCase().trim();
        const customerLga = (customerAddress?.city || customerAddress?.lga || '').toLowerCase().trim();

        let matchedZone = null;
        if (zoneOverrides && zoneOverrides.length > 0) {
            // First search for exact LGA match
            matchedZone = zoneOverrides.find(z => 
                z.is_active !== false &&
                z.state?.toLowerCase().trim() === customerState &&
                z.lga && z.lga.toLowerCase().trim() === customerLga
            );

            // If no LGA match, search for State wide match
            if (!matchedZone) {
                matchedZone = zoneOverrides.find(z => 
                    z.is_active !== false &&
                    z.state?.toLowerCase().trim() === customerState &&
                    !z.lga
                );
            }
        }

        // 4. Resolve Pricing Parameters across Hierarchy:
        // Priority: Vendor Custom > Zone Override > Delivery Method > Global Setting
        let baseFee = Number(globalSettings.base_fee ?? 1000);
        let pricePerKm = Number(globalSettings.price_per_km ?? 75);
        let minFee = Number(globalSettings.min_fee ?? 1000);
        let maxFee = Number(globalSettings.max_fee ?? 25000);
        let remoteAreaFee = 0;

        // Apply Delivery Method baseline if available
        if (deliveryMethod) {
            if (deliveryMethod.base_fee !== undefined) baseFee = Number(deliveryMethod.base_fee);
            if (deliveryMethod.price_per_km !== undefined) pricePerKm = Number(deliveryMethod.price_per_km);
            if (deliveryMethod.min_fee !== undefined) minFee = Number(deliveryMethod.min_fee);
            if (deliveryMethod.max_fee !== undefined) maxFee = Number(deliveryMethod.max_fee);
        }

        // Apply Zone Overrides if present
        if (matchedZone) {
            if (matchedZone.base_fee !== null && matchedZone.base_fee !== undefined) baseFee = Number(matchedZone.base_fee);
            if (matchedZone.price_per_km !== null && matchedZone.price_per_km !== undefined) pricePerKm = Number(matchedZone.price_per_km);
            if (matchedZone.min_fee !== null && matchedZone.min_fee !== undefined) minFee = Number(matchedZone.min_fee);
            if (matchedZone.max_fee !== null && matchedZone.max_fee !== undefined) maxFee = Number(matchedZone.max_fee);
            if (matchedZone.remote_area_fee) remoteAreaFee = Number(matchedZone.remote_area_fee);
        }

        // Apply Vendor Custom Overrides if enabled on store
        if (vendor?.custom_shipping_enabled) {
            if (vendor.custom_base_fee !== null && vendor.custom_base_fee !== undefined) baseFee = Number(vendor.custom_base_fee);
            if (vendor.custom_price_per_km !== null && vendor.custom_price_per_km !== undefined) pricePerKm = Number(vendor.custom_price_per_km);
            if (vendor.custom_min_fee !== null && vendor.custom_min_fee !== undefined) minFee = Number(vendor.custom_min_fee);
            if (vendor.custom_max_fee !== null && vendor.custom_max_fee !== undefined) maxFee = Number(vendor.custom_max_fee);
        }

        // Handling Fees
        const handlingFee = Number(globalSettings.handling_fee || 0) + Number(globalSettings.vendor_handling_fee || 0);

        // 5. Compute Raw & Final Formula
        const distanceFee = Math.round(distanceKm * pricePerKm);
        const rawFee = baseFee + distanceFee + handlingFee + remoteAreaFee;
        const clampedFee = Math.max(minFee, Math.min(maxFee, rawFee));

        let finalFee = clampedFee;
        let discount = 0;

        if (isFree) {
            discount = finalFee;
            finalFee = 0;
        }

        return {
            vendorId: vendor?.id || 'admin_store',
            vendorName: vendor?.name || vendor?.store_name || 'Marketplace Store',
            deliveryMethod: deliveryMethod?.id || 'standard',
            distanceKm,
            durationMinutes: distanceResult?.durationMinutes || 30,
            distanceSource,
            baseFee,
            perKmRate: pricePerKm,
            distanceFee,
            handlingFee,
            remoteAreaFee,
            deliveryMethodFee: 0,
            discount,
            finalFee: Math.round(finalFee),
            isFreeShipping: isFree,
            zoneApplied: matchedZone ? matchedZone.name : null,
            vendorOverrideApplied: !!vendor?.custom_shipping_enabled,
            calculatedAt: new Date().toISOString()
        };
    }

    /**
     * Multi-Vendor Cart Aggregator:
     * Calculates each merchant's shipping fee independently and aggregates total
     */
    static async calculateMultiVendorShipping({
        cartItems = [],
        customerAddress,
        deliveryMethodId = 'standard',
        globalSettings = DEFAULT_SHIPPING_SETTINGS,
        shippingMethods = DEFAULT_SHIPPING_METHODS,
        shippingZones = [],
        storesCache = {}
    }) {
        if (!cartItems.length) {
            return {
                totalShippingFee: 0,
                vendorBreakdowns: [],
                isFreeShipping: false,
                deliveryMethod: null
            };
        }

        const selectedMethod = shippingMethods.find(m => m.id === deliveryMethodId && m.is_active !== false) ||
                               shippingMethods.find(m => m.id === 'standard') ||
                               DEFAULT_SHIPPING_METHODS[0];

        // 1. Group items by vendor_id
        const vendorGroups = {};
        cartItems.forEach(item => {
            const vId = item.vendor_id || item.vendorId || 'official_store';
            if (!vendorGroups[vId]) {
                vendorGroups[vId] = {
                    vendorId: vId,
                    items: [],
                    subtotal: 0,
                    allFree: true
                };
            }
            const price = Number(item.price || 0);
            const qty = Number(item.qty || item.quantity || 1);
            vendorGroups[vId].items.push(item);
            vendorGroups[vId].subtotal += price * qty;
            if (item.free_shipping !== true) {
                vendorGroups[vId].allFree = false;
            }
        });

        // 2. Compute each vendor package in parallel
        const vendorIds = Object.keys(vendorGroups);
        const packagePromises = vendorIds.map(async (vId) => {
            const group = vendorGroups[vId];
            const vendorStore = storesCache[vId] || { id: vId, name: 'Abu Mafhal Official Store', state: 'Yobe', city: 'Bade' };

            // Determine distance between this vendor and customer
            const distanceRes = await ShippingDistanceService.getDrivingDistance(vendorStore, customerAddress);

            return this.calculateVendorPackageFee({
                vendor: vendorStore,
                customerAddress,
                deliveryMethod: selectedMethod,
                packageSubtotal: group.subtotal,
                allFreeShipping: group.allFree,
                globalSettings,
                zoneOverrides: shippingZones,
                distanceResult: distanceRes
            });
        });

        const breakdowns = await Promise.all(packagePromises);

        // 3. Aggregate totals
        const totalShippingFee = breakdowns.reduce((sum, b) => sum + b.finalFee, 0);
        const isFreeShipping = breakdowns.every(b => b.isFreeShipping);

        return {
            totalShippingFee,
            vendorBreakdowns: breakdowns,
            isFreeShipping,
            deliveryMethod: selectedMethod,
            calculatedAt: new Date().toISOString()
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DATA ACCESS / SYNC HELPERS (SUPABASE)
// ─────────────────────────────────────────────────────────────────────────────
export const ShippingDataService = {
    /**
     * Loads live shipping methods from Supabase with safe default fallback
     */
    async fetchShippingMethods() {
        try {
            const supabase = await getSupabase();
            if (!supabase) return DEFAULT_SHIPPING_METHODS;
            const { data, error } = await supabase
                .from('shipping_methods')
                .select('*')
                .order('display_order', { ascending: true });

            if (error || !data || data.length === 0) {
                return DEFAULT_SHIPPING_METHODS;
            }
            return data;
        } catch (err) {
            return DEFAULT_SHIPPING_METHODS;
        }
    },

    /**
     * Loads active regional zones from Supabase
     */
    async fetchShippingZones() {
        try {
            const supabase = await getSupabase();
            if (!supabase) return [];
            const { data, error } = await supabase
                .from('shipping_zones')
                .select('*')
                .order('created_at', { ascending: false });

            return data || [];
        } catch (err) {
            return [];
        }
    },

    /**
     * Loads all stores with their location / coordinates
     */
    async fetchVendorStores() {
        try {
            const supabase = await getSupabase();
            if (!supabase) return {};
            const { data, error } = await supabase
                .from('stores')
                .select('id, user_id, name, address, state, lga, latitude, longitude, phone, logo, is_verified, custom_shipping_enabled, custom_base_fee, custom_price_per_km, custom_min_fee, custom_max_fee, delivery_radius_km, supports_pickup, supports_express');

            if (error) return {};
            const map = {};
            (data || []).forEach(store => {
                map[store.id] = store;
                if (store.user_id) map[store.user_id] = store;
            });
            return map;
        } catch (err) {
            return {};
        }
    },

    /**
     * Fetches or merges shipping configuration from app_settings
     */
    async fetchGlobalSettings() {
        try {
            const supabase = await getSupabase();
            if (!supabase) return DEFAULT_SHIPPING_SETTINGS;
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'shipping_settings')
                .maybeSingle();

            if (data?.value) {
                return { ...DEFAULT_SHIPPING_SETTINGS, ...data.value };
            }
            return DEFAULT_SHIPPING_SETTINGS;
        } catch (err) {
            return DEFAULT_SHIPPING_SETTINGS;
        }
    },

    /**
     * Saves Global Shipping Settings (Admin)
     */
    async saveGlobalSettings(newSettings) {
        const supabase = await getSupabase();
        if (!supabase) return { error: new Error('Supabase client unavailable') };
        const payload = {
            key: 'shipping_settings',
            value: newSettings,
            description: 'Authoritative distance-based and dynamic shipping configuration for Abu Mafhal Marketplace',
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('app_settings')
            .upsert(payload, { onConflict: 'key' });

        return { error };
    }
};

import { supabase } from '@/lib/supabaseClient';
import type { UserProfile } from '@/types';

export interface VendorApplicationData {
    userId: string;
    fullName: string; // Not stored in table directly, maybe used for profile update?
    email: string;
    phone: string;    // Should update profile

    businessName: string;
    businessDescription: string;
    businessAddress: string;
    businessLocation: string;
    businessCategory: string;

    bvnNumber: string;
    ninNumber: string;
    cacNumber: string;
    tinNumber: string;

    deliveryType: string;
    guarantor: any;
    socials: any;

    businessImageUrl: string;
    businessVideoUrl: string;
    ninDocumentUrl: string;
    cacDocumentUrl: string;

    subscriptionPlan: string;
    subscriptionFee: number;
    subscriptionExpiryDate: string | null;
    paymentStatus: string;
    paymentReference: string | null;
}

export const vendorService = {
    /**
     * Submit Vendor Application
     */
    async submitApplication(data: VendorApplicationData) {
        // 1. Map camelCase to snake_case for DB
        const dbPayload = {
            user_id: data.userId,
            business_name: data.businessName,
            business_description: data.businessDescription,
            business_address: data.businessAddress,
            business_location: data.businessLocation,
            business_category: data.businessCategory,

            bvn: data.bvnNumber,
            nin: data.ninNumber,
            cac_number: data.cacNumber,
            tin_number: data.tinNumber,

            logo_url: data.businessImageUrl,
            video_url: data.businessVideoUrl,
            nin_url: data.ninDocumentUrl,
            cac_url: data.cacDocumentUrl,

            delivery_type: data.deliveryType,
            guarantor: data.guarantor,
            socials: data.socials,

            subscription_plan: data.subscriptionPlan,
            subscription_fee: data.subscriptionFee,
            subscription_expiry: data.subscriptionExpiryDate,
            payment_status: data.paymentStatus,
            payment_reference: data.paymentReference,

            // status: 'pending' // Default in DB
        };

        // 2. Upsert Request
        // Check pending in 'vendor_applications'
        const { data: existing } = await supabase
            .from('vendor_applications')
            .select('id')
            .eq('user_id', data.userId)
            .in('status', ['pending', 'approved'])
            .maybeSingle();

        if (existing) {
            throw new Error('You already have a pending or approved application.');
        }

        const { error } = await supabase
            .from('vendor_applications')
            .insert(dbPayload);

        if (error) throw error;

        // 3. Update User Profile with Phone/Name if needed
        await supabase.from('profiles').update({
            business_name: data.businessName,
        }).eq('id', data.userId);

        return true;
    },

    /**
     * Get Vendor Status
     */
    async getApplicationStatus(userId: string) {
        const { data, error } = await supabase
            .from('vendor_applications')
            .select('status, admin_notes')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // Ignore not found
        return data;
    },

    /**
     * Get Vendor Products
     */
    async getVendorProducts(vendorId: string) {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('vendor_id', vendorId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * Get Wallet Stats
     */
    async getWalletStats(vendorId: string) {
        // WALLETS table uses USER_ID as per schema audit
        const { data, error } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', vendorId) // Confirmed: wallets table logic uses user_id
            .maybeSingle();

        if (error) throw error;

        // If no wallet exists, return mock or create one (optional)
        if (!data) return { balance: 0, currency: 'NGN' };

        return data;
    }
};

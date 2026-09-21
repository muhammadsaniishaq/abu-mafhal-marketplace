import { supabase } from './supabase';
import { Alert, Platform, Vibration } from 'react-native';

// ---------------------------------------------------------------------------
// Dynamic Resend API Key
// We intentionally avoid a module-level constant so the admin can update the
// key from the Admin Settings page without needing a redeploy.
// ---------------------------------------------------------------------------
let _resendKeyCache = null;     // cached value
let _resendKeyCacheTs = 0;      // timestamp of last fetch (ms)
const _RESEND_KEY_TTL = 60000; // re-fetch at most every 60 s

async function getResendApiKey() {
    // 1. First try env var (useful in dev / CI)
    const envKey = process.env.RESEND_API_KEY || process.env.EXPO_PUBLIC_RESEND_API_KEY || '';
    if (envKey && !envKey.includes('12345')) return envKey;

    // 2. Serve from cache if fresh
    const now = Date.now();
    if (_resendKeyCache && now - _resendKeyCacheTs < _RESEND_KEY_TTL) {
        return _resendKeyCache;
    }

    // 3. Fetch from app_settings table
    try {
        const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'resend_api_key')
            .maybeSingle();

        const key = data?.value?.value || data?.value || '';
        if (key && typeof key === 'string' && key.length > 8) {
            _resendKeyCache = key;
            _resendKeyCacheTs = now;
            return key;
        }

        // Also try the singleton row format used by updateSettings
        const { data: singleton } = await supabase
            .from('app_settings')
            .select('resend_api_key')
            .eq('id', 1)
            .maybeSingle();

        const singletonKey = singleton?.resend_api_key || '';
        if (singletonKey && typeof singletonKey === 'string' && singletonKey.length > 8) {
            _resendKeyCache = singletonKey;
            _resendKeyCacheTs = now;
            return singletonKey;
        }
    } catch (_) {}

    return '';
}

// Expose cache invalidation so AdminSettings can bust it on save
export function invalidateResendKeyCache() {
    _resendKeyCache = null;
    _resendKeyCacheTs = 0;
}

// Legacy compat export (may be empty — check is now inside sendEmail)
export const RESEND_API_KEY = '';

export const NotificationService = {

    /**
     * Request browser / device push notification permission if available
     */
    async requestPermission() {
        try {
            if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
                if (Notification.permission === 'default') {
                    await Notification.requestPermission();
                }
                return Notification.permission === 'granted';
            }
        } catch (_) {}
        return true;
    },

    /**
     * Trigger a local push banner / sound
     */
    triggerLocalPush(title, body) {
        try {
            if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
                if (Notification.permission === 'granted') {
                    new Notification(title, {
                        body,
                        icon: '/favicon.ico',
                        badge: '/favicon.ico'
                    });
                }
            } else if (Platform.OS !== 'web') {
                Vibration.vibrate([0, 200, 100, 200]);
            }
        } catch (_) {}
    },

    /**
     * Send a notification (In-App + Local Push + Email)
     * @param {string} userId - Target User ID
     * @param {string} title - Title
     * @param {string} message - Body
     * @param {string} type - 'order' | 'shipping' | 'system' | 'login'
     * @param {string} email - (Optional) User email for sending mail
     * @param {object} extra - (Optional) Extra payload
     */
    async send({ userId, title, message, type = 'order', email, extra = {} }) {
        const result = { db: false, email: false, error: null };

        // 1. Trigger immediate local push banner & vibration
        this.triggerLocalPush(title, message);

        if (!userId) {
            console.log('[NotificationService] Skipping DB notification: No userId provided');
            return result;
        }

        try {
            // 2. Insert into Supabase notifications table
            // Verified schema columns: user_id, title, body, is_read, data
            const notifPayload = {
                user_id: userId,
                title: String(title || 'Notification').trim(),
                body: String(message || '').trim(),
                is_read: false,
                data: {
                    type: type || 'order',
                    ...extra
                }
            };

            const { data, error } = await supabase
                .from('notifications')
                .insert([notifPayload])
                .select('id')
                .maybeSingle();

            if (error) {
                console.warn('[NotificationService] In-App DB Note:', error.message);
                result.error = error.message;
            } else {
                result.db = true;
                result.id = data?.id;
            }

            // 3. Send Email (if email provided)
            if (email) {
                const emailResult = await this.sendEmail(email, title, message);
                result.email = emailResult;
            }

        } catch (err) {
            console.warn('[NotificationService] Error:', err.message);
            result.error = err.message;
        }

        return result;
    },

    /**
     * High-level helper for Order Placement Notifications
     */
    async sendOrderNotification({ userId, orderId, amount, gateway, email, phone }) {
        const orderShort = (orderId || '').slice(0, 8).toUpperCase();
        const formattedAmount = Number(amount || 0).toLocaleString();

        const title = `Order Confirmed (#${orderShort})`;
        const message = `Your order of ₦${formattedAmount} via ${gateway || 'Online'} has been placed successfully and is being prepared for dispatch.`;

        return await this.send({
            userId,
            title,
            message,
            type: 'order',
            email,
            extra: {
                order_id: orderId,
                order_number: orderShort,
                amount,
                gateway,
                phone
            }
        });
    },

    /**
     * Send Email via Resend API
     * Dynamically fetches the API key from app_settings so admin changes
     * take effect without a redeploy.
     */
    async sendEmail(to, subject, htmlBody) {
        if (!to || !to.includes('@')) return false;

        const apiKey = await getResendApiKey();
        if (!apiKey || apiKey.includes('12345')) {
            console.log('[NotificationService] Email notice: Resend API Key is unconfigured. Set it in Admin → Advanced → Email API.');
            return false;
        }

        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    from: 'Abu Mafhal <support@abumafhal.com>',
                    to: [to],
                    subject: subject,
                    html: htmlBody
                })
            });

            const rawText = await response.text();
            let data = null;
            try {
                data = JSON.parse(rawText);
            } catch (_) {
                return false;
            }

            if (!response.ok) {
                console.warn('[NotificationService] Resend API Warning:', data?.message);
                return false;
            }

            console.log('[NotificationService] Email Sent successfully:', data?.id);
            return true;
        } catch (err) {
            console.warn('[NotificationService] Email Send Notice:', err.message);
            return false;
        }
    }
};

export default NotificationService;

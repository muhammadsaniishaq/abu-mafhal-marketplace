import { Linking } from 'react-native';
import { supabase } from '../lib/supabase';

/**
 * Normalizes phone numbers to standard international E.164 (without plus)
 * e.g. 08145853539 -> 2348145853539
 */
export const formatWhatsAppPhone = (raw) => {
    if (!raw) return '';
    let digits = String(raw).replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length === 11) {
        return '234' + digits.substring(1);
    }
    if (digits.length === 10) {
        return '234' + digits;
    }
    return digits;
};

/**
 * Service to manage WhatsApp notifications and direct messaging on mobile.
 */
export const whatsappService = {
    /**
     * Build standard click-to-chat URL
     */
    getWhatsAppUrl(phone, message = '') {
        const cleanPhone = formatWhatsAppPhone(phone);
        const encoded = encodeURIComponent(message || '');
        return `https://wa.me/${cleanPhone}?text=${encoded}`;
    },

    /**
     * Open WhatsApp directly on device
     */
    async openWhatsApp(phone, message = '') {
        const cleanPhone = formatWhatsAppPhone(phone);
        const url = this.getWhatsAppUrl(cleanPhone, message);
        try {
            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
                return true;
            } else {
                await Linking.openURL(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`);
                return true;
            }
        } catch (e) {
            console.warn('[whatsappService] Could not open WhatsApp directly:', e.message);
            return false;
        }
    },

    /**
     * Send a WhatsApp message immediately via Database Queue + Edge Function
     */
    async sendDirect(phone, message, userId = null) {
        const cleanPhone = formatWhatsAppPhone(phone);
        if (!cleanPhone || !message) {
            console.warn('[whatsappService] Missing phone or message for WhatsApp dispatch');
            return { success: false, error: 'Phone and message required' };
        }

        let queuedRecord = null;

        // 1. Queue into whatsapp_messages table (reliable database trigger)
        try {
            const { data, error } = await supabase
                .from('whatsapp_messages')
                .insert({
                    phone: cleanPhone,
                    message: message.trim(),
                    user_id: userId,
                    status: 'pending'
                })
                .select()
                .maybeSingle();

            if (!error && data) {
                queuedRecord = data;
            }
        } catch (err) {
            console.warn('[whatsappService] DB Queue notice:', err.message);
        }

        // 2. Invoke Edge Function for instant push if available
        try {
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('whatsapp-webhook', {
                body: {
                    action: 'send',
                    phone: cleanPhone,
                    message: message.trim(),
                    userId
                }
            });

            if (!edgeError && edgeData) {
                return { success: true, queued: !!queuedRecord, edge: edgeData };
            }
        } catch (err) {
            console.log('[whatsappService] Edge invoke note (queued in DB):', err.message);
        }

        return { success: !!queuedRecord, queued: true, record: queuedRecord };
    },

    /**
     * Send a WhatsApp template message immediately
     */
    async sendTemplate(phone, templateName, templateParams = [], userId = null) {
        const cleanPhone = formatWhatsAppPhone(phone);
        try {
            const { data, error } = await supabase.functions.invoke('whatsapp-webhook', {
                body: {
                    action: 'send',
                    phone: cleanPhone,
                    type: 'template',
                    templateName,
                    templateParams,
                    userId
                }
            });
            if (error) throw error;
            return data;
        } catch (error) {
            console.warn('[whatsappService] Template invoke fallback:', error.message);
            const fallbackMsg = `[Notification] Template: ${templateName} [${templateParams.join(', ')}]`;
            return this.sendDirect(cleanPhone, fallbackMsg, userId);
        }
    },

    /**
     * Send Order Confirmation via WhatsApp
     */
    async sendOrderNotification({ phone, orderId, totalAmount, paymentMethod, userId = null }) {
        const cleanPhone = formatWhatsAppPhone(phone);
        const orderShort = (orderId || '').slice(0, 8).toUpperCase();
        const formattedAmount = Number(totalAmount || 0).toLocaleString();

        const msg = `🎉 *Order Confirmed! (#${orderShort})*\n\nThank you for shopping with *Abu Mafhal Marketplace*!\n\n📦 *Order Number:* #${orderShort}\n💰 *Amount:* ₦${formattedAmount}\n💳 *Payment:* ${paymentMethod || 'Online'}\n🚚 *Status:* Packaging for Dispatch\n\nTrack your order anytime in the Abu Mafhal App or reply here for live support!`;

        return await this.sendDirect(cleanPhone, msg, userId);
    }
};

export default whatsappService;

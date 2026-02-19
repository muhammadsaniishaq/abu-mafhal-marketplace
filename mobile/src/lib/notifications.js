import { supabase } from './supabase';
import { Alert } from 'react-native';

// REPLACE WITH YOUR FULL RESEND API KEY
// You can get this from https://resend.com/api-keys
// [IMPORTANT] Ensure this key starts with 're_' and is active.
export const RESEND_API_KEY = 're_jog5a7d6_5uofEsHm57R6re2SJX5stpAR';

export const NotificationService = {

    /**
     * Send a notification (In-App + Email)
     * @param {string} userId - Target User ID
     * @param {string} title - Title
     * @param {string} message - Body
     * @param {string} type - 'order' | 'shipping' | 'system' | 'login'
     * @param {string} email - (Optional) User email for sending mail
     */
    async send({ userId, title, message, type, email }) {
        const result = { db: false, email: false, error: null };

        if (!userId) {
            console.log('Skipping notification: No userId provided');
            return result;
        }

        try {
            // 1. Insert into Database (In-App)
            // [FIX] DB Column appears to be 'userId' (camelCase) based on error logs
            const { error } = await supabase.from('notifications').insert([{
                userId: userId,
                user_id: userId, // Send both just in case, Supabase ignores extras usually (or we can try just userId)
                title,
                message,
                type
            }]);

            if (error) {
                console.log('Notification DB Error:', error);
                result.error = "In-App DB Error: " + error.message;
            } else {
                result.db = true;
            }

            // 2. Send Email (if email provided)
            if (email) {
                const emailResult = await this.sendEmail(email, title, message);
                result.email = emailResult;
                if (!emailResult) result.error = (result.error || "") + " Email Failed.";
            }

        } catch (err) {
            console.log('Notification Service Error:', err);
            result.error = err.message;
        }

        return result;
    },

    /**
     * Send Email via Resend API
     */
    async sendEmail(to, subject, htmlBody) {
        // [DEBUG] Check API Key
        if (!RESEND_API_KEY || RESEND_API_KEY.includes('12345')) {
            console.log('Email skipped: No valid Resend API Key.');
            return false;
        }

        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${RESEND_API_KEY}`
                },
                body: JSON.stringify({
                    from: 'Abu Mafhal <support@abumafhal.com>',
                    to: [to],
                    subject: subject,
                    html: htmlBody
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Resend API Error (Full):", JSON.stringify(data, null, 2));
                const errMsg = data.message || JSON.stringify(data);
                Alert.alert("Resend Error", errMsg);
                return false;
            }

            console.log('Email Sent:', data);
            return true;

        } catch (err) {
            console.log('Email Send Error:', err);
            Alert.alert("Network Error", "Could not connect to Resend: " + err.message);
            return false;
        }
    }
};

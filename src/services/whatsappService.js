import { supabase } from '../config/supabase';

/**
 * Service to manage WhatsApp notifications and direct messaging.
 * All requests are routed through Supabase to preserve security (tokens are kept in secrets).
 */
export const whatsappService = {
  /**
   * Send a WhatsApp message immediately via the Edge Function
   */
  async sendDirect(phone, message, userId = null) {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-webhook', {
        body: {
          action: 'send',
          phone,
          message,
          userId
        }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error sending WhatsApp message directly:', error.message);
      // Fallback: Queue in database so it can retry or process in background
      return this.queueMessage(phone, message, userId);
    }
  },

  /**
   * Send a WhatsApp template message immediately via the Edge Function
   */
  async sendTemplate(phone, templateName, templateParams = [], userId = null) {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-webhook', {
        body: {
          action: 'send',
          phone,
          type: 'template',
          templateName,
          templateParams,
          userId
        }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error sending WhatsApp template:', error.message);
      // Fallback: Queue a formatted fallback text in database
      const fallbackMsg = `Template: ${templateName} [${templateParams.join(', ')}]`;
      return this.queueMessage(phone, fallbackMsg, userId);
    }
  },

  /**
   * Queue a WhatsApp message in the database (runs via Supabase DB Webhook in background)
   */
  async queueMessage(phone, message, userId = null) {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .insert({
          phone,
          message,
          user_id: userId,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, queued: true, record: data };
    } catch (error) {
      console.error('Error queueing WhatsApp message in database:', error.message);
      throw error;
    }
  }
};

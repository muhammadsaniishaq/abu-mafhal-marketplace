import { supabase } from '../config/supabase';
import { createNotification, NOTIFICATION_TYPES } from './notificationService';

export const createDispute = async (disputeData) => {
  try {
    const { data, error } = await supabase
      .from('disputes')
      .insert({
        user_id: disputeData.userId,
        order_id: disputeData.orderId,
        vendor_id: disputeData.vendorId,
        reason: disputeData.reason,
        description: disputeData.description,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Notify admin about new dispute
    await createNotification({
      userId: 'admin',
      title: '⚠️ New Dispute Created',
      message: `Dispute #${data.id.substring(0, 8)} has been created for order #${disputeData.orderId.substring(0, 8)}`,
      type: NOTIFICATION_TYPES.NEW_MESSAGE,
      actionUrl: `/admin/disputes/${data.id}`,
      metadata: { disputeId: data.id, orderId: disputeData.orderId }
    });

    return data.id;
  } catch (error) {
    console.error('Error creating dispute:', error.message);
    throw error;
  }
};

export const addDisputeMessage = async (disputeId, message, senderId, senderRole) => {
  try {
    const { error: msgError } = await supabase
      .from('dispute_messages')
      .insert({
        dispute_id: disputeId,
        message,
        sender_id: senderId,
        sender_role: senderRole,
        created_at: new Date().toISOString()
      });

    if (msgError) throw msgError;

    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .select('*')
      .eq('id', disputeId)
      .single();

    if (disputeError) throw disputeError;

    await supabase
      .from('disputes')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', disputeId);

    // Notify the other party
    const notifyUserId = senderRole === 'admin' ? dispute.user_id : 'admin';
    await createNotification({
      userId: notifyUserId,
      title: '💬 New Dispute Message',
      message: `New message in dispute #${disputeId.substring(0, 8)}`,
      type: NOTIFICATION_TYPES.NEW_MESSAGE,
      actionUrl: `/disputes/${disputeId}`,
      metadata: { disputeId }
    });

    return true;
  } catch (error) {
    console.error('Error adding dispute message:', error.message);
    throw error;
  }
};

export const updateDisputeStatus = async (disputeId, status, resolution = '') => {
  try {
    const { data: dispute, error: fetchError } = await supabase
      .from('disputes')
      .select('*')
      .eq('id', disputeId)
      .single();

    if (fetchError) throw fetchError;

    const { error: updateError } = await supabase
      .from('disputes')
      .update({
        status,
        resolution,
        resolved_at: status === 'resolved' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', disputeId);

    if (updateError) throw updateError;

    // Notify user about status change
    await createNotification({
      userId: dispute.user_id,
      title: `⚖️ Dispute ${status === 'resolved' ? 'Resolved' : 'Updated'}`,
      message: `Your dispute #${disputeId.substring(0, 8)} has been ${status}`,
      type: NOTIFICATION_TYPES.NEW_MESSAGE,
      actionUrl: `/buyer/disputes/${disputeId}`,
      metadata: { disputeId, status }
    });

    return true;
  } catch (error) {
    console.error('Error updating dispute:', error.message);
    throw error;
  }
};

export const getDisputes = async (userId = null, role = 'buyer') => {
  try {
    let query = supabase
      .from('disputes')
      .select(`
        *,
        dispute_messages(*)
      `)
      .order('created_at', { ascending: false });
    
    if (role !== 'admin' && userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    // Map dispute_messages to messages for front-end parity
    return data.map(dispute => ({
      ...dispute,
      messages: dispute.dispute_messages || []
    }));
  } catch (error) {
    console.error('Error getting disputes:', error.message);
    return [];
  }
};

export const getDisputeById = async (disputeId) => {
  try {
    const { data, error } = await supabase
      .from('disputes')
      .select(`
        *,
        dispute_messages(*)
      `)
      .eq('id', disputeId)
      .single();
    
    if (error) return null;
    
    return {
      ...data,
      messages: data.dispute_messages || []
    };
  } catch (error) {
    console.error('Error getting dispute:', error.message);
    return null;
  }
};

export const deleteDispute = async (disputeId) => {
  try {
    const { error } = await supabase
      .from('disputes')
      .update({
        deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('id', disputeId);
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting dispute:', error.message);
    throw error;
  }
};
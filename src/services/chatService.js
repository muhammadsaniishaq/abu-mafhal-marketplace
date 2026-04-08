import { supabase } from '../config/supabase';
import { createNotification, NOTIFICATION_TYPES } from './notificationService';

// Create or get existing conversation
export const getOrCreateConversation = async (buyerId, vendorId, productId = null) => {
  try {
    // Check if conversation already exists
    const { data: existing, error: findError } = await supabase
      .from('conversations')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('vendor_id', vendorId)
      .maybeSingle();
    
    if (existing) {
      return existing.id;
    }
    
    // Create new conversation
    const { data: profileBuyer } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', buyerId).single();
    const { data: profileVendor } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', vendorId).single();

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        participants: [buyerId, vendorId],
        participant_details: {
          [buyerId]: {
            name: profileBuyer?.full_name || 'Buyer',
            avatar: profileBuyer?.avatar_url || ''
          },
          [vendorId]: {
            name: profileVendor?.full_name || 'Vendor',
            avatar: profileVendor?.avatar_url || ''
          }
        },
        buyer_id: buyerId,
        vendor_id: vendorId,
        product_id: productId,
        last_message: '',
        last_message_at: new Date().toISOString(),
        unread_count: {
          [buyerId]: 0,
          [vendorId]: 0
        },
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error getting/creating conversation:', error.message);
    throw error;
  }
};

// Send a message
export const sendMessage = async (conversationId, senderId, senderRole, message, productId = null) => {
  try {
    // Add message to messages collection
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        sender_role: senderRole,
        message,
        product_id: productId,
        read: false,
        created_at: new Date().toISOString()
      });

    if (msgError) throw msgError;
    
    // Update conversation
    const { data: conversationData, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
      
    if (fetchError) throw fetchError;
    
    const otherUserId = conversationData.participants.find(id => id !== senderId);
    const newUnreadCount = { ...conversationData.unread_count };
    newUnreadCount[otherUserId] = (newUnreadCount[otherUserId] || 0) + 1;
    
    await supabase
      .from('conversations')
      .update({
        last_message: message.substring(0, 100),
        last_message_at: new Date().toISOString(),
        unread_count: newUnreadCount
      })
      .eq('id', conversationId);
    
    // Send notification to recipient
    const recipientId = senderRole === 'buyer' ? conversationData.vendor_id : conversationData.buyer_id;
    await createNotification({
      userId: recipientId,
      title: '💬 New Message',
      message: message.substring(0, 100),
      type: NOTIFICATION_TYPES.NEW_MESSAGE,
      actionUrl: `/messages/${conversationId}`,
      metadata: { conversationId }
    });
    
    return true;
  } catch (error) {
    console.error('Error sending message:', error.message);
    throw error;
  }
};

// Get user's conversations
export const getUserConversations = async (userId, role) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .contains('participants', [userId])
      .order('last_message_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting conversations:', error.message);
    return [];
  }
};

// Get messages for a conversation
export const getMessages = async (conversationId) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting messages:', error.message);
    return [];
  }
};

// Mark messages as read
export const markMessagesAsRead = async (conversationId, userId) => {
  try {
    const { data: convo } = await supabase
      .from('conversations')
      .select('unread_count')
      .eq('id', conversationId)
      .single();

    if (convo) {
      const newUnreadCount = { ...convo.unread_count };
      newUnreadCount[userId] = 0;

      await supabase
        .from('conversations')
        .update({ unread_count: newUnreadCount })
        .eq('id', conversationId);
    }
    
    return true;
  } catch (error) {
    console.error('Error marking messages as read:', error.message);
    throw error;
  }
};

// Subscribe to real-time messages
export const subscribeToMessages = (conversationId, callback) => {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, async (payload) => {
      // Re-fetch all messages to ensure order and state
      const messages = await getMessages(conversationId);
      callback(messages);
    })
    .subscribe();
    
  return () => {
    supabase.removeChannel(channel);
  };
};

// Get unread message count
export const getUnreadCount = async (userId, role) => {
  try {
    const conversations = await getUserConversations(userId, role);
    return conversations.reduce((total, conv) => total + (conv.unread_count?.[userId] || 0), 0);
  } catch (error) {
    console.error('Error getting unread count:', error.message);
    return 0;
  }
};
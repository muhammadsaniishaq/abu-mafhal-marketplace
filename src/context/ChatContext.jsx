import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!currentUser) return;

    // Fetch initial conversations
    const fetchConversations = async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .contains('participants', [currentUser.id])
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error.message);
        return;
      }
      setConversations(data || []);
      
      const totalUnread = (data || []).reduce((count, convo) => {
        return count + (convo.unread_count?.[currentUser.id] || 0);
      }, 0);
      setUnreadCount(totalUnread);
    };

    fetchConversations();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('public:conversations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `participants=cs.{${currentUser.id}}`
      }, (payload) => {
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  const createConversation = async (otherUserId, otherUserName, otherUserAvatar) => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          participants: [currentUser.id, otherUserId],
          participant_details: {
            [currentUser.id]: {
              name: currentUser.full_name || currentUser.name,
              avatar: currentUser.avatar_url || currentUser.avatar
            },
            [otherUserId]: {
              name: otherUserName,
              avatar: otherUserAvatar
            }
          },
          last_message: '',
          last_message_at: new Date().toISOString(),
          unread_count: {
            [currentUser.id]: 0,
            [otherUserId]: 0
          },
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating conversation:', error.message);
      throw error;
    }
  };

  const sendMessage = async (conversationId, message, attachments = []) => {
    try {
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUser.id,
          sender_name: currentUser.full_name || currentUser.name,
          message,
          attachments,
          read: false,
          created_at: new Date().toISOString()
        });

      if (msgError) throw msgError;

      // Update conversation
      const convo = conversations.find(c => c.id === conversationId);
      if (!convo) return;
      
      const otherUserId = convo.participants.find(id => id !== currentUser.id);
      const newUnreadCount = { ...convo.unread_count };
      newUnreadCount[otherUserId] = (newUnreadCount[otherUserId] || 0) + 1;

      const { error: convoError } = await supabase
        .from('conversations')
        .update({
          last_message: message,
          last_message_at: new Date().toISOString(),
          unread_count: newUnreadCount
        })
        .eq('id', conversationId);

      if (convoError) throw convoError;
    } catch (error) {
      console.error('Error sending message:', error.message);
      throw error;
    }
  };

  const markAsRead = async (conversationId) => {
    try {
      const convo = conversations.find(c => c.id === conversationId);
      if (!convo) return;

      const newUnreadCount = { ...convo.unread_count };
      newUnreadCount[currentUser.id] = 0;

      await supabase
        .from('conversations')
        .update({ unread_count: newUnreadCount })
        .eq('id', conversationId);
    } catch (error) {
      console.error('Error marking as read:', error.message);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        unreadCount,
        createConversation,
        sendMessage,
        markAsRead
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
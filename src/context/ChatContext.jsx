import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
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

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', currentUser.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setConversations(convos);

      const unread = convos.reduce((count, convo) => {
        return count + (convo.unreadCount?.[currentUser.uid] || 0);
      }, 0);
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const createConversation = async (otherUserId, otherUserName, otherUserAvatar) => {
    try {
      const conversationRef = await addDoc(collection(db, 'conversations'), {
        participants: [currentUser.uid, otherUserId],
        participantDetails: {
          [currentUser.uid]: {
            name: currentUser.name,
            avatar: currentUser.avatar
          },
          [otherUserId]: {
            name: otherUserName,
            avatar: otherUserAvatar
          }
        },
        lastMessage: '',
        lastMessageAt: new Date().toISOString(),
        unreadCount: {
          [currentUser.uid]: 0,
          [otherUserId]: 0
        },
        createdAt: new Date().toISOString()
      });
      return conversationRef.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  };

  const sendMessage = async (conversationId, message, attachments = []) => {
    try {
      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        senderId: currentUser.uid,
        senderName: currentUser.name,
        message,
        attachments,
        read: false,
        createdAt: new Date().toISOString()
      });

      // Update conversation
      const convo = conversations.find(c => c.id === conversationId);
      const otherUserId = convo.participants.find(id => id !== currentUser.uid);

      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: message,
        lastMessageAt: new Date().toISOString(),
        [`unreadCount.${otherUserId}`]: (convo.unreadCount?.[otherUserId] || 0) + 1
      });
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  const markAsRead = async (conversationId) => {
    try {
      await updateDoc(doc(db, 'conversations', conversationId), {
        [`unreadCount.${currentUser.uid}`]: 0
      });
    } catch (error) {
      console.error('Error marking as read:', error);
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
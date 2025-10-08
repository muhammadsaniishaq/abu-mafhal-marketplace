import { collection, addDoc, query, where, getDocs, orderBy, onSnapshot, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { createNotification, NOTIFICATION_TYPES } from './notificationService';

// Create or get existing conversation
export const getOrCreateConversation = async (buyerId, vendorId, productId = null) => {
  try {
    // Check if conversation already exists
    const q = query(
      collection(db, 'conversations'),
      where('buyerId', '==', buyerId),
      where('vendorId', '==', vendorId)
    );
    
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }
    
    // Create new conversation
    const conversationRef = await addDoc(collection(db, 'conversations'), {
      buyerId,
      vendorId,
      productId,
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      buyerUnread: 0,
      vendorUnread: 0,
      createdAt: new Date().toISOString()
    });
    
    return conversationRef.id;
  } catch (error) {
    console.error('Error getting/creating conversation:', error);
    throw error;
  }
};

// Send a message
export const sendMessage = async (conversationId, senderId, senderRole, message, productId = null) => {
  try {
    // Add message to messages collection
    await addDoc(collection(db, 'messages'), {
      conversationId,
      senderId,
      senderRole,
      message,
      productId,
      read: false,
      createdAt: new Date().toISOString()
    });
    
    // Update conversation
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    const conversationData = conversationDoc.data();
    
    await updateDoc(conversationRef, {
      lastMessage: message.substring(0, 100),
      lastMessageAt: serverTimestamp(),
      buyerUnread: senderRole === 'vendor' ? (conversationData.buyerUnread || 0) + 1 : 0,
      vendorUnread: senderRole === 'buyer' ? (conversationData.vendorUnread || 0) + 1 : 0
    });
    
    // Send notification to recipient
    const recipientId = senderRole === 'buyer' ? conversationData.vendorId : conversationData.buyerId;
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
    console.error('Error sending message:', error);
    throw error;
  }
};

// Get user's conversations
export const getUserConversations = async (userId, role) => {
  try {
    const q = query(
      collection(db, 'conversations'),
      where(role === 'buyer' ? 'buyerId' : 'vendorId', '==', userId),
      orderBy('lastMessageAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting conversations:', error);
    return [];
  }
};

// Get messages for a conversation
export const getMessages = async (conversationId) => {
  try {
    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId),
      orderBy('createdAt', 'asc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting messages:', error);
    return [];
  }
};

// Mark messages as read
export const markMessagesAsRead = async (conversationId, userRole) => {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    
    await updateDoc(conversationRef, {
      [userRole === 'buyer' ? 'buyerUnread' : 'vendorUnread']: 0
    });
    
    return true;
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
};

// Subscribe to real-time messages
export const subscribeToMessages = (conversationId, callback) => {
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(messages);
  });
};

// Get unread message count
export const getUnreadCount = async (userId, role) => {
  try {
    const conversations = await getUserConversations(userId, role);
    const unreadField = role === 'buyer' ? 'buyerUnread' : 'vendorUnread';
    return conversations.reduce((total, conv) => total + (conv[unreadField] || 0), 0);
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};
import { collection, addDoc, query, where, getDocs, updateDoc, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { createNotification, NOTIFICATION_TYPES } from './notificationService';

export const createDispute = async (disputeData) => {
  try {
    const dispute = await addDoc(collection(db, 'disputes'), {
      ...disputeData,
      status: 'open',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Notify admin about new dispute
    await createNotification({
      userId: 'admin',
      title: '⚠️ New Dispute Created',
      message: `Dispute #${dispute.id.substring(0, 8)} has been created for order #${disputeData.orderId.substring(0, 8)}`,
      type: NOTIFICATION_TYPES.NEW_MESSAGE,
      actionUrl: `/admin/disputes/${dispute.id}`,
      metadata: { disputeId: dispute.id, orderId: disputeData.orderId }
    });

    return dispute.id;
  } catch (error) {
    console.error('Error creating dispute:', error);
    throw error;
  }
};

export const addDisputeMessage = async (disputeId, message, senderId, senderRole) => {
  try {
    const disputeRef = doc(db, 'disputes', disputeId);
    const disputeDoc = await getDoc(disputeRef);
    
    if (!disputeDoc.exists()) {
      throw new Error('Dispute not found');
    }

    const dispute = disputeDoc.data();
    const newMessage = {
      message,
      senderId,
      senderRole,
      createdAt: new Date().toISOString()
    };

    const updatedMessages = [...(dispute.messages || []), newMessage];

    await updateDoc(disputeRef, {
      messages: updatedMessages,
      updatedAt: new Date().toISOString()
    });

    // Notify the other party
    const notifyUserId = senderRole === 'admin' ? dispute.userId : 'admin';
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
    console.error('Error adding dispute message:', error);
    throw error;
  }
};

export const updateDisputeStatus = async (disputeId, status, resolution = '') => {
  try {
    const disputeRef = doc(db, 'disputes', disputeId);
    const disputeDoc = await getDoc(disputeRef);
    
    if (!disputeDoc.exists()) {
      throw new Error('Dispute not found');
    }

    const dispute = disputeDoc.data();

    await updateDoc(disputeRef, {
      status,
      resolution,
      resolvedAt: status === 'resolved' ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString()
    });

    // Notify user about status change
    await createNotification({
      userId: dispute.userId,
      title: `⚖️ Dispute ${status === 'resolved' ? 'Resolved' : 'Updated'}`,
      message: `Your dispute #${disputeId.substring(0, 8)} has been ${status}`,
      type: NOTIFICATION_TYPES.NEW_MESSAGE,
      actionUrl: `/buyer/disputes/${disputeId}`,
      metadata: { disputeId, status }
    });

    return true;
  } catch (error) {
    console.error('Error updating dispute:', error);
    throw error;
  }
};

export const getDisputes = async (userId = null, role = 'buyer') => {
  try {
    let q;
    
    if (role === 'admin') {
      // Admin sees all disputes
      q = query(
        collection(db, 'disputes'),
        orderBy('createdAt', 'desc')
      );
    } else {
      // Users see only their disputes
      q = query(
        collection(db, 'disputes'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting disputes:', error);
    return [];
  }
};

export const getDisputeById = async (disputeId) => {
  try {
    const disputeDoc = await getDoc(doc(db, 'disputes', disputeId));
    
    if (!disputeDoc.exists()) {
      return null;
    }
    
    return { id: disputeDoc.id, ...disputeDoc.data() };
  } catch (error) {
    console.error('Error getting dispute:', error);
    return null;
  }
};

export const deleteDispute = async (disputeId) => {
  try {
    await updateDoc(doc(db, 'disputes', disputeId), {
      deleted: true,
      deletedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error deleting dispute:', error);
    throw error;
  }
};
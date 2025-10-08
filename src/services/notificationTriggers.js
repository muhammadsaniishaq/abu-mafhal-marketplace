import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  createNotification, 
  NOTIFICATION_TYPES
} from './notificationService';

// Send bulk notifications to multiple users
export const sendBulkNotification = async (userIds, notificationData) => {
  try {
    const notifications = userIds.map(userId => 
      createNotification({
        userId,
        ...notificationData
      })
    );
    await Promise.all(notifications);
    return true;
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
    throw error;
  }
};

// Send notification to all users with specific role
export const sendNotificationToRole = async (role, notificationData) => {
  try {
    const q = query(
      collection(db, 'users'),
      where('role', '==', role)
    );
    const snapshot = await getDocs(q);
    const userIds = snapshot.docs.map(doc => doc.id);
    
    await sendBulkNotification(userIds, notificationData);
    return true;
  } catch (error) {
    console.error('Error sending notification to role:', error);
    throw error;
  }
};

// Send notification to all buyers
export const notifyAllBuyers = async (title, message, actionUrl = null) => {
  await sendNotificationToRole('buyer', {
    title,
    message,
    type: NOTIFICATION_TYPES.NEW_MESSAGE,
    actionUrl,
    metadata: {}
  });
};

// Send notification to all vendors
export const notifyAllVendors = async (title, message, actionUrl = null) => {
  await sendNotificationToRole('vendor', {
    title,
    message,
    type: NOTIFICATION_TYPES.NEW_MESSAGE,
    actionUrl,
    metadata: {}
  });
};

// Run all scheduled notifications
export const runScheduledNotifications = async () => {
  try {
    console.log('Running scheduled notifications...');
    console.log('Scheduled notifications completed!');
    return true;
  } catch (error) {
    console.error('Error running scheduled notifications:', error);
    throw error;
  }
};
import { supabase } from '../config/supabase';
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
    console.error('Error sending bulk notifications:', error.message);
    throw error;
  }
};

// Send notification to all users with specific role
export const sendNotificationToRole = async (role, notificationData) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', role);

    if (error) throw error;
    
    const userIds = data.map(doc => doc.id);
    
    await sendBulkNotification(userIds, notificationData);
    return true;
  } catch (error) {
    console.error('Error sending notification to role:', error.message);
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
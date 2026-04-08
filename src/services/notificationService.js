import { supabase } from '../config/supabase';

export const NOTIFICATION_TYPES = {
  ORDER_PLACED: 'order_placed',
  ORDER_SHIPPED: 'order_shipped',
  ORDER_DELIVERED: 'order_delivered',
  ORDER_CANCELLED: 'order_cancelled',
  PRODUCT_APPROVED: 'product_approved',
  PRODUCT_REJECTED: 'product_rejected',
  REVIEW_RECEIVED: 'review_received',
  LOW_STOCK: 'low_stock',
  FLASH_SALE_STARTED: 'flash_sale_started',
  FLASH_SALE_ENDING: 'flash_sale_ending',
  CART_REMINDER: 'cart_reminder',
  LOYALTY_MILESTONE: 'loyalty_milestone',
  PAYOUT_COMPLETED: 'payout_completed',
  NEW_MESSAGE: 'new_message',
  VENDOR_RESPONSE: 'vendor_response'
};

export const createNotification = async (notificationData) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        ...notificationData,
        user_id: notificationData.userId,
        read: false,
        created_at: new Date().toISOString()
      });
    if (error) throw error;
  } catch (error) {
    console.error('Error creating notification:', error.message);
    throw error;
  }
};

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

export const sendOrderNotification = async (orderId, userId, userRole, status, orderData) => {
  const notifications = {
    buyer: {
      placed: {
        title: '🎉 Order Placed Successfully',
        message: `Your order #${orderId.substring(0, 8)} has been placed. Total: ₦${orderData.total.toLocaleString()}`,
        type: NOTIFICATION_TYPES.ORDER_PLACED,
        actionUrl: `/buyer/orders/${orderId}`
      },
      shipped: {
        title: '📦 Order Shipped',
        message: `Your order #${orderId.substring(0, 8)} has been shipped and is on its way!`,
        type: NOTIFICATION_TYPES.ORDER_SHIPPED,
        actionUrl: `/buyer/orders/${orderId}`
      },
      delivered: {
        title: '✅ Order Delivered',
        message: `Your order #${orderId.substring(0, 8)} has been delivered. Enjoy your purchase!`,
        type: NOTIFICATION_TYPES.ORDER_DELIVERED,
        actionUrl: `/buyer/orders/${orderId}`
      },
      cancelled: {
        title: '❌ Order Cancelled',
        message: `Your order #${orderId.substring(0, 8)} has been cancelled.`,
        type: NOTIFICATION_TYPES.ORDER_CANCELLED,
        actionUrl: `/buyer/orders/${orderId}`
      }
    },
    vendor: {
      placed: {
        title: '🛒 New Order Received',
        message: `You received a new order #${orderId.substring(0, 8)}. Amount: ₦${orderData.vendorTotal?.toLocaleString()}`,
        type: NOTIFICATION_TYPES.ORDER_PLACED,
        actionUrl: `/vendor/orders/${orderId}`
      }
    }
  };

  const config = notifications[userRole]?.[status];
  if (!config) return;

  await createNotification({
    userId,
    ...config,
    metadata: { orderId, ...orderData }
  });
};

export const sendProductNotification = async (productId, vendorId, status, productName) => {
  const notifications = {
    approved: {
      title: '✅ Product Approved',
      message: `Your product "${productName}" has been approved and is now live!`,
      type: NOTIFICATION_TYPES.PRODUCT_APPROVED,
      actionUrl: `/product/${productId}`
    },
    rejected: {
      title: '❌ Product Rejected',
      message: `Your product "${productName}" has been rejected. Please review and resubmit.`,
      type: NOTIFICATION_TYPES.PRODUCT_REJECTED,
      actionUrl: `/vendor/products`
    }
  };

  const config = notifications[status];
  if (!config) return;

  await createNotification({
    userId: vendorId,
    ...config,
    metadata: { productId, productName }
  });
};

export const sendReviewNotification = async (productId, vendorId, reviewerName, rating, productName) => {
  await createNotification({
    userId: vendorId,
    title: '⭐ New Review Received',
    message: `${reviewerName} left a ${rating}-star review on "${productName}"`,
    type: NOTIFICATION_TYPES.REVIEW_RECEIVED,
    actionUrl: `/product/${productId}`,
    metadata: { productId, rating, reviewerName }
  });
};

export const sendLowStockAlert = async (productId, vendorId, productName, stock) => {
  await createNotification({
    userId: vendorId,
    title: '⚠️ Low Stock Alert',
    message: `"${productName}" is running low on stock (${stock} items remaining)`,
    type: NOTIFICATION_TYPES.LOW_STOCK,
    actionUrl: `/vendor/products`,
    metadata: { productId, stock },
    priority: 'high'
  });
};

export const sendFlashSaleNotification = async (userIds, saleTitle, discount, endTime) => {
  const notifications = userIds.map(userId => 
    createNotification({
      userId,
      title: '⚡ Flash Sale Alert!',
      message: `${saleTitle} - ${discount}% OFF! Hurry, ends soon!`,
      type: NOTIFICATION_TYPES.FLASH_SALE_STARTED,
      actionUrl: '/shop',
      metadata: { saleTitle, discount, endTime }
    })
  );

  await Promise.all(notifications);
};

export const sendCartReminderNotification = async (userId, itemCount, total) => {
  await createNotification({
    userId,
    title: '🛒 Items Waiting in Your Cart',
    message: `You have ${itemCount} items (₦${total.toLocaleString()}) waiting in your cart`,
    type: NOTIFICATION_TYPES.CART_REMINDER,
    actionUrl: '/cart',
    metadata: { itemCount, total }
  });
};

export const sendLoyaltyMilestone = async (userId, tier, points) => {
  await createNotification({
    userId,
    title: '🎉 Loyalty Milestone Achieved!',
    message: `Congratulations! You've reached ${tier} tier with ${points.toLocaleString()} points!`,
    type: NOTIFICATION_TYPES.LOYALTY_MILESTONE,
    actionUrl: '/buyer/loyalty',
    metadata: { tier, points }
  });
};

export const getUserNotifications = async (userId, unreadOnly = false) => {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting notifications:', error.message);
    return [];
  }
};

export const markAsRead = async (notificationId) => {
  try {
    await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId);
  } catch (error) {
    console.error('Error marking notification as read:', error.message);
  }
};

export const markAllAsRead = async (userId) => {
  try {
    await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('read', false);
  } catch (error) {
    console.error('Error marking all as read:', error.message);
  }
};

export const deleteNotification = async (notificationId) => {
  try {
    await supabase
      .from('notifications')
      .update({
        deleted: true
      })
      .eq('id', notificationId);
  } catch (error) {
    console.error('Error deleting notification:', error.message);
  }
};

export const getUnreadCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
      
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting unread count:', error.message);
    return 0;
  }
};
import { sendNotification, sendBulkNotification } from '../services/notificationService';

// Order notifications
export const triggerOrderNotification = async (order, type) => {
  const notifications = {
    placed: {
      title: 'Order Placed Successfully',
      body: `Your order #${order.id.substring(0, 8)} has been placed`,
      type: 'order',
      data: { url: `/buyer/orders/track/${order.id}` }
    },
    confirmed: {
      title: 'Order Confirmed',
      body: `Your order #${order.id.substring(0, 8)} has been confirmed`,
      type: 'order',
      data: { url: `/buyer/orders/track/${order.id}` }
    },
    shipped: {
      title: 'Order Shipped',
      body: `Your order #${order.id.substring(0, 8)} is on the way!`,
      type: 'order',
      data: { url: `/buyer/orders/track/${order.id}` }
    },
    delivered: {
      title: 'Order Delivered',
      body: `Your order #${order.id.substring(0, 8)} has been delivered`,
      type: 'order',
      data: { url: `/buyer/orders/track/${order.id}` }
    }
  };

  const notification = notifications[type];
  if (notification) {
    await sendNotification(order.userId, notification);
  }
};

// Vendor notifications
export const triggerVendorOrderNotification = async (vendorId, order) => {
  await sendNotification(vendorId, {
    title: 'New Order Received',
    body: `You have a new order #${order.id.substring(0, 8)} - ₦${order.total.toLocaleString()}`,
    type: 'order',
    data: { url: '/vendor/orders' }
  });
};

// Message notifications
export const triggerMessageNotification = async (recipientId, sender, message) => {
  await sendNotification(recipientId, {
    title: `New message from ${sender.name}`,
    body: message.substring(0, 100),
    type: 'message',
    data: { url: '/messages' }
  });
};

// Payment notifications
export const triggerPaymentNotification = async (userId, amount, status) => {
  const titles = {
    success: 'Payment Successful',
    failed: 'Payment Failed',
    refunded: 'Payment Refunded'
  };

  await sendNotification(userId, {
    title: titles[status] || 'Payment Update',
    body: `₦${amount.toLocaleString()}`,
    type: 'payment',
    data: { url: '/buyer/wallet' }
  });
};

// Review notifications
export const triggerReviewNotification = async (vendorId, productName) => {
  await sendNotification(vendorId, {
    title: 'New Review',
    body: `Someone reviewed your product: ${productName}`,
    type: 'review',
    data: { url: '/vendor/products' }
  });
};

// Promotion notifications
export const triggerPromotionNotification = async (userIds, promotion) => {
  await sendBulkNotification(userIds, {
    title: promotion.title,
    body: promotion.description,
    type: 'promotion',
    data: { url: promotion.url || '/shop' }
  });
};

// Flash sale notifications
export const triggerFlashSaleNotification = async (userIds, flashSale) => {
  await sendBulkNotification(userIds, {
    title: `Flash Sale: ${flashSale.discountPercentage}% OFF!`,
    body: flashSale.title,
    type: 'promotion',
    data: { url: `/flash-sale/${flashSale.id}` }
  });
};

// Payout notifications
export const triggerPayoutNotification = async (vendorId, amount, status) => {
  const messages = {
    approved: `Your payout of ₦${amount.toLocaleString()} has been approved`,
    rejected: `Your payout request of ₦${amount.toLocaleString()} was rejected`,
    completed: `₦${amount.toLocaleString()} has been transferred to your account`
  };

  await sendNotification(vendorId, {
    title: 'Payout Update',
    body: messages[status],
    type: 'payment',
    data: { url: '/vendor/wallet' }
  });
};
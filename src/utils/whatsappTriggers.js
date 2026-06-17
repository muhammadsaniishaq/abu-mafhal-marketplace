import { whatsappService } from '../services/whatsappService';

/**
 * Utility functions to trigger auto-messages for key workflow events
 */
export const triggerWelcomeWhatsApp = async (phone, name, userId = null) => {
  const message = `Hello ${name}, welcome to Abu Mafhal! 🎉 Your account is active. We are excited to have you on board!`;
  return whatsappService.sendDirect(phone, message, userId);
};

export const triggerOrderConfirmationWhatsApp = async (phone, orderId, total, userId = null) => {
  const shortOrderId = orderId.substring(0, 8).toUpperCase();
  const message = `Hello, your order #${shortOrderId} at Abu Mafhal has been received! 🛒 Total amount: ₦${total.toLocaleString()}. We will update you once it's processed. Thank you!`;
  return whatsappService.sendDirect(phone, message, userId);
};

export const triggerOrderStatusUpdateWhatsApp = async (phone, orderId, status, userId = null) => {
  const shortOrderId = orderId.substring(0, 8).toUpperCase();
  const displayStatus = status.toUpperCase();
  let message = `Abu Mafhal Order Update: Order #${shortOrderId} status is now ${displayStatus}.`;
  
  if (status === 'completed' || status === 'delivered') {
    message = `Your order #${shortOrderId} has been successfully delivered and completed! ✅ Thank you for shopping with Abu Mafhal!`;
  }
  
  return whatsappService.sendDirect(phone, message, userId);
};

export const triggerPaymentSuccessWhatsApp = async (phone, orderId, amount, ref, userId = null) => {
  const shortOrderId = orderId.substring(0, 8).toUpperCase();
  const message = `Payment Successful! 💳 We received your payment of ₦${amount.toLocaleString()} for order #${shortOrderId}. Reference: ${ref}. Thank you for your purchase!`;
  return whatsappService.sendDirect(phone, message, userId);
};

export const triggerAccountAlertWhatsApp = async (phone, activity, userId = null) => {
  const message = `Security Alert: Important activity happened on your Abu Mafhal account: "${activity}". If this wasn't you, please contact support immediately.`;
  return whatsappService.sendDirect(phone, message, userId);
};

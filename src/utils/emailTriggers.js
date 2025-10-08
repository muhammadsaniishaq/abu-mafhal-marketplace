import { sendEmail } from '../services/emailService';

// Trigger email on order confirmation
export const triggerOrderConfirmationEmail = async (order) => {
  await sendEmail(order.customerEmail, 'orderConfirmation', order);
};

// Trigger email on order shipped
export const triggerOrderShippedEmail = async (order) => {
  await sendEmail(order.customerEmail, 'orderShipped', order);
};

// Trigger email on order delivered
export const triggerOrderDeliveredEmail = async (order) => {
  await sendEmail(order.customerEmail, 'orderDelivered', order);
};

// Trigger welcome email
export const triggerWelcomeEmail = async (user) => {
  await sendEmail(user.email, 'welcomeEmail', user);
};

// Trigger vendor new order email
export const triggerVendorNewOrderEmail = async (order, vendorEmail, vendorName) => {
  await sendEmail(vendorEmail, 'vendorNewOrder', { ...order, vendorName });
};

// Trigger referral success email
export const triggerReferralSuccessEmail = async (referrer, referred) => {
  await sendEmail(referrer.email, 'referralSuccess', { referrer, referred });
};
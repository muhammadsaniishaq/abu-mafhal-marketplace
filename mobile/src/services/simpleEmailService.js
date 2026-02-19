// src/services/simpleEmailService.js
// Simple email service that logs emails for now
// Can be easily switched to any email API later

import { supabase } from '../lib/supabase';
import { NotificationService } from '../lib/notifications';

/**
 * Queue email for sending
 * Emails are stored in Supabase and process immediately via Resend
 */
export const queueEmail = async ({ to, subject, html, type = 'general' }) => {
  try {
    // 1. Send via Resend (Directly)
    // We prioritize sending over logging
    let sent = false;
    try {
      sent = await NotificationService.sendEmail(to, subject, html);
      console.log(`📧 Email ${sent ? 'Sent' : 'Failed'} via Resend:`, to);
    } catch (e) {
      console.error("Resend Call Failed:", e);
    }

    // 2. Store email in Supabase (Log)
    const { data: emailData, error } = await supabase
      .from('mail')
      .insert({
        to: to,
        subject: subject,
        html: html,
        type: type,
        status: sent ? 'sent' : 'failed', // Update status based on send result
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) console.log("DB Log Error (Non-fatal):", error.message);

    return { success: sent, emailId: emailData?.id };
  } catch (error) {
    console.error('❌ Error processing email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Generate email HTML templates
 */
const generateEmailHTML = (type, data) => {
  const baseStyle = `
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
      .content { padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
      .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; border-top: 1px solid #e0e0e0; }
      .feature-box { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #667eea; }
    </style>
  `;

  switch (type) {
    case 'welcome':
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyle}</head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to Abu Mafhal!</h1>
            </div>
            <div class="content">
              <h2>Hello ${data.name}! 👋</h2>
              <p>Welcome to Abu Mafhal Marketplace - Nigeria's premier online marketplace!</p>
              <div class="feature-box">
                <strong>✅ Account Details:</strong><br>
                Email: ${data.email}<br>
                Role: ${data.role || 'Buyer'}<br>
                Registration: ${new Date().toLocaleDateString()}
              </div>
              <p style="text-align: center;">
                <a href="${(typeof window !== 'undefined' && window.location) ? window.location.origin : 'https://abumafhal.com'}/login" class="button">Get Started →</a>
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Abu Mafhal Marketplace</p>
              <p>Abuja, FCT, Nigeria</p>
            </div>
          </div>
        </body>
        </html>
      `;

    case 'vendor_approved':
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyle}</head>
        <body>
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
              <h1>🎉 Vendor Application Approved!</h1>
            </div>
            <div class="content">
              <h2>Congratulations ${data.name}!</h2>
              <p>Your vendor application for <strong>${data.businessName}</strong> has been approved!</p>
              <div class="feature-box" style="border-left-color: #10b981; background: #f0fdf4;">
                <strong>🚀 You can now:</strong><br>
                • List unlimited products<br>
                • Manage your inventory<br>
                • Process orders<br>
                • Grow your business
              </div>
              <p style="text-align: center;">
                <a href="${(typeof window !== 'undefined' && window.location) ? window.location.origin : 'https://abumafhal.com'}/vendor" class="button" style="background: #10b981;">
                  Go to Vendor Dashboard →
                </a>
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Abu Mafhal Marketplace</p>
            </div>
          </div>
        </body>
        </html>
      `;

    case 'vendor_rejected':
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyle}</head>
        <body>
          <div class="container">
            <div class="header" style="background: #ef4444;">
              <h1>Vendor Application Update</h1>
            </div>
            <div class="content">
              <p>Dear ${data.name},</p>
              <p>Thank you for your interest in becoming a vendor at Abu Mafhal Marketplace.</p>
              <p>We regret to inform you that your application for <strong>${data.businessName}</strong> cannot be approved at this time.</p>
              <div class="feature-box" style="background: #fee2e2; border-left-color: #ef4444;">
                <strong>📋 Reason:</strong><br>
                ${data.reason}
              </div>
              <p>You may reapply after addressing the concerns mentioned above.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Abu Mafhal Marketplace</p>
            </div>
          </div>
        </body>
        </html>
      `;

    case 'order_confirmation':
      const itemsHtml = data.items.map(item => `
        <div style="padding: 10px; border-bottom: 1px solid #e0e0e0;">
          <strong>${item.name}</strong> - Qty: ${item.quantity}<br>
          <span style="color: #667eea;">₦${(item.price * item.quantity).toLocaleString()}</span>
        </div>
      `).join('');

      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyle}</head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Order Confirmed!</h1>
              <p>Order #${data.orderId.substring(0, 8)}</p>
            </div>
            <div class="content">
              <p>Hi ${data.name},</p>
              <p>Your order has been confirmed! 🎉</p>
              <div class="feature-box">
                <strong>📦 Order Details:</strong><br><br>
                ${itemsHtml}
                <div style="padding: 15px; background: #667eea; color: white; margin-top: 10px; border-radius: 5px; font-size: 18px;">
                  <strong>Total: ₦${data.total.toLocaleString()}</strong>
                </div>
              </div>
              <div style="background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <strong>🚚 Delivery Address:</strong><br>
                ${data.address}
              </div>
              <p style="text-align: center;">
                <a href="${(typeof window !== 'undefined' && window.location) ? window.location.origin : 'https://abumafhal.com'}/buyer/orders" class="button">
                  Track Your Order →
                </a>
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Abu Mafhal Marketplace</p>
            </div>
          </div>
        </body>
        </html>
      `;

    case 'order_status_update':
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyle}</head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📦 Order Updated</h1>
            </div>
            <div class="content">
              <h2>Hello ${data.name},</h2>
              <p>The status of your order <strong>#${data.orderId.substring(0, 8).toUpperCase()}</strong> has been updated.</p>
              
              <div class="feature-box" style="text-align: center; padding: 20px;">
                <span style="font-size: 14px; color: #888;">New Status</span><br>
                <span style="font-size: 24px; font-weight: bold; color: #667eea; text-transform: uppercase;">
                  ${data.status}
                </span>
              </div>

              <p style="text-align: center;">
                <a href="${(typeof window !== 'undefined' && window.location) ? window.location.origin : 'https://abumafhal.com'}/buyer/orders" class="button">
                  View Order Details →
                </a>
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Abu Mafhal Marketplace</p>
            </div>
          </div>
        </body>
        </html>
      `;

    case 'otp':
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyle}</head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Verification Code</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Your verification code for Abu Mafhal Marketplace is:</p>
              <div style="text-align: center; margin: 30px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #667eea; background: #f0f4ff; padding: 10px 20px; border-radius: 5px;">
                  ${data.otp}
                </span>
              </div>
              <p>This code will expire in 5 minutes.</p>
              <p style="color: #888; font-size: 12px;">
                If you didn't request this code, please ignore this email.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Abu Mafhal Marketplace</p>
            </div>
          </div>
        </body>
        </html>
      `;

    case 'driver_assignment':
      return `
        <!DOCTYPE html>
        <html>
        <head>${baseStyle}</head>
        <body>
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%);">
              <h1>🚚 New Delivery Assigned!</h1>
            </div>
            <div class="content">
              <h2>Hello ${data.driverName},</h2>
              <p>You have been assigned a new delivery. Please proceed to pickup immediately.</p>
              
              <div class="feature-box" style="border-left-color: #8B5CF6;">
                <strong>📦 Order #${data.orderId.substring(0, 8).toUpperCase()}</strong><br>
                <div style="margin-top: 10px;">
                  <strong>📍 Pickup:</strong><br>
                  ${data.pickupAddress}<br><br>
                  <strong>🏁 Dropoff:</strong><br>
                  ${data.deliveryAddress}
                </div>
              </div>

              <div style="background: #eff6ff; padding: 15px; border-radius: 5px; margin: 15px 0; border: 1px solid #bfdbfe;">
                 <strong>📞 Customer Contact:</strong><br>
                 ${data.customerPhone || 'Not Provided'}
              </div>

               <div style="text-align: center; margin-top: 20px;">
                <span style="font-size: 14px; color: #888;">Estimated Earning</span><br>
                <span style="font-size: 20px; font-weight: bold; color: #10B981;">
                  ₦${data.earnings || '0.00'}
                </span>
              </div>

              <p style="text-align: center;">
                <a href="${(typeof window !== 'undefined' && window.location) ? window.location.origin : 'https://abumafhal.com'}/driver/dashboard" class="button" style="background: #8B5CF6;">
                  View Delivery Details →
                </a>
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Abu Mafhal Marketplace</p>
            </div>
          </div>
        </body>
        </html>
      `;

    default:
      return `<p>${data.message || 'Email from Abu Mafhal Marketplace'}</p>`;
  }
};

/**
 * Email Functions
 */
export const sendWelcomeEmail = async ({ name, email, role = 'buyer' }) => {
  const html = generateEmailHTML('welcome', { name, email, role });
  return await queueEmail({
    to: email,
    subject: '🎉 Welcome to Abu Mafhal Marketplace!',
    html: html,
    type: 'welcome'
  });
};

export const sendDriverAssignmentEmail = async ({ driverName, driverEmail, orderId, pickupAddress, deliveryAddress, customerPhone, earnings }) => {
  const html = generateEmailHTML('driver_assignment', { driverName, orderId, pickupAddress, deliveryAddress, customerPhone, earnings });
  return await queueEmail({
    to: driverEmail,
    subject: `🚚 New Delivery Request - #${orderId.substring(0, 8)}`,
    html: html,
    type: 'driver_assignment'
  });
};

export const sendVendorApprovalEmail = async ({ name, email, businessName }) => {

  const html = generateEmailHTML('vendor_approved', { name, businessName });
  return await queueEmail({
    to: email,
    subject: '🎉 Vendor Application Approved!',
    html: html,
    type: 'vendor_approved'
  });
};

export const sendVendorRejectionEmail = async ({ name, email, businessName, reason }) => {
  const html = generateEmailHTML('vendor_rejected', { name, businessName, reason });
  return await queueEmail({
    to: email,
    subject: 'Vendor Application Update',
    html: html,
    type: 'vendor_rejected'
  });
};

export const sendOrderConfirmationEmail = async ({ name, email, orderId, items, total, address }) => {
  const html = generateEmailHTML('order_confirmation', { name, orderId, items, total, address });
  return await queueEmail({
    to: email,
    subject: `Order Confirmation - #${orderId.substring(0, 8)}`,
    html: html,
    type: 'order_confirmation'
  });
};

export const sendOrderStatusUpdateEmail = async ({ name, email, orderId, status }) => {
  const html = generateEmailHTML('order_status_update', { name, orderId, status });
  return await queueEmail({
    to: email,
    subject: `Order Update - #${orderId.substring(0, 8).toUpperCase()}`,
    html: html,
    type: 'order_status_update'
  });
};

export const sendVerificationEmail = async ({ email, verificationLink }) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #667eea; color: white; padding: 30px; text-align: center; }
        .button { display: inline-block; padding: 15px 40px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📧 Verify Your Email</h1>
        </div>
        <div style="padding: 30px; background: white;">
          <p>Please verify your email address by clicking the button below:</p>
          <p style="text-align: center;">
            <a href="${verificationLink}" class="button">Verify Email</a>
          </p>
          <p style="color: #888; font-size: 12px;">
            This link expires in 24 hours. If you didn't create this account, ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await queueEmail({
    to: email,
    subject: '📧 Verify Your Email Address',
    html: html,
    type: 'verification'
  });
};

export const sendPasswordResetEmail = async ({ email, resetLink }) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #667eea; color: white; padding: 30px; text-align: center; }
        .button { display: inline-block; padding: 15px 40px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Reset Your Password</h1>
        </div>
        <div style="padding: 30px; background: white;">
          <p>Click the button below to reset your password:</p>
          <p style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
          </p>
          <p style="background: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px;">
            ⚠️ This link expires in 1 hour. If you didn't request this, ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await queueEmail({
    to: email,
    subject: '🔐 Reset Your Password',
    html: html,
    type: 'password_reset'
  });
};

export const sendOtpEmail = async ({ email, otp }) => {
  const html = generateEmailHTML('otp', { otp });
  return await queueEmail({
    to: email,
    subject: `🔐 Your Verification Code: ${otp}`,
    html: html,
    type: 'otp'
  });
};

export default {
  sendWelcomeEmail,
  sendVendorApprovalEmail,
  sendVendorRejectionEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOtpEmail
};

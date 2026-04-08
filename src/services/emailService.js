import { supabase } from '../config/supabase';

// Email templates
const emailTemplates = {
  orderConfirmation: (order) => ({
    subject: `Order Confirmation - #${order.id.substring(0, 8).toUpperCase()}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; }
          .content { background: #f9fafb; padding: 30px; }
          .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .item { border-bottom: 1px solid #e5e7eb; padding: 15px 0; }
          .total { font-size: 24px; font-weight: bold; color: #f97316; margin-top: 20px; }
          .button { background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; padding: 20px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Confirmed!</h1>
            <p>Thank you for your order</p>
          </div>
          <div class="content">
            <p>Hi ${order.customerName},</p>
            <p>Your order has been confirmed and is being processed.</p>
            
            <div class="order-details">
              <h2>Order #${order.id.substring(0, 8).toUpperCase()}</h2>
              <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
              
              <h3>Items:</h3>
              ${order.items.map(item => `
                <div class="item">
                  <strong>${item.productName}</strong><br>
                  Quantity: ${item.quantity} × ₦${item.price.toLocaleString()}<br>
                  Subtotal: ₦${(item.quantity * item.price).toLocaleString()}
                </div>
              `).join('')}
              
              <div style="margin-top: 20px;">
                <p><strong>Subtotal:</strong> ₦${order.subtotal.toLocaleString()}</p>
                <p><strong>Shipping:</strong> ₦${order.shippingFee.toLocaleString()}</p>
                ${order.discount > 0 ? `<p><strong>Discount:</strong> -₦${order.discount.toLocaleString()}</p>` : ''}
                <p class="total">Total: ₦${order.total.toLocaleString()}</p>
              </div>
              
              <h3>Shipping Address:</h3>
              <p>
                ${order.shippingAddress.address}<br>
                ${order.shippingAddress.city}, ${order.shippingAddress.state}<br>
                ${order.customerPhone}
              </p>
            </div>
            
            <center>
              <a href="${window.location.origin}/buyer/orders/track/${order.id}" class="button">Track Your Order</a>
            </center>
          </div>
          <div class="footer">
            <p>Abu Mafhal Marketplace</p>
            <p>If you have any questions, contact us at support@abumafhal.com</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  orderShipped: (order) => ({
    subject: `Your Order Has Shipped - #${order.id.substring(0, 8).toUpperCase()}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; }
          .content { background: #f9fafb; padding: 30px; }
          .tracking-box { background: white; padding: 20px; border-radius: 8px; border: 2px solid #3b82f6; margin: 20px 0; }
          .tracking-number { font-size: 24px; font-weight: bold; color: #3b82f6; font-family: monospace; }
          .button { background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 Your Order is on the Way!</h1>
          </div>
          <div class="content">
            <p>Hi ${order.customerName},</p>
            <p>Great news! Your order has been shipped and is on its way to you.</p>
            
            <div class="tracking-box">
              <h3>Tracking Information</h3>
              <p><strong>Tracking Number:</strong></p>
              <p class="tracking-number">${order.trackingNumber}</p>
              <p><strong>Carrier:</strong> ${order.carrier}</p>
              ${order.estimatedDelivery ? `<p><strong>Estimated Delivery:</strong> ${new Date(order.estimatedDelivery).toLocaleDateString()}</p>` : ''}
            </div>
            
            <center>
              <a href="${window.location.origin}/buyer/orders/track/${order.id}" class="button">Track Package</a>
            </center>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  orderDelivered: (order) => ({
    subject: `Order Delivered - #${order.id.substring(0, 8).toUpperCase()}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
          .content { background: #f9fafb; padding: 30px; }
          .button { background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Order Delivered!</h1>
          </div>
          <div class="content">
            <p>Hi ${order.customerName},</p>
            <p>Your order has been successfully delivered. We hope you love your purchase!</p>
            
            <p>Order #${order.id.substring(0, 8).toUpperCase()}</p>
            
            <center>
              <a href="${window.location.origin}/buyer/reviews?orderId=${order.id}" class="button">Write a Review</a>
            </center>
            
            <p style="margin-top: 30px;">Thank you for shopping with Abu Mafhal!</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  welcomeEmail: (user) => ({
    subject: 'Welcome to Abu Mafhal Marketplace!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; }
          .content { background: #f9fafb; padding: 30px; }
          .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; }
          .button { background: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Abu Mafhal!</h1>
            <p>Your journey starts here</p>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>Welcome to Abu Mafhal Marketplace! We're excited to have you join our community.</p>
            
            <h3>What you can do:</h3>
            <div class="feature">
              <strong>🛍️ Shop Thousands of Products</strong>
              <p>Discover amazing deals from verified vendors</p>
            </div>
            <div class="feature">
              <strong>⚡ Flash Sales & Discounts</strong>
              <p>Get exclusive deals and limited-time offers</p>
            </div>
            <div class="feature">
              <strong>💰 Earn Rewards</strong>
              <p>Refer friends and earn ₦500 per referral</p>
            </div>
            <div class="feature">
              <strong>🎁 Secure Payments</strong>
              <p>Multiple payment options for your convenience</p>
            </div>
            
            <center>
              <a href="${window.location.origin}/shop" class="button">Start Shopping</a>
            </center>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  vendorNewOrder: (order, vendorName) => ({
    subject: `New Order Received - #${order.id.substring(0, 8).toUpperCase()}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; }
          .content { background: #f9fafb; padding: 30px; }
          .button { background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛎️ New Order!</h1>
          </div>
          <div class="content">
            <p>Hi ${vendorName},</p>
            <p>You have received a new order!</p>
            
            <p><strong>Order #${order.id.substring(0, 8).toUpperCase()}</strong></p>
            <p><strong>Customer:</strong> ${order.customerName}</p>
            <p><strong>Total:</strong> ₦${order.total.toLocaleString()}</p>
            <p><strong>Items:</strong> ${order.items.length}</p>
            
            <center>
              <a href="${window.location.origin}/vendor/orders" class="button">View Order</a>
            </center>
          </div>
        </div>
      </body>
      </html>
    `
  }),
  
  driverAssignment: (order, driverName) => ({
    subject: `New Delivery Assigned - #${order.id.substring(0, 8).toUpperCase()}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; }
          .content { background: #f9fafb; padding: 30px; }
          .button { background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 New Task for ${driverName}</h1>
          </div>
          <div class="content">
            <p>Hi ${driverName},</p>
            <p>You have been assigned to deliver order #${order.id.substring(0, 8).toUpperCase()}.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Customer:</strong> ${order.customerName}</p>
              <p><strong>Address:</strong> ${order.address}</p>
              <p><strong>Phone:</strong> ${order.customerPhone}</p>
            </div>
            
            <center>
              <a href="${window.location.origin}/driver/orders" class="button">View Order Details</a>
            </center>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  passwordReset: (resetLink) => ({
    subject: 'Reset Your Password - Abu Mafhal',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center; }
          .content { background: #f9fafb; padding: 30px; }
          .button { background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password</h1>
          </div>
          <div class="content">
            <p>You requested to reset your password.</p>
            <p>Click the button below to reset it. This link will expire in 1 hour.</p>
            
            <center>
              <a href="${resetLink}" class="button">Reset Password</a>
            </center>
            
            <div class="warning">
              <strong>⚠️ Security Notice</strong><br>
              If you didn't request this, please ignore this email and your password will remain unchanged.
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  referralSuccess: (referrer, referred) => ({
    subject: '🎉 You Earned a Referral Reward!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
          .content { background: #f9fafb; padding: 30px; }
          .reward { background: white; padding: 20px; border-radius: 8px; border: 2px solid #10b981; text-align: center; margin: 20px 0; }
          .amount { font-size: 36px; font-weight: bold; color: #10b981; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
          </div>
          <div class="content">
            <p>Hi ${referrer.name},</p>
            <p>${referred.name} just signed up using your referral link!</p>
            
            <div class="reward">
              <p>You've earned</p>
              <p class="amount">₦500</p>
              <p>This has been added to your wallet!</p>
            </div>
            
            <p>Keep sharing your link to earn more rewards!</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  otp: (data) => ({
    subject: `🔐 Your Verification Code: ${data.otp}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0f172a 0%, #334155 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; }
          .otp-box { text-align: center; margin: 30px 0; }
          .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0f172a; background: #f1f5f9; padding: 15px 25px; border-radius: 8px; border: 1px solid #e2e8f0; }
          .footer { text-align: center; color: #94a3b8; padding: 20px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Verification Code</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Your verification code for Abu Mafhal Marketplace is:</p>
            <div class="otp-box">
              <span class="otp-code">${data.otp}</span>
            </div>
            <p>This code will expire in 5 minutes. Please do not share this code with anyone.</p>
            <p style="color: #64748b; font-size: 13px;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Abu Mafhal Marketplace</p>
          </div>
        </div>
      </body>
      </html>
    `
  })
};

// Queue email for sending (Supabase Parity)
export const sendEmail = async (to, templateName, data) => {
  try {
    const template = emailTemplates[templateName];
    if (!template) {
      console.error('Email template not found:', templateName);
      return;
    }

    const emailData = template(data);
    
    // Add to 'mail' table in Supabase (matching mobile logic)
    const { error } = await supabase
      .from('mail')
      .insert({
        to: to,
        subject: emailData.subject,
        html: emailData.html,
        status: 'pending',
        type: templateName,
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    console.log('Email queued successfully in Supabase');
  } catch (error) {
    console.error('Error queuing email:', error.message);
  }
};

export const sendOtpEmail = async (email, otp) => {
  return await sendEmail(email, 'otp', { otp });
};

// Send multiple emails
export const sendBulkEmail = async (recipients, templateName, data) => {
  const promises = recipients.map(email => sendEmail(email, templateName, data));
  await Promise.all(promises);
};
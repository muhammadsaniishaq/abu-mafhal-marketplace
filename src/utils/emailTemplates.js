export const cartReminderTemplate = (data) => {
  return {
    subject: `Don't forget your cart! ${data.items.length} items waiting`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi ${data.userName},</h2>
        <p>You left ${data.items.length} item(s) in your cart. Complete your purchase now!</p>
        
        <div style="background: #f5f5f5; padding: 20px; margin: 20px 0;">
          ${data.items.map(item => `
            <div style="margin-bottom: 15px;">
              <strong>${item.name}</strong><br>
              Quantity: ${item.quantity}<br>
              Price: ₦${item.price.toLocaleString()}
            </div>
          `).join('')}
          
          <div style="border-top: 2px solid #333; padding-top: 10px; margin-top: 10px;">
            <strong>Total: ₦${data.total.toLocaleString()}</strong>
          </div>
        </div>
        
        <a href="${data.cartUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
          Complete Your Purchase
        </a>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated reminder. Items in your cart are subject to availability.
        </p>
      </div>
    `
  };
};
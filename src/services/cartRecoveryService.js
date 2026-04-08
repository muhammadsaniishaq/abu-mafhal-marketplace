import { supabase } from '../config/supabase';

export const saveAbandonedCart = async (userId, cartItems, userEmail, userName) => {
  try {
    if (cartItems.length === 0) return;

    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Check if abandoned cart already exists
    const { data: existing, error: findError } = await supabase
      .from('abandoned_carts')
      .select('id')
      .eq('user_id', userId)
      .eq('recovered', false)
      .maybeSingle();

    if (existing) {
      // Update existing
      await supabase
        .from('abandoned_carts')
        .update({
          items: cartItems,
          total,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      // Create new
      await supabase
        .from('abandoned_carts')
        .insert({
          user_id: userId,
          user_email: userEmail,
          user_name: userName,
          items: cartItems,
          total,
          recovered: false,
          reminders_sent: 0,
          created_at: new Date().toISOString(),
          last_reminder_sent: null
        });
    }
  } catch (error) {
    console.error('Error saving abandoned cart:', error.message);
  }
};

export const markCartAsRecovered = async (userId) => {
  try {
    await supabase
      .from('abandoned_carts')
      .update({
        recovered: true,
        recovered_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('recovered', false);
  } catch (error) {
    console.error('Error marking cart as recovered:', error.message);
  }
};

export const deleteAbandonedCart = async (userId) => {
  try {
    await supabase
      .from('abandoned_carts')
      .delete()
      .eq('user_id', userId);
  } catch (error) {
    console.error('Error deleting abandoned cart:', error.message);
  }
};

export const getAbandonedCarts = async () => {
  try {
    const { data, error } = await supabase
      .from('abandoned_carts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting abandoned carts:', error.message);
    return [];
  }
};

export const sendCartReminder = async (cartId) => {
  try {
    const { data: cart, error: fetchError } = await supabase
      .from('abandoned_carts')
      .select('*')
      .eq('id', cartId)
      .single();

    if (fetchError) throw fetchError;

    await supabase
      .from('abandoned_carts')
      .update({
        reminders_sent: (cart.reminders_sent || 0) + 1,
        last_reminder_sent: new Date().toISOString()
      })
      .eq('id', cartId);

    // Queue email notification in Supabase 'mail' table
    await supabase
      .from('mail')
      .insert({
        to: cart.user_email,
        subject: 'Don\'t forget your items!',
        html: `
          <h1>Hi ${cart.user_name || 'there'},</h1>
          <p>You left some items in your cart. Come back and finish your purchase!</p>
          <p><strong>Total: ₦${cart.total.toLocaleString()}</strong></p>
          <a href="${window.location.origin}/cart">View Your Cart</a>
        `,
        status: 'pending',
        type: 'cart-reminder',
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error sending cart reminder:', error.message);
  }
};
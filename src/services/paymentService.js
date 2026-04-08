import { supabase } from '../config/supabase';

export const createPaymentRecord = async (paymentData) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .insert({
        ...paymentData,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error creating payment record:', error.message);
    throw error;
  }
};

export const updatePaymentStatus = async (paymentId, status, reference) => {
  try {
    const { error } = await supabase
      .from('payments')
      .update({
        status,
        reference,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating payment:', error.message);
    throw error;
  }
};

export const verifyPayment = async (reference) => {
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer sk_test_your_secret_key` // Replace with your secret key
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error verifying payment:', error);
    throw error;
  }
};
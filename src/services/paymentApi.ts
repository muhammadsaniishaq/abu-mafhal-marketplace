// src/services/products.ts
/**
 * Payment Service for Abu Mafhal Marketplace
 * Supports: Paystack & Flutterwave
 */

/// <reference types="vite/client" />

import { supabase } from '../lib/supabaseClient';

const PAYMENT_CONFIG = {
  paystack: {
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
  },
  flutterwave: {
    publicKey: import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY,
  }
};

/**
 * Initialize Payment via Server API
 */
interface PaymentInitParams {
  gateway: 'paystack' | 'flutterwave' | 'nowpayments';
  email: string;
  amount: number;
  orderId: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

export const initializePayment = async ({
  gateway,
  email,
  amount,
  orderId,
  name,
  phone,
  metadata
}: PaymentInitParams) => {
  try {
    const response = await fetch('/api/payments/einitiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider: gateway,
        orderId,
        email,
        amountNGN: amount,
        name,
        phone,
        metadata
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Payment initialization failed');
    }

    return {
      success: true,
      authorizationUrl: data.authorizationUrl,
      reference: data.reference,
      accessCode: data.accessCode, // Paystack specific
      paymentLink: data.authorizationUrl // Normalize
    };

  } catch (error) {
    console.error(`${gateway} initialization error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * Initialize Paystack Payment (Wrapper)
 */
export const initializePaystackPayment = async (params: any) => {
  return initializePayment({
    gateway: 'paystack',
    email: params.email,
    amount: params.amount,
    orderId: params.orderId,
    metadata: params.metadata
  });
};

/**
 * Initialize Flutterwave Payment (Wrapper)
 */
export const initializeFlutterwavePayment = async (params: any) => {
  return initializePayment({
    gateway: 'flutterwave',
    email: params.email,
    amount: params.amount,
    orderId: params.orderId,
    name: params.name,
    phone: params.phone,
    metadata: params.metadata
  });
};

/**
 * Verify Payment via Server API
 */
export const verifyPayment = async (reference: string, gateway: 'paystack' | 'flutterwave') => {
  try {
    const response = await fetch('/api/payments/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reference,
        provider: gateway
      })
    });

    const data = await response.json();

    if (!response.ok) {
      // If server says false, it returns success:false usually
      return { success: false, error: data.error || 'Verification failed' };
    }

    return data; // Expected { success: true, data: { ... } }

  } catch (error) {
    console.error('Payment verification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Verify Paystack Payment (Wrapper)
 */
export const verifyPaystackPayment = async (reference: string) => {
  return verifyPayment(reference, 'paystack');
};

/**
 * Verify Flutterwave Payment (Wrapper)
 */
export const verifyFlutterwavePayment = async (transactionId: string) => {
  // Note: Flutterwave verification usually needs ID, but our standardized API might handle reference or ID.
  // The client code passes transactionId.
  return verifyPayment(transactionId, 'flutterwave');
};

/**
 * Update payment status in Supabase
 */
export const updatePaymentStatus = async (
  orderId: string,
  status: string,
  verificationData: any = null
) => {
  try {
    // Find payment record by orderId
    const { data: payments, error: fetchError } = await supabase
      .from('payments')
      .select('id')
      .eq('orderId', orderId);

    if (fetchError) throw fetchError;

    if (payments && payments.length > 0) {
      const paymentId = payments[0].id;

      const { error: updatePaymentError } = await supabase
        .from('payments')
        .update({
          status: status,
          verifiedAt: new Date().toISOString(),
          verificationData: verificationData
        })
        .eq('id', paymentId);

      if (updatePaymentError) throw updatePaymentError;

      // Also update order status
      const { error: updateOrderError } = await supabase
        .from('orders')
        .update({
          paymentStatus: status,
          status: status === 'success' ? 'confirmed' : 'pending',
          paidAt: status === 'success' ? new Date().toISOString() : null
        })
        .eq('id', orderId);

      if (updateOrderError) throw updateOrderError;

      return { success: true };
    }

    return { success: false, error: 'Payment record not found' };
  } catch (error) {
    console.error('Error updating payment status:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * Handle payment callback (after redirect from payment gateway)
 */
export const handlePaymentCallback = async (searchParams: URLSearchParams) => {
  const reference = searchParams.get('reference') || searchParams.get('tx_ref');
  const transactionId = searchParams.get('transaction_id');

  if (!reference && !transactionId) {
    return { success: false, error: 'Invalid payment reference' };
  }

  // Identify Gateway
  // Paystack returns reference
  // Flutterwave returns tx_ref and transaction_id

  try {
    let verification;

    if (transactionId) {
      // Flutterwave
      verification = await verifyFlutterwavePayment(transactionId);
    } else if (reference) {
      // Paystack
      verification = await verifyPaystackPayment(reference);
    } else {
      return { success: false, error: "Unknown callback parameters" };
    }

    if (verification.success) {
      // Update payment status
      // We rely on the verification result data to have the reference/orderId
      const finalRef = verification.data?.reference || reference || transactionId;

      await updatePaymentStatus(
        finalRef,
        'success',
        verification.data
      );

      return {
        success: true,
        message: 'Payment successful!',
        orderId: finalRef,
        amount: verification.data?.amount
      };
    } else {
      const finalRef = reference || transactionId;
      if (finalRef) await updatePaymentStatus(finalRef, 'failed');

      return {
        success: false,
        error: 'Payment verification failed'
      };
    }
  } catch (error) {
    console.error('Payment callback error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * Get payment methods available
 */
export const getAvailablePaymentMethods = () => {
  return [
    {
      id: 'paystack',
      name: 'Paystack',
      description: 'Pay with Card, Bank Transfer, or USSD',
      logo: '/payment-logos/paystack.png',
      available: !!PAYMENT_CONFIG.paystack.publicKey
    },
    {
      id: 'flutterwave',
      name: 'Flutterwave',
      description: 'Multiple payment options',
      logo: '/payment-logos/flutterwave.png',
      available: !!PAYMENT_CONFIG.flutterwave.publicKey
    }
  ];
};

/**
 * Process payment with selected gateway
 */
interface OrderData {
  orderId: string;
  totalAmount: number;
  items: Array<{ name: string; quantity: number; price: number }>;
}

interface CustomerData {
  email: string;
  name: string;
  phone: string;
}

export const processPayment = async ({
  gateway,
  orderData,
  customerData
}: {
  gateway: string;
  orderData: OrderData;
  customerData: CustomerData;
}) => {
  const { orderId, totalAmount, items } = orderData;
  const { email, name, phone } = customerData;

  // Use the wrapper functions which eventually call initializePayment -> /api/payments/einitiate
  try {
    let result;

    if (gateway === 'paystack') {
      result = await initializePaystackPayment({
        email,
        amount: totalAmount,
        orderId,
        metadata: {
          customerName: name,
          items: items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
          }))
        }
      });
    } else if (gateway === 'flutterwave') {
      result = await initializeFlutterwavePayment({
        email,
        amount: totalAmount,
        orderId,
        name,
        phone,
        metadata: {
          items: items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
          }))
        }
      });
    }

    if (result && result.success) {
      if (result.authorizationUrl) {
        window.location.href = result.authorizationUrl;
      } else if (result.paymentLink) {
        window.location.href = result.paymentLink;
      }
      return result;
    } else {
      throw new Error(result?.error || "Payment initialization failed");
    }

  } catch (error) {
    console.error('Process payment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * Calculate transaction fee
 */
export const calculateTransactionFee = (amount: number, gateway: string): number => {
  if (gateway === 'paystack') {
    // Paystack: 1.5% + ₦100 (capped at ₦2000)
    const fee = (amount * 0.015) + 100;
    return Math.min(fee, 2000);
  } else if (gateway === 'flutterwave') {
    // Flutterwave: 1.4% (capped at ₦2000 for local cards)
    const fee = amount * 0.014;
    return Math.min(fee, 2000);
  }
  return 0;
};

export default {
  initializePaystackPayment,
  initializeFlutterwavePayment,
  verifyPaystackPayment,
  verifyFlutterwavePayment,
  updatePaymentStatus,
  handlePaymentCallback,
  getAvailablePaymentMethods,
  processPayment,
  calculateTransactionFee
};
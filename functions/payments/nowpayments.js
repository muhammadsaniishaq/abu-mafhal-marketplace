// functions/payments/nowpayments.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

const NOWPAYMENTS_API_KEY = functions.config().nowpayments.api_key;
const NOWPAYMENTS_API_URL = 'https://api.nowpayments.io/v1';

// Get available cryptocurrencies
exports.getNowPaymentsCurrencies = functions.https.onCall(async (data, context) => {
  try {
    const response = await axios.get(`${NOWPAYMENTS_API_URL}/currencies`, {
      headers: {
        'x-api-key': NOWPAYMENTS_API_KEY
      }
    });

    return {
      success: true,
      currencies: response.data.currencies
    };
  } catch (error) {
    console.error('Error fetching currencies:', error);
    throw new functions.https.HttpsError('internal', 'Failed to fetch currencies');
  }
});

// Get estimated price
exports.getEstimatedPrice = functions.https.onCall(async (data, context) => {
  try {
    const { amount, currency_from, currency_to } = data;
    
    const response = await axios.get(
      `${NOWPAYMENTS_API_URL}/estimate`,
      {
        params: {
          amount,
          currency_from,
          currency_to
        },
        headers: {
          'x-api-key': NOWPAYMENTS_API_KEY
        }
      }
    );

    return {
      success: true,
      estimate: response.data
    };
  } catch (error) {
    console.error('Error getting estimate:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get estimate');
  }
});

// Initialize NOWPayments payment
exports.initializeNowPayments = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const response = await axios.post(
      `${NOWPAYMENTS_API_URL}/invoice`,
      {
        price_amount: data.price_amount,
        price_currency: data.price_currency,
        pay_currency: data.pay_currency,
        order_id: data.order_id,
        order_description: data.order_description,
        ipn_callback_url: data.ipn_callback_url,
        success_url: data.success_url,
        cancel_url: data.cancel_url
      },
      {
        headers: {
          'x-api-key': NOWPAYMENTS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const invoiceData = response.data;

    // Store payment record
    await admin.firestore().collection('payments').add({
      userId: context.auth.uid,
      orderId: data.order_id,
      provider: 'nowpayments',
      invoiceId: invoiceData.id,
      amount: data.price_amount,
      currency: data.price_currency,
      payCurrency: data.pay_currency,
      status: 'waiting',
      invoiceUrl: invoiceData.invoice_url,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      invoiceUrl: invoiceData.invoice_url,
      invoiceId: invoiceData.id,
      paymentAddress: invoiceData.pay_address,
      payAmount: invoiceData.pay_amount
    };
  } catch (error) {
    console.error('NOWPayments initialization error:', error);
    throw new functions.https.HttpsError('internal', 'Payment initialization failed');
  }
});

// Check payment status
exports.checkPaymentStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const { paymentId } = data;

    const response = await axios.get(
      `${NOWPAYMENTS_API_URL}/payment/${paymentId}`,
      {
        headers: {
          'x-api-key': NOWPAYMENTS_API_KEY
        }
      }
    );

    const paymentData = response.data;

    // Update payment record
    const paymentQuery = await admin.firestore()
      .collection('payments')
      .where('invoiceId', '==', paymentId)
      .limit(1)
      .get();

    if (!paymentQuery.empty) {
      const statusMap = {
        'finished': 'completed',
        'confirmed': 'completed',
        'sending': 'processing',
        'waiting': 'pending',
        'failed': 'failed',
        'expired': 'expired'
      };

      await paymentQuery.docs[0].ref.update({
        status: statusMap[paymentData.payment_status] || 'pending',
        paymentData: paymentData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // If payment completed, update order
      if (paymentData.payment_status === 'finished' || paymentData.payment_status === 'confirmed') {
        const orderId = paymentQuery.docs[0].data().orderId;
        await admin.firestore().collection('orders').doc(orderId).update({
          paymentStatus: 'paid',
          status: 'confirmed',
          paidAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update vendor wallets
        const orderDoc = await admin.firestore().collection('orders').doc(orderId).get();
        const orderData = orderDoc.data();
        
        for (const item of orderData.items) {
          await admin.firestore().collection('wallets').doc(item.vendorId).set({
            balance: admin.firestore.FieldValue.increment(item.price * item.quantity),
            pendingBalance: admin.firestore.FieldValue.increment(item.price * item.quantity),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      }
    }

    return {
      success: true,
      status: paymentData.payment_status,
      data: paymentData
    };
  } catch (error) {
    console.error('Error checking payment status:', error);
    throw new functions.https.HttpsError('internal', 'Failed to check payment status');
  }
});

// NOWPayments IPN callback
exports.nowPaymentsCallback = functions.https.onRequest(async (req, res) => {
  try {
    const payload = req.body;

    // Verify IPN signature
    const crypto = require('crypto');
    const receivedSignature = req.headers['x-nowpayments-sig'];
    const expectedSignature = crypto
      .createHmac('sha512', functions.config().nowpayments.ipn_secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (receivedSignature !== expectedSignature) {
      return res.status(400).send('Invalid signature');
    }

    // Update payment status
    const paymentQuery = await admin.firestore()
      .collection('payments')
      .where('invoiceId', '==', payload.invoice_id)
      .limit(1)
      .get();

    if (!paymentQuery.empty) {
      const statusMap = {
        'finished': 'completed',
        'confirmed': 'completed',
        'sending': 'processing',
        'waiting': 'pending',
        'failed': 'failed',
        'expired': 'expired'
      };

      await paymentQuery.docs[0].ref.update({
        status: statusMap[payload.payment_status] || 'pending',
        ipnData: payload,
        ipnReceivedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // If payment completed, update order and wallet
      if (payload.payment_status === 'finished' || payload.payment_status === 'confirmed') {
        const orderId = paymentQuery.docs[0].data().orderId;
        await admin.firestore().collection('orders').doc(orderId).update({
          paymentStatus: 'paid',
          status: 'confirmed',
          paidAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    res.status(200).send('IPN processed');
  } catch (error) {
    console.error('IPN processing error:', error);
    res.status(500).send('IPN processing failed');
  }
});
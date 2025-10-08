// functions/payments/paystack.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

const PAYSTACK_SECRET_KEY = functions.config().paystack.secret_key;

// Initialize Paystack payment
exports.initializePaystackPayment = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: data.email,
        amount: data.amount,
        currency: 'NGN',
        metadata: data.metadata,
        callback_url: `${functions.config().app.url}/payment/verify`
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Store payment record
    await admin.firestore().collection('payments').add({
      userId: context.auth.uid,
      orderId: data.orderId,
      provider: 'paystack',
      reference: response.data.data.reference,
      amount: data.amount / 100,
      currency: 'NGN',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      authorizationUrl: response.data.data.authorization_url,
      reference: response.data.data.reference
    };
  } catch (error) {
    console.error('Paystack initialization error:', error);
    throw new functions.https.HttpsError('internal', 'Payment initialization failed');
  }
});

// Verify Paystack payment
exports.verifyPaystackPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${data.reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const paymentData = response.data.data;

    if (paymentData.status === 'success') {
      // Update payment record
      const paymentQuery = await admin.firestore()
        .collection('payments')
        .where('reference', '==', data.reference)
        .limit(1)
        .get();

      if (!paymentQuery.empty) {
        const paymentDoc = paymentQuery.docs[0];
        await paymentDoc.ref.update({
          status: 'completed',
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          transactionData: paymentData
        });

        // Update order status
        const orderId = paymentDoc.data().orderId;
        await admin.firestore().collection('orders').doc(orderId).update({
          paymentStatus: 'paid',
          status: 'confirmed',
          paidAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update vendor wallet
        const orderDoc = await admin.firestore().collection('orders').doc(orderId).get();
        const orderData = orderDoc.data();
        
        for (const item of orderData.items) {
          const vendorId = item.vendorId;
          const vendorAmount = item.price * item.quantity;
          
          await admin.firestore().collection('wallets').doc(vendorId).set({
            balance: admin.firestore.FieldValue.increment(vendorAmount),
            pendingBalance: admin.firestore.FieldValue.increment(vendorAmount),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          // Add transaction record
          await admin.firestore().collection('wallets').doc(vendorId)
            .collection('transactions').add({
              type: 'sale',
              amount: vendorAmount,
              orderId: orderId,
              status: 'pending',
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        // Send notifications
        await sendPaymentNotification(context.auth.uid, orderId, 'success');
      }

      return {
        success: true,
        message: 'Payment verified successfully',
        data: paymentData
      };
    } else {
      return {
        success: false,
        message: 'Payment not successful',
        data: paymentData
      };
    }
  } catch (error) {
    console.error('Paystack verification error:', error);
    throw new functions.https.HttpsError('internal', 'Payment verification failed');
  }
});

// Paystack webhook handler
exports.paystackWebhook = functions.https.onRequest(async (req, res) => {
  const hash = require('crypto')
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(400).send('Invalid signature');
  }

  const event = req.body;

  if (event.event === 'charge.success') {
    const reference = event.data.reference;
    
    // Update payment status
    const paymentQuery = await admin.firestore()
      .collection('payments')
      .where('reference', '==', reference)
      .limit(1)
      .get();

    if (!paymentQuery.empty) {
      await paymentQuery.docs[0].ref.update({
        status: 'completed',
        webhookData: event.data,
        webhookReceivedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  res.status(200).send('Webhook processed');
});

// Helper function to send notifications
async function sendPaymentNotification(userId, orderId, status) {
  await admin.firestore().collection('notifications').add({
    userId: userId,
    type: 'payment',
    title: status === 'success' ? 'Payment Successful' : 'Payment Failed',
    message: `Your payment for order ${orderId} was ${status === 'success' ? 'successful' : 'unsuccessful'}`,
    read: false,
    orderId: orderId,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}
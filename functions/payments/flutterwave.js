// functions/payments/flutterwave.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

const FLW_SECRET_KEY = functions.config().flutterwave.secret_key;

// Initialize Flutterwave payment
exports.initializeFlutterwavePayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const response = await axios.post(
      'https://api.flutterwave.com/v3/payments',
      {
        tx_ref: data.tx_ref,
        amount: data.amount,
        currency: data.currency,
        redirect_url: data.redirect_url,
        payment_options: data.payment_options,
        customer: data.customer,
        customizations: data.customizations,
        meta: data.meta
      },
      {
        headers: {
          Authorization: `Bearer ${FLW_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Store payment record
    await admin.firestore().collection('payments').add({
      userId: context.auth.uid,
      orderId: data.meta.orderId,
      provider: 'flutterwave',
      reference: data.tx_ref,
      amount: data.amount,
      currency: data.currency,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      paymentLink: response.data.data.link,
      reference: data.tx_ref
    };
  } catch (error) {
    console.error('Flutterwave initialization error:', error);
    throw new functions.https.HttpsError('internal', 'Payment initialization failed');
  }
});

// Verify Flutterwave payment
exports.verifyFlutterwavePayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${data.transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${FLW_SECRET_KEY}`
        }
      }
    );

    const paymentData = response.data.data;

    if (paymentData.status === 'successful' && paymentData.amount >= paymentData.charged_amount) {
      // Update payment record
      const paymentQuery = await admin.firestore()
        .collection('payments')
        .where('reference', '==', paymentData.tx_ref)
        .limit(1)
        .get();

      if (!paymentQuery.empty) {
        const paymentDoc = paymentQuery.docs[0];
        await paymentDoc.ref.update({
          status: 'completed',
          transactionId: data.transactionId,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          transactionData: paymentData
        });

        // Update order
        const orderId = paymentDoc.data().orderId;
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

        // Send notification
        await admin.firestore().collection('notifications').add({
          userId: context.auth.uid,
          type: 'payment',
          title: 'Payment Successful',
          message: `Your payment for order ${orderId} was successful`,
          read: false,
          orderId: orderId,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      return {
        success: true,
        message: 'Payment verified successfully',
        data: paymentData
      };
    } else {
      return {
        success: false,
        message: 'Payment verification failed',
        data: paymentData
      };
    }
  } catch (error) {
    console.error('Flutterwave verification error:', error);
    throw new functions.https.HttpsError('internal', 'Payment verification failed');
  }
});

// Flutterwave webhook
exports.flutterwaveWebhook = functions.https.onRequest(async (req, res) => {
  const secretHash = functions.config().flutterwave.webhook_secret;
  const signature = req.headers['verif-hash'];

  if (!signature || signature !== secretHash) {
    return res.status(401).send('Invalid signature');
  }

  const payload = req.body;

  if (payload.event === 'charge.completed' && payload.data.status === 'successful') {
    const txRef = payload.data.tx_ref;
    
    const paymentQuery = await admin.firestore()
      .collection('payments')
      .where('reference', '==', txRef)
      .limit(1)
      .get();

    if (!paymentQuery.empty) {
      await paymentQuery.docs[0].ref.update({
        status: 'completed',
        webhookData: payload.data,
        webhookReceivedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  res.status(200).send('Webhook processed');
});
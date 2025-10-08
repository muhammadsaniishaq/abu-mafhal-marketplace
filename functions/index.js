// functions/index.js
const admin = require('firebase-admin');
admin.initializeApp();

// Import payment functions
const paystack = require('./payments/paystack');
const flutterwave = require('./payments/flutterwave');
const nowpayments = require('./payments/nowpayments');

// Export Paystack functions
exports.initializePaystackPayment = paystack.initializePaystackPayment;
exports.verifyPaystackPayment = paystack.verifyPaystackPayment;
exports.paystackWebhook = paystack.paystackWebhook;

// Export Flutterwave functions
exports.initializeFlutterwavePayment = flutterwave.initializeFlutterwavePayment;
exports.verifyFlutterwavePayment = flutterwave.verifyFlutterwavePayment;
exports.flutterwaveWebhook = flutterwave.flutterwaveWebhook;

// Export NOWPayments functions
exports.getNowPaymentsCurrencies = nowpayments.getNowPaymentsCurrencies;
exports.getEstimatedPrice = nowpayments.getEstimatedPrice;
exports.initializeNowPayments = nowpayments.initializeNowPayments;
exports.checkPaymentStatus = nowpayments.checkPaymentStatus;
exports.nowPaymentsCallback = nowpayments.nowPaymentsCallback;

// Refund function
exports.processRefund = require('firebase-functions').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new require('firebase-functions').https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if user is admin
  const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  if (userDoc.data().role !== 'admin') {
    throw new require('firebase-functions').https.HttpsError('permission-denied', 'Only admins can process refunds');
  }

  try {
    const { orderId, amount, reason } = data;

    // Get order and payment details
    const orderDoc = await admin.firestore().collection('orders').doc(orderId).get();
    const orderData = orderDoc.data();

    const paymentQuery = await admin.firestore()
      .collection('payments')
      .where('orderId', '==', orderId)
      .where('status', '==', 'completed')
      .limit(1)
      .get();

    if (paymentQuery.empty) {
      throw new Error('No completed payment found for this order');
    }

    const paymentDoc = paymentQuery.docs[0];
    const paymentData = paymentDoc.data();

    // Create refund record
    await admin.firestore().collection('refunds').add({
      orderId: orderId,
      paymentId: paymentDoc.id,
      amount: amount,
      reason: reason,
      status: 'pending',
      provider: paymentData.provider,
      createdBy: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update order status
    await admin.firestore().collection('orders').doc(orderId).update({
      status: 'refunded',
      refundAmount: amount,
      refundReason: reason,
      refundedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update vendor wallet (deduct amount)
    for (const item of orderData.items) {
      await admin.firestore().collection('wallets').doc(item.vendorId).update({
        balance: admin.firestore.FieldValue.increment(-item.price * item.quantity),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Send notification to buyer
    await admin.firestore().collection('notifications').add({
      userId: orderData.buyerId,
      type: 'refund',
      title: 'Refund Processed',
      message: `Your refund of ₦${amount} has been processed`,
      read: false,
      orderId: orderId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, message: 'Refund processed successfully' };
  } catch (error) {
    console.error('Refund error:', error);
    throw new require('firebase-functions').https.HttpsError('internal', error.message);
  }
});

// Send notification function
exports.sendNotification = require('firebase-functions').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new require('firebase-functions').https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const { userId, title, message, type, link } = data;

    // Get user's FCM token
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const fcmToken = userDoc.data()?.fcmToken;

    // Create notification in Firestore
    await admin.firestore().collection('notifications').add({
      userId: userId,
      type: type || 'general',
      title: title,
      message: message,
      link: link || '',
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Send push notification if token exists
    if (fcmToken) {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: title,
          body: message
        },
        data: {
          type: type || 'general',
          link: link || ''
        }
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Notification error:', error);
    throw new require('firebase-functions').https.HttpsError('internal', 'Failed to send notification');
  }
});

// Audit log trigger
exports.createAuditLog = require('firebase-functions').firestore
  .document('{collection}/{docId}')
  .onWrite(async (change, context) => {
    const collection = context.params.collection;
    
    // Only log important collections
    const trackedCollections = ['users', 'products', 'orders', 'payments', 'disputes'];
    if (!trackedCollections.includes(collection)) {
      return null;
    }

    let action = 'update';
    if (!change.before.exists) {
      action = 'create';
    } else if (!change.after.exists) {
      action = 'delete';
    }

    await admin.firestore().collection('auditLogs').add({
      collection: collection,
      documentId: context.params.docId,
      action: action,
      before: change.before.exists ? change.before.data() : null,
      after: change.after.exists ? change.after.data() : null,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return null;
  });
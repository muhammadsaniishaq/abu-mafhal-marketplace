import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

const db = admin.firestore();
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;

export const initPaystack = functions.https.onCall(async (data, ctx) => {
  // data: { amount, email, ref }
  const resp = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: data.email, amount: data.amount, reference: data.ref }),
  });
  return await resp.json();
});

export const paystackWebhook = functions.https.onRequest(async (req, res) => {
  // verify signature, find order by ref, set status paid/refunded…
  const event = req.body;
  const ref = event.data?.reference;
  if (event.event === 'charge.success' && ref) {
    const snap = await db.collection('orders').where('paymentRef', '==', ref).limit(1).get();
    if (!snap.empty) await snap.docs[0].ref.update({ paymentStatus: 'paid', updatedAt: new Date() });
  }
  res.status(200).send('ok');
});

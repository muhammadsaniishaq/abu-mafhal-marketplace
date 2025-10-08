import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';


export async function POST(req: NextRequest) {
const provider = req.headers.get('x-provider') || 'paystack';
try {
const body = await req.json();


if (provider === 'paystack') {
// Verify signature if you proxy via Functions/Hosting. Example header x-paystack-signature
const event = body.event; // charge.success etc.
if (event === 'charge.success') {
const reference = body.data.reference;
const orderSnap = await adminDb.collection('orders').where('payment.reference','==',reference).limit(1).get();
if (!orderSnap.empty) {
const docRef = orderSnap.docs[0].ref;
await docRef.update({ status: 'paid', 'payment.status': 'success', updatedAt: Date.now() });
}
}
}


if (provider === 'flutterwave') {
const status = body.data?.status;
const txRef = body.data?.tx_ref;
if (status === 'successful' && txRef) {
const orderSnap = await adminDb.collection('orders').where('payment.reference','==',txRef).limit(1).get();
if (!orderSnap.empty) await orderSnap.docs[0].ref.update({ status: 'paid', 'payment.status': 'success', updatedAt: Date.now() });
}
}


if (provider === 'nowpayments') {
const invoiceId = body.invoice_id || body.order_id;
const paymentStatus = body.payment_status;
if ((paymentStatus === 'finished' || paymentStatus === 'confirmed') && invoiceId) {
const orderSnap = await adminDb.collection('orders').where('payment.reference','==',invoiceId).limit(1).get();
if (!orderSnap.empty) await orderSnap.docs[0].ref.update({ status: 'paid', 'payment.status': 'success', updatedAt: Date.now() });
}
}


return NextResponse.json({ ok: true });
} catch (e: any) {
return NextResponse.json({ error: e.message || 'Webhook error' }, { status: 500 });
}
}
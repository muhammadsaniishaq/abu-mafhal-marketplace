import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';


export async function POST(req: NextRequest) {
const { provider, orderId, email, amountNGN } = await req.json();
if (!provider || !orderId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });


try {
if (provider === 'paystack') {
const resp = await fetch('https://api.paystack.co/transaction/initialize', {
method: 'POST',
headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
body: JSON.stringify({ email, amount: Math.round(amountNGN * 100), reference: `AM-${orderId}-${Date.now()}` }),
});
const data = await resp.json();
if (!data.status) throw new Error(data.message || 'Paystack init failed');
await adminDb.doc(`orders/${orderId}`).update({ 'payment.reference': data.data.reference });
return NextResponse.json({ authorizationUrl: data.data.authorization_url, reference: data.data.reference });
}


if (provider === 'flutterwave') {
const resp = await fetch('https://api.flutterwave.com/v3/payments', {
method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
body: JSON.stringify({ tx_ref: `AM-${orderId}-${Date.now()}`, amount: amountNGN, currency: 'NGN', redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/dashboard/buyer/orders`, customer: { email } })
});
const data = await resp.json();
if (data.status !== 'success') throw new Error(data.message || 'Flutterwave init failed');
await adminDb.doc(`orders/${orderId}`).update({ 'payment.reference': data.data.tx_ref });
return NextResponse.json({ authorizationUrl: data.data.link, reference: data.data.tx_ref });
}


if (provider === 'nowpayments') {
const resp = await fetch('https://api.nowpayments.io/v1/invoice', {
method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.NOWPAYMENTS_API_KEY! },
body: JSON.stringify({ price_amount: amountNGN, price_currency: 'ngn', order_id: orderId, success_url: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/dashboard/buyer/orders` })
});
const data = await resp.json();
if (!data || !data.invoice_url) throw new Error('NOWPayments init failed');
await adminDb.doc(`orders/${orderId}`).update({ 'payment.reference': data.id });
return NextResponse.json({ authorizationUrl: data.invoice_url, reference: data.id });
}


return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
} catch (e: any) {
return NextResponse.json({ error: e.message || 'Payment init error' }, { status: 500 });
}
}
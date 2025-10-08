'use client';
import type { PaymentProvider } from '@/types';


export async function initiatePayment(provider: PaymentProvider, orderId: string, email: string, amountNGN: number) {
const res = await fetch('/api/payments/initiate', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ provider, orderId, email, amountNGN }),
});
if (!res.ok) throw new Error('Failed to initiate payment');
return await res.json(); // { authorizationUrl, reference }
}
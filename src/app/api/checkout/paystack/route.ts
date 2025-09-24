import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/admin';

export async function POST(req: NextRequest) {
  const { orderId, amount, email, ref } = await req.json();
  // Optionally create order doc here or ensure exists
  // Call your callable function via REST or move logic here directly.
  return NextResponse.json({ ok: true, init: 'handled by Cloud Functions' });
}

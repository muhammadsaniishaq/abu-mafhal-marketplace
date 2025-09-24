import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/admin';

export async function POST(req: NextRequest) {
  const { uid, role } = await req.json(); // role: 'admin' | 'vendor' | 'buyer'
  if (!uid || !role) return NextResponse.json({ error: 'uid/role required' }, { status: 400 });

  await adminAuth.setCustomUserClaims(uid, { role });
  await adminDb.doc(`users/${uid}`).set({ role, updatedAt: new Date() }, { merge: true });

  return NextResponse.json({ ok: true });
}

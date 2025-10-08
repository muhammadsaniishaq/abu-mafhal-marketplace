import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  const { idToken } = await req.json();
  if (!idToken) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    // create session cookie (Firebase admin can createSessionCookie if you want)
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days in ms
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    const res = NextResponse.json({ status: 'ok' });
    res.cookies.set('session', sessionCookie, { httpOnly: true, secure: true, path: '/', maxAge: expiresIn / 1000 });
    return res;
  } catch (err) {
    console.error('Session login failed', err);
    return NextResponse.json({ error: 'Could not create session' }, { status: 401 });
  }
}
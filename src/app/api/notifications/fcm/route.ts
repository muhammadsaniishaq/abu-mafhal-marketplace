import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/admin';


export async function POST(req: Request){
const { title, body, target, value } = await req.json();
// TODO: look up FCM tokens in Firestore (e.g., users/{uid}/fcmTokens)
// TODO: call FCM send (via Cloud Function or server) and persist to notifications collection
await adminDb.collection('notifications').add({ title, body, target, value, createdAt: new Date() });
return NextResponse.json({ ok: true });
}
// src/services/notifications.ts
'use client';
import { messagingPromise } from '@/lib/firebaseClient';
import { getToken, onMessage } from 'firebase/messaging';
import { db } from '@/lib/firebaseClient';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';


export async function registerPush(uid: string) {
const messaging = await messagingPromise; if (!messaging) return null;
const token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
if (token) await updateDoc(doc(db,'users',uid), { fcmTokens: arrayUnion(token) });
return token;
}


export function onForegroundNotification(cb: (title: string, body: string) => void) {
messagingPromise.then((m) => { if (!m) return; onMessage(m, (p) => cb(p.notification?.title||'', p.notification?.body||'')); });
}
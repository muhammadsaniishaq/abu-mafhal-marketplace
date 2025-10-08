'use client';
import { db } from '@/lib/firebaseClient';
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';


export async function startChat(participants: string[]) {
const ref = await addDoc(collection(db,'chats'), { participants, createdAt: Date.now() });
return ref.id;
}
export async function sendMessage(chatId: string, senderId: string, text: string) {
await addDoc(collection(db,`chats/${chatId}/messages`), { senderId, text, createdAt: Date.now(), _sv: serverTimestamp() });
}
export function subscribeMessages(chatId: string, cb: (msgs: any[])=>void) {
const q = query(collection(db,`chats/${chatId}/messages`), orderBy('createdAt','asc'));
return onSnapshot(q, (snap)=>cb(snap.docs.map(d=>({ id:d.id, ...(d.data() as any) }))));
}
export function subscribeMyChats(uid: string, cb: (chats: any[])=>void) {
const q = query(collection(db,'chats'), where('participants','array-contains', uid), orderBy('createdAt','desc'));
return onSnapshot(q, (snap)=>cb(snap.docs.map(d=>({ id:d.id, ...(d.data() as any) }))));
}
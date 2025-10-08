'use client';
import { db } from '@/lib/firebaseClient';
import { addDoc, collection, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import type { Order } from '@/types';


export async function createOrder(o: Omit<Order,'id'|'status'|'createdAt'|'updatedAt'>) {
const ref = await addDoc(collection(db,'orders'), { ...o, status: 'pending', createdAt: Date.now(), updatedAt: Date.now() });
return ref.id;
}
export async function updateOrder(id: string, data: Partial<Order>) { await updateDoc(doc(db,'orders',id), { ...data, updatedAt: Date.now() }); }
export async function listBuyerOrders(buyerId: string) {
const q = query(collection(db,'orders'), where('buyerId','==',buyerId), orderBy('createdAt','desc'));
const s = await getDocs(q); return s.docs.map(d=>({ id:d.id, ...(d.data() as any) })) as Order[];
}
export async function listVendorOrders(vendorId: string) {
const q = query(collection(db,'orders'), where('vendorId','==',vendorId), orderBy('createdAt','desc'));
const s = await getDocs(q); return s.docs.map(d=>({ id:d.id, ...(d.data() as any) })) as Order[];
}
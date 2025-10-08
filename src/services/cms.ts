'use client';
import { db } from '@/lib/firebaseClient';
import { addDoc, collection, getDocs, orderBy, query, updateDoc, doc } from 'firebase/firestore';
import type { CMSBanner, CMSFaq } from '@/types';


export async function listBanners() {
const s = await getDocs(query(collection(db,'cms','site','banners'), orderBy('order')));
return s.docs.map(d=>({ id:d.id, ...(d.data() as any) })) as CMSBanner[];
}
export async function addBanner(b: Omit<CMSBanner,'id'>) { const ref = await addDoc(collection(db,'cms','site','banners'), b); return ref.id; }
export async function updateBanner(id: string, data: Partial<CMSBanner>) { await updateDoc(doc(db,'cms','site','banners',id), data); }


export async function listFaqs(lang: 'en'|'ha') {
const s = await getDocs(query(collection(db,'cms','site','faqs'), orderBy('q')));
return (s.docs.map(d=>({ id:d.id, ...(d.data() as any) })) as CMSFaq[]).filter(f=>f.lang===lang);
}
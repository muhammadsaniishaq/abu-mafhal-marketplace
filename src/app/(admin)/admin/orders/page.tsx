'use client';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';


export default function OrdersPage(){
const [rows,setRows]=useState<any[]>([]);
useEffect(()=>{(async()=>{const s=await getDocs(collection(db,'orders')); setRows(s.docs.map(d=>({id:d.id,...d.data()})));})();},[]);
async function setStatus(id:string,status:string){ await updateDoc(doc(db,'orders',id),{ paymentStatus: status }); setRows(r=>r.map(x=>x.id===id?{...x,paymentStatus:status}:x)); }
return (
<div className="space-y-4">
<h1 className="text-2xl font-bold">Orders</h1>
<ul className="space-y-3">
{rows.map(o=> (
<li key={o.id} className="border p-3 rounded">
<div className="font-semibold">{o.id}</div>
<div className="text-sm">Buyer {o.buyerId} • Vendor {o.vendorId} • ₦{o.totalAmount}</div>
<div className="flex gap-2 mt-2">
{['pending','processing','shipped','completed','cancelled'].map(s=> (
<button key={s} onClick={()=>setStatus(o.id,s)} className={`px-2 py-1 border rounded ${o.paymentStatus===s?'bg-black text-white':''}`}>{s}</button>
))}
</div>
</li>
))}
</ul>
</div>
);
}
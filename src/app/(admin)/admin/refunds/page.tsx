'use client';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
export default function Refunds(){
const [rows,setRows]=useState<any[]>([]);
useEffect(()=>{(async()=>{const s=await getDocs(collection(db,'refunds')); setRows(s.docs.map(d=>({id:d.id,...d.data()})));})();},[]);
return (
<div className="space-y-4">
<h1 className="text-2xl font-bold">Refunds / Disputes</h1>
<pre className="text-xs bg-gray-50 p-3 rounded">{JSON.stringify(rows,null,2)}</pre>
</div>
);
}
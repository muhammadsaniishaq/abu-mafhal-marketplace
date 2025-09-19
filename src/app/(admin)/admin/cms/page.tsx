'use client';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getCountFromServer } from 'firebase/firestore';


export default function Overview() {
const [counts, setCounts] = useState({ users: 0, vendors: 0, products: 0, orders: 0 });
useEffect(() => {
(async () => {
const users = await getCountFromServer(collection(db, 'users'));
const vendors = await getCountFromServer(collection(db, 'vendors'));
const products = await getCountFromServer(collection(db, 'products'));
const orders = await getCountFromServer(collection(db, 'orders'));
setCounts({ users: users.data().count, vendors: vendors.data().count, products: products.data().count, orders: orders.data().count });
})();
}, []);
return (
<div className="space-y-6">
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
{Object.entries(counts).map(([k,v]) => (
<div key={k} className="p-4 border rounded">
<div className="text-sm uppercase text-gray-500">{k}</div>
<div className="text-2xl font-bold">{v}</div>
</div>
))}
</div>
{/* TODO: charts for revenue, user growth, order volume using your Charts.tsx */}
{/* TODO: recent activities list from auditLogs */}
</div>
);
}
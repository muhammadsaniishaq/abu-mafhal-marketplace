import Link from 'next/link';
import { ReactNode } from 'react';


const nav = [
{ href: '/admin', label: 'Overview' },
{ href: '/admin/users', label: 'Users' },
{ href: '/admin/vendors', label: 'Vendors' },
{ href: '/admin/products', label: 'Products' },
{ href: '/admin/orders', label: 'Orders' },
{ href: '/admin/refunds', label: 'Refunds/Disputes' },
{ href: '/admin/coupons', label: 'Coupons & Discounts' },
{ href: '/admin/subscriptions', label: 'Subscriptions' },
{ href: '/admin/notifications', label: 'Notifications' },
{ href: '/admin/cms', label: 'Content Management' },
{ href: '/admin/audit-logs', label: 'Audit Logs' },
{ href: '/admin/reports', label: 'Reports' },
{ href: '/admin/settings', label: 'Settings' },
];


export default function AdminShell({ children }: { children: ReactNode }) {
return (
<div className="min-h-screen grid grid-cols-[260px_1fr]">
<aside className="bg-gray-900 text-white p-4 space-y-2">
<div className="font-bold text-lg mb-4">Abu Mafhal Admin</div>
<nav className="space-y-1">
{nav.map((n) => (
<Link key={n.href} href={n.href} className="block px-2 py-1 rounded hover:bg-gray-800">
{n.label}
</Link>
))}
</nav>
</aside>
<main className="p-6">{children}</main>
</div>
);
}
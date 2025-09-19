"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Overview", icon: "📊" },
  { href: "/admin/users", label: "Users", icon: "👥" },
  { href: "/admin/vendors", label: "Vendors", icon: "🏪" },
  { href: "/admin/products", label: "Products", icon: "📦" },
  { href: "/admin/orders", label: "Orders", icon: "🧾" },
  { href: "/admin/refunds", label: "Refunds/Disputes", icon: "⚖️" },
  { href: "/admin/coupons", label: "Coupons", icon: "🎟️" },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "💼" },
  { href: "/admin/notifications", label: "Notifications", icon: "🔔" },
  { href: "/admin/content", label: "Content Mgmt", icon: "📰" },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: "🛡️" },
  { href: "/admin/reports", label: "Reports", icon: "📈" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

export default function AdminSidebar() {
  const path = usePathname();
  return (
    <aside className="w-64 bg-white border-r min-h-screen sticky top-0">
      <div className="p-4 font-bold text-lg">Admin Panel</div>
      <nav className="px-2 pb-6 space-y-1">
        {items.map((it) => {
          const active = path === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-2 rounded px-3 py-2 text-sm ${
                active ? "bg-blue-600 text-white" : "hover:bg-gray-100"
              }`}
            >
              <span>{it.icon}</span>
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

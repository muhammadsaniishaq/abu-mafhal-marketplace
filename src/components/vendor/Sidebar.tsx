"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/vendor", label: "Dashboard Overview", icon: "📊" },
  { href: "/vendor/products", label: "Products", icon: "📦" },
  { href: "/vendor/orders", label: "Orders", icon: "🧾" },
  { href: "/vendor/earnings", label: "Earnings & Payouts", icon: "💰" },
  { href: "/vendor/reviews", label: "Reviews", icon: "⭐" },
  { href: "/vendor/storefront", label: "Storefront", icon: "🏬" },
  { href: "/vendor/disputes", label: "Disputes/Refunds", icon: "⚖️" },
  { href: "/vendor/marketing", label: "Marketing", icon: "📢" },
  { href: "/vendor/notifications", label: "Notifications", icon: "🔔" },
  { href: "/vendor/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-64 bg-white border-r min-h-screen sticky top-0">
      <div className="p-4 font-bold text-lg">Vendor Panel</div>
      <nav className="px-2 pb-4 space-y-1">
        {items.map((it) => {
          const active = path === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`block rounded px-3 py-2 text-sm ${
                active ? "bg-purple-600 text-white" : "hover:bg-gray-100"
              }`}
            >
              <span className="mr-2">{it.icon}</span>
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

// src/app/dashboard/admin/page.tsx
"use client";

import RoleGuard from "@/components/common/RoleGuard";
import Sidebar from "@/components/common/Sidebar";

const items = [
  { href: "/dashboard/admin", label: "Overview" },
  { href: "/dashboard/admin?tab=users", label: "Users" },
  { href: "/dashboard/admin?tab=vendors", label: "Vendors" },
  { href: "/dashboard/admin?tab=products", label: "Products" },
  { href: "/dashboard/admin?tab=orders", label: "Orders" },
  { href: "/dashboard/admin?tab=disputes", label: "Refunds/Disputes" },
  { href: "/dashboard/admin?tab=payments", label: "Payments" },
  { href: "/dashboard/admin?tab=notifications", label: "Notifications" },
  { href: "/dashboard/admin?tab=cms", label: "CMS" },
  { href: "/dashboard/admin?tab=audit", label: "Audit Logs" },
  { href: "/dashboard/admin?tab=reports", label: "Reports" },
  { href: "/dashboard/admin?tab=settings", label: "Settings" }
];

export default function AdminPage() {
  return (
    <RoleGuard allow={["admin"]}>
      <div className="flex gap-6">
        {/* Sidebar */}
        <Sidebar items={items} />

        {/* Main Section */}
        <section className="flex-1 space-y-6">
          <h1 className="text-2xl font-semibold">Admin Overview</h1>

          {/* Stats Section */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Users" value="-" />
            <Stat label="Vendors" value="-" />
            <Stat label="Orders" value="-" />
            <Stat label="Revenue" value="-" />
          </div>

          {/* Placeholder content */}
          <div className="border rounded-lg p-6 bg-white shadow">
            <p className="text-gray-600">
              Welcome, Admin 👋. Use the sidebar to manage users, vendors, 
              products, orders, and more.
            </p>
          </div>
        </section>
      </div>
    </RoleGuard>
  );
}

// Simple Stat Card
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm">
      <div className="text-sm opacity-70">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

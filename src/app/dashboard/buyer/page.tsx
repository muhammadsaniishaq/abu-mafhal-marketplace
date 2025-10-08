"use client";
import RoleGuard from "@/components/common/RoleGuard";
import Sidebar from "@/components/common/Sidebar";

const items = [
  { href: "/dashboard/buyer", label: "Overview" },
  { href: "/dashboard/buyer?tab=orders", label: "Orders" },
  { href: "/dashboard/buyer?tab=wallet", label: "Wallet" },
  { href: "/dashboard/buyer?tab=wishlist", label: "Wishlist" },
  { href: "/dashboard/buyer?tab=reviews", label: "Reviews" },
  { href: "/dashboard/buyer?tab=notifications", label: "Notifications" },
  { href: "/dashboard/buyer?tab=disputes", label: "Disputes" },
  { href: "/dashboard/buyer?tab=settings", label: "Settings" }
];

export default function Page() {
  return (
    <RoleGuard allow={["buyer"]}>
      <div className="flex gap-6">
        <Sidebar items={items} />
        <section className="flex-1 space-y-6">
          <h1 className="text-2xl font-semibold">Buyer Overview</h1>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Orders" value="-" />
            <Stat label="Wallet" value="-" />
            <Stat label="Wishlist" value="-" />
            <Stat label="Points" value="-" />
          </div>
        </section>
      </div>
    </RoleGuard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-xl p-4">
      <div className="text-sm opacity-70">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

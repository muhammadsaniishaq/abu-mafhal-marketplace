"use client";

import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

export default function RoleGuard({
  allow, children
}: { allow: Array<"admin"|"vendor"|"buyer">; children: React.ReactNode }) {
  const { loading, role } = useAuth();
  if (loading) return <div className="p-6">Loading…</div>;
  if (!role) return (
    <div className="p-6">
      <p className="mb-4">You must be signed in.</p>
      <Link href="/(auth)/login" className="underline">Go to login</Link>
    </div>
  );
  if (!allow.includes(role)) return (
    <div className="p-6">
      <p className="mb-4">You are not authorized for this area.</p>
      <Link href="/not-authorized" className="underline">More info</Link>
    </div>
  );
  return <>{children}</>;
}

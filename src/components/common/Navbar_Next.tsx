"use client";
import { useAuth } from "@/hooks/useAuth";

export default function Navbar() {
  const { profile } = useAuth();

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b bg-white shadow">
      <h1 className="font-bold text-xl">Abu Mafhal</h1>
      <nav className="flex gap-4">
        {profile?.role === "buyer" && <a href="/dashboard/buyer">Dashboard</a>}
        {profile?.role === "vendor" && <a href="/dashboard/vendor">Dashboard</a>}
        {profile?.role === "admin" && <a href="/dashboard/admin">Admin</a>}
      </nav>
      <div>
        {profile ? (
          <span className="text-blue-600">{profile.email}</span>
        ) : (
          <a href="/(auth)/login" className="text-gray-500">Sign in</a>
        )}
      </div>
    </header>
  );
}

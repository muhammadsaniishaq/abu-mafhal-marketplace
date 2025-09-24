"use client";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, roles, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace("/auth/sign-in");
      else if (!(roles.includes("admin") || roles.includes("super_admin"))) router.replace("/not-authorized");
    }
  }, [user, roles, loading, router]);

  if (loading) return <div className="p-8">Checking access…</div>;
  return <>{children}</>;
}

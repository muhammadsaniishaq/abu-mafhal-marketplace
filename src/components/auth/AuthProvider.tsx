"use client";
import { AuthProviderInner } from "@/hooks/useAuth";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthProviderInner>{children}</AuthProviderInner>;
}

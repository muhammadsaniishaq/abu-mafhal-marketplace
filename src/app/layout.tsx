import type { Metadata } from "next";
import "@/styles/globals.css";
import Navbar from "@/components/common/Navbar";
import AuthProvider from "@/components/auth/AuthProvider";

export const metadata: Metadata = {
  title: "Abu Mafhal",
  description: "Multi-vendor marketplace"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <AuthProvider>
          <Navbar />
          <main className="mx-auto max-w-7xl p-4">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}

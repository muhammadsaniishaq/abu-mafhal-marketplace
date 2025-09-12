import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Abu Mafhal Marketplace",
  description: "Buy, sell, and discover amazing products",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

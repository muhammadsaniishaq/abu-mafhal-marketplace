"use client";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function Topbar() {
  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-4">
      <div className="font-semibold">Buyer Dashboard</div>
      <button
        onClick={() => signOut(auth)}
        className="text-sm border px-3 py-1 rounded hover:bg-gray-50"
      >
        Sign out
      </button>
    </header>
  );
}

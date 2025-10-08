"use client";

import VendorChatbot from "@/components/chat/VendorChatbot";

export default function VendorDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Vendor Dashboard</h1>
      <p className="text-gray-600">Manage your products, orders, and earnings.</p>

      {/* Chatbot always available */}
      <VendorChatbot />
    </div>
  );
}

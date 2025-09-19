"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export default function CheckoutPage() {
  const [paymentMethod, setPaymentMethod] = useState("paystack");
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);

    // Example cart data (replace with real cart)
    const items = [{ productId: "1", name: "Sample Product", price: 5000, qty: 1 }];
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

    // ✅ 1. Create order in Firestore
    const orderRef = await addDoc(collection(db, "orders"), {
      buyerId: auth.currentUser?.uid || "guest",
      vendorId: "vendor-123", // replace with real vendorId
      items,
      totalAmount: total,
      paymentMethod,
      paymentStatus: "pending",
      createdAt: serverTimestamp(),
    });

    const orderId = orderRef.id;
    const userEmail = auth.currentUser?.email || "testbuyer@email.com";

    try {
      // ✅ 2. Initialize Payment

      if (paymentMethod === "paystack") {
        const res = await fetch("/api/paystack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: userEmail, amount: total, orderId }),
        });
        const data = await res.json();
        window.location.href = data.data.authorization_url;
      }

      if (paymentMethod === "flutterwave") {
        const res = await fetch("/api/flutterwave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: userEmail, amount: total, orderId }),
        });
        const data = await res.json();
        window.location.href = data.data.link;
      }

      if (paymentMethod === "stripe") {
        const res = await fetch("/api/stripe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, items }),
        });
        const data = await res.json();
        window.location.href = data.url;
      }

      if (paymentMethod === "crypto") {
        const res = await fetch("/api/nowpayments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: total, orderId }),
        });
        const data = await res.json();
        window.location.href = data.invoice_url || data.payment_url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Payment initialization failed.");
    }

    setLoading(false);
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Checkout</h1>

      <label className="block mb-2 font-semibold">Choose Payment Method:</label>
      <select
        value={paymentMethod}
        onChange={(e) => setPaymentMethod(e.target.value)}
        className="border p-2 rounded w-full mb-4"
      >
        <option value="paystack">Paystack</option>
        <option value="flutterwave">Flutterwave</option>
        <option value="stripe">Stripe</option>
        <option value="crypto">Crypto (NOWPayments)</option>
      </select>

      <button
        disabled={loading}
        onClick={handleCheckout}
        className="w-full bg-green-600 text-white px-4 py-2 rounded"
      >
        {loading ? "Processing..." : "Proceed to Pay"}
      </button>
    </div>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useEffect } from "react";

export default function SuccessPage() {
  const params = useSearchParams();
  const orderId = params.get("orderId");

  useEffect(() => {
    if (orderId) {
      const updateOrder = async () => {
        await updateDoc(doc(db, "orders", orderId), {
          paymentStatus: "paid",
        });
      };
      updateOrder();
    }
  }, [orderId]);

  return (
    <div className="p-6 text-center">
      <h1 className="text-2xl font-bold text-green-600">✅ Payment Successful!</h1>
      <p>Your order has been confirmed.</p>
    </div>
  );
}

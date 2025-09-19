import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";

export async function POST(req: Request) {
  const { items, buyerId, vendorId, totalAmount } = await req.json();

  // 1️⃣ Create Stripe session
  const res = await fetch(`${process.env.STRIPE_FUNCTION_URL}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, totalAmount }),
  });
  const session = await res.json();

  // 2️⃣ Save Firestore order with "pending"
  await addDoc(collection(db, "orders"), {
    buyerId,
    vendorId,
    items,
    totalAmount,
    paymentMethod: "stripe",
    paymentRef: session.id,
    paymentStatus: "pending",
    createdAt: new Date(),
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { "Content-Type": "application/json" },
  });
}

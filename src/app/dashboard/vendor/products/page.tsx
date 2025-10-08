"use client";

import { useEffect, useState } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

export default function VendorProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string>("");

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "products")), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const getAiAdvice = async (product: any) => {
    setAiSuggestions("Thinking...");
    const res = await fetch("/api/ai/vendor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product }),
    });
    const data = await res.json();
    setAiSuggestions(data.suggestions);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">My Products</h1>

      <div className="grid gap-4">
        {products.map((p) => (
          <div key={p.id} className="border rounded-lg p-4 bg-white shadow">
            <h2 className="font-semibold">{p.title}</h2>
            <p className="text-sm text-gray-600">{p.description}</p>
            <p className="text-sm">₦{p.price}</p>
            <button
              onClick={() => getAiAdvice(p)}
              className="mt-2 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >
              Get AI Advice
            </button>
          </div>
        ))}
      </div>

      {/* AI Suggestions */}
      {aiSuggestions && (
        <div className="mt-6 border rounded-lg p-4 bg-gray-50">
          <h2 className="font-semibold mb-2">AI Suggestions</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            {aiSuggestions.split("\n").map(
              (line, i) => line.trim() && <li key={i}>{line}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

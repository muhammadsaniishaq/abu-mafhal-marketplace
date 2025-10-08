"use client";

import { useEffect, useState } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

export default function AnalyticsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [insights, setInsights] = useState<string>("");

  // Load Firestore data
  useEffect(() => {
    const unsubOrders = onSnapshot(query(collection(db, "orders")), (snap) =>
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubPayouts = onSnapshot(query(collection(db, "payouts")), (snap) =>
      setPayouts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubDisputes = onSnapshot(query(collection(db, "disputes")), (snap) =>
      setDisputes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsubOrders();
      unsubPayouts();
      unsubDisputes();
    };
  }, []);

  // Send to Gemini for insights
  useEffect(() => {
    if (orders.length > 0) {
      fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders, payouts, disputes }),
      })
        .then((res) => res.json())
        .then((data) => setInsights(data.insights))
        .catch(() => setInsights("AI insights unavailable."));
    }
  }, [orders, payouts, disputes]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Analytics Dashboard</h1>

      {/* KPIs */}
      {/* ... keep your Stat + Charts code here ... */}

      {/* AI Insights */}
      <div className="border rounded-lg p-4 bg-gray-50 shadow-sm">
        <h2 className="font-semibold mb-2">AI Insights</h2>
        {insights ? (
          <ul className="list-disc pl-5 space-y-2 text-sm">
            {insights.split("\n").map((line, i) =>
              line.trim() ? <li key={i}>{line}</li> : null
            )}
          </ul>
        ) : (
          <p className="text-gray-500">Generating insights...</p>
        )}
      </div>
    </div>
  );
}

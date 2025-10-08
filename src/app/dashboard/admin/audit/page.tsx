"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

interface Log {
  id: string;
  action: string;
  actorId: string;
  details: any;
  timestamp: any;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    const q = query(
      collection(db, "logs"),
      orderBy("timestamp", "desc"),
      limit(50) // latest 50
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data: Log[] = snapshot.docs.map((doc) => {
        const { id, ...rest } = doc.data() as Log;
        return {
          id: doc.id,
          ...rest,
        };
      });
      setLogs(data);
    });

    return () => unsub();
  }, []);

  const filteredLogs =
    filter === "ALL" ? logs : logs.filter((log) => log.action === filter);

  // 🔽 CSV Export Function
  const exportCSV = () => {
    const headers = ["Timestamp", "Action", "Actor", "Details"];
    const rows = filteredLogs.map((log) => [
      log.timestamp?.toDate
        ? log.timestamp.toDate().toISOString()
        : "Pending...",
      log.action,
      log.actorId || "Unknown",
      JSON.stringify(log.details),
    ]);

    let csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((e) => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Audit Logs</h1>

      {/* Filters + Export */}
      <div className="flex items-center gap-4">
        <select
          className="border rounded px-3 py-2"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">All Actions</option>
          <option value="PAYOUT_REQUEST">Payout Requests</option>
          <option value="DISPUTE_UPDATE">Dispute Updates</option>
          <option value="ORDER_UPDATE">Order Updates</option>
          <option value="USER_DELETE">User Deletions</option>
        </select>

        <button
          onClick={exportCSV}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Export CSV
        </button>
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-4 py-2 text-left">Timestamp</th>
              <th className="border px-4 py-2 text-left">Action</th>
              <th className="border px-4 py-2 text-left">Actor</th>
              <th className="border px-4 py-2 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="border px-4 py-2">
                  {log.timestamp?.toDate
                    ? log.timestamp.toDate().toLocaleString()
                    : "Pending..."}
                </td>
                <td className="border px-4 py-2 font-medium">{log.action}</td>
                <td className="border px-4 py-2">{log.actorId || "Unknown"}</td>
                <td className="border px-4 py-2">
                  <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

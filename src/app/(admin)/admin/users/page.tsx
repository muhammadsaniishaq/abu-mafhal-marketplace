"use client";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, limit, orderBy, query, startAfter, where,
  DocumentData, QueryDocumentSnapshot
} from "firebase/firestore";
import DataTable from "@/components/admin/DataTable";
import { toCSV } from "@/lib/csv";

type UserRow = {
  id: string;
  email?: string;
  role?: string;
  status?: string;
  lastLoginAt?: any;
  createdAt?: any;
};

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const [qText, setQText] = useState("");
  const [role, setRole] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [pageEnd, setPageEnd] = useState<QueryDocumentSnapshot<DocumentData>|null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [loading, setLoading] = useState(false);

  const baseCols = useMemo(() => ([
    { key: "email", title: "Email" },
    { key: "id", title: "UID" },
    { key: "role", title: "Role" },
    { key: "status", title: "Status" },
    { key: "lastLoginAt", title: "Last Login", render: (r: any) =>
        r.lastLoginAt?.toDate ? r.lastLoginAt.toDate().toLocaleString() : (r.lastLoginAt || "-") },
    { key: "createdAt", title: "Signup", render: (r: any) =>
        r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : (r.createdAt || "-") },
  ]), []);

  async function runQuery(reset=false) {
    setLoading(true);
    try {
      const col = collection(db, "users");
      const clauses: any[] = [];

      if (role !== "all") clauses.push(where("role", "==", role));
      if (status !== "all") clauses.push(where("status", "==", status));
      // For simple search by email prefix; for full-text you’d index to Algolia/Meilisearch.
      let q = query(col, ...clauses, orderBy("createdAt", "desc"), limit(PAGE_SIZE));
      if (!reset && pageEnd) q = query(col, ...clauses, orderBy("createdAt", "desc"), startAfter(pageEnd), limit(PAGE_SIZE));
      const snap = await getDocs(q);

      if (reset) {
        setRows(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserRow)));
      } else {
        setRows(prev => [...prev, ...snap.docs.map(d => ({ id: d.id, ...d.data() } as UserRow))]);
      }

      setPageEnd(snap.docs[snap.docs.length - 1] || null);
      setExhausted(snap.empty || snap.docs.length < PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // fresh query when filters change
    setPageEnd(null);
    setExhausted(false);
    runQuery(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, status]);

  const filtered = useMemo(() => {
    const t = qText.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(r =>
      (r.email || "").toLowerCase().includes(t) ||
      (r.id || "").toLowerCase().includes(t)
    );
  }, [rows, qText]);

  function exportCSV() {
    const csv = toCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `users_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function setUserStatus(uid: string, newStatus: "active"|"suspended"|"banned") {
    await fetch("/api/admin/users/setStatus", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ uid, status: newStatus }),
    });
    setRows(r => r.map(x => x.id === uid ? { ...x, status: newStatus } : x));
  }

  async function setUserRole(uid: string, newRole: string) {
    await fetch("/api/admin/users/setRole", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ uid, role: newRole }),
    });
    setRows(r => r.map(x => x.id === uid ? { ...x, role: newRole } : x));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Users</h1>

      <div className="flex flex-wrap items-center gap-2">
        <input
          placeholder="Search email/UID..."
          value={qText}
          onChange={e=>setQText(e.target.value)}
          className="border rounded px-3 py-2 w-64"
        />
        <select className="border rounded px-3 py-2" value={role} onChange={e=>setRole(e.target.value)}>
          <option value="all">All roles</option>
          <option value="superadmin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="vendor">Vendor</option>
          <option value="moderator">Moderator</option>
          <option value="customer">Customer</option>
          <option value="guest">Guest</option>
        </select>
        <select className="border rounded px-3 py-2" value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
        <button onClick={exportCSV} className="ml-auto bg-gray-900 text-white px-3 py-2 rounded">
          Export CSV
        </button>
      </div>

      <DataTable<UserRow>
        cols={[
          { key: "email", title: "Email" },
          { key: "id", title: "UID" },
          { key: "role", title: "Role" },
          { key: "status", title: "Status" },
          { key: "createdAt", title: "Signup", render: (r:any) =>
              r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : "-" },
        ]}
        rows={filtered}
        right={(r) => (
          <div className="flex gap-1">
            <select
              className="border rounded px-2 py-1 text-xs"
              value={r.role || "customer"}
              onChange={(e)=>setUserRole(r.id, e.target.value)}
            >
              <option>superadmin</option>
              <option>admin</option>
              <option>vendor</option>
              <option>moderator</option>
              <option>customer</option>
              <option>guest</option>
            </select>
            {r.status !== "suspended" ? (
              <button onClick={()=>setUserStatus(r.id,"suspended")} className="border px-2 py-1 rounded text-xs">Suspend</button>
            ) : (
              <button onClick={()=>setUserStatus(r.id,"active")} className="border px-2 py-1 rounded text-xs">Unsuspend</button>
            )}
          </div>
        )}
      />

      <div className="flex justify-center">
        {!exhausted ? (
          <button
            disabled={loading}
            onClick={()=>runQuery(false)}
            className="border px-4 py-2 rounded bg-white hover:bg-gray-50"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        ) : (
          <div className="text-sm text-gray-500">No more users</div>
        )}
      </div>
    </div>
  );
}

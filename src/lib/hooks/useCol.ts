"use client";
import { useEffect, useState } from "react";
import { onSnapshot, collection, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";

export function useCol<T = any>(opts: {
  path: string[];
  where?: [string, FirebaseFirestore.WhereFilterOp, any][];
  orderBy?: [string, "asc" | "desc"][];
  limit?: number;
}) {
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => {
    const col = collection(db, ...opts.path);
    let q: any = query(col);
    if (opts.where) for (const [f, op, v] of opts.where) q = query(q, where(f, op as any, v));
    if (opts.orderBy) for (const [f, dir] of opts.orderBy) q = query(q, orderBy(f, dir));
    if (opts.limit) q = query(q, limit(opts.limit));
    return onSnapshot(q, (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as any))));
  }, [JSON.stringify(opts)]);
  return rows;
}

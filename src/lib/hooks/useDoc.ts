"use client";
import { useEffect, useState } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "../firebase";

export function useDoc<T = any>(path: string[]) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    const ref = doc(db, ...path);
    return onSnapshot(ref, (snap) => setData((snap.data() as T) || null));
  }, [path.join("/")]);
  return data;
}

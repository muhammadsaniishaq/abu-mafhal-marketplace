"use client";
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { VendorProfile } from "../types";

export function useAuthVendor() {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setVendor(null);
        setLoading(false);
        return;
      }
      const ref = doc(db, "vendors", u.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const profile: VendorProfile = {
          uid: u.uid,
          email: u.email || "",
          businessName: u.displayName || "",
          phone: u.phoneNumber || "",
          logoUrl: u.photoURL || "",
          status: "pending",
          createdAt: serverTimestamp(),
        };
        await setDoc(ref, profile, { merge: true });
        setVendor(profile);
      } else {
        setVendor({ uid: u.uid, ...snap.data() } as VendorProfile);
      }
      setLoading(false);
    });
  }, []);

  return { vendor, loading };
}

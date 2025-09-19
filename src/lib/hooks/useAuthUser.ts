"use client";
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { BuyerProfile } from "../types";

export function useAuthUser() {
  const [user, setUser] = useState<BuyerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setLoading(false);
        return;
      }
      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        // create minimal profile
        const profile: BuyerProfile = {
          uid: u.uid,
          email: u.email || undefined,
          name: u.displayName || "",
          phone: u.phoneNumber || "",
          avatarUrl: u.photoURL || "",
          loyaltyPoints: 0,
          currency: "NGN",
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        };
        await setDoc(ref, profile, { merge: true });
        setUser(profile);
      } else {
        const data = snap.data() as BuyerProfile;
        // update last login silently
        await setDoc(ref, { lastLoginAt: serverTimestamp() }, { merge: true });
        setUser({ ...data, uid: u.uid });
      }
      setLoading(false);
    });
  }, []);

  return { user, loading };
}

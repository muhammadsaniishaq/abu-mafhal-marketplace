"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function VendorDashboard() {
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const checkRole = async () => {
      if (!auth.currentUser) return;
      const docRef = doc(db, "users", auth.currentUser.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setUserRole(snap.data().role);
      }
    };
    checkRole();
  }, []);

  if (userRole !== "vendor") {
    return <p className="text-center mt-10">Access Denied. Vendors only.</p>;
  }

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Vendor Dashboard</h1>
      <p>Here you can manage your products and view sales.</p>
    </div>
  );
}

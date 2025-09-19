"use client";
import KPICards from "@/components/admin/KPICards";
import Section from "@/components/admin/Section";
import { collection, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";

export default function AdminOverview() {
  const [kpi, setKpi] = useState({ users: 0, vendors: 0, products: 0, orders: 0 });

  useEffect(() => {
    (async () => {
      const [u,v,p,o] = await Promise.all([
        getCountFromServer(collection(db,"users")),
        getCountFromServer(collection(db,"vendors")),
        getCountFromServer(collection(db,"products")),
        getCountFromServer(collection(db,"orders")),
      ]);
      setKpi({ users: u.data().count, vendors: v.data().count, products: p.data().count, orders: o.data().count });
    })();
  }, []);

  return (
    <>
      <h1 className="text-xl font-bold">Admin Overview</h1>
      <KPICards items={[
        { label: "Users", value: String(kpi.users) },
        { label: "Vendors", value: String(kpi.vendors) },
        { label: "Products", value: String(kpi.products) },
        { label: "Orders", value: String(kpi.orders) },
      ]}/>
      <Section title="Recent Activity">
        <div className="text-sm text-gray-500">Hook this to auditLogs & orders for live feed.</div>
      </Section>
    </>
  );
}

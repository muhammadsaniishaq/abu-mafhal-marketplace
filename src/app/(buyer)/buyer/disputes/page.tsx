"use client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useCol } from "@/lib/hooks/useCol";
import Section from "@/components/buyer/Section";

export default function DisputesPage() {
  const { user } = useAuthUser();
  const rows = useCol<any>({
    path: ["refunds"],
    where: [["buyerId", "==", user?.uid || ""]],
    orderBy: [["createdAt", "desc"]],
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Disputes & Refunds</h1>
      <Section title="My Requests" right={<button className="border px-3 py-1 rounded">New Dispute</button>}>
        {rows.length === 0 ? <div className="text-sm text-gray-600">No disputes.</div> : (
          <div className="space-y-3">
            {rows.map((d: any) => (
              <div key={d.id} className="border rounded p-3 bg-white">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Order #{d.orderId?.slice(-6) || d.orderId}</div>
                  <div className="text-xs px-2 py-1 rounded bg-gray-100">{d.status}</div>
                </div>
                <div className="text-sm mt-1">{d.reason}</div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

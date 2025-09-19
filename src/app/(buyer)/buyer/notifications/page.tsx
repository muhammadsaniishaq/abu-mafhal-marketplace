"use client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useCol } from "@/lib/hooks/useCol";
import Section from "@/components/buyer/Section";

export default function NotificationsPage() {
  const { user } = useAuthUser();
  const notifs = useCol<any>({
    path: ["notifications"],
    where: [["to", "==", user?.uid || ""]],
    orderBy: [["createdAt", "desc"]],
    limit: 50,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Notifications</h1>
      <Section title="Recent">
        {notifs.length === 0 ? <div className="text-sm text-gray-600">No notifications.</div> : (
          <div className="space-y-3">
            {notifs.map((n: any) => (
              <div key={n.id} className="border rounded p-3 bg-white">
                <div className="font-medium">{n.title}</div>
                <div className="text-sm text-gray-700">{n.body}</div>
                <div className="text-xs text-gray-500 mt-1">{new Date(n.createdAt?.seconds*1000||Date.now()).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

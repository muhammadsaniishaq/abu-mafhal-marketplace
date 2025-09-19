"use client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useCol } from "@/lib/hooks/useCol";
import Section from "@/components/buyer/Section";

export default function OrdersPage() {
  const { user } = useAuthUser();
  const orders = useCol<any>({
    path: ["orders"],
    where: [["buyerId", "==", user?.uid || ""]],
    orderBy: [["createdAt", "desc"]],
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">My Orders</h1>
      <Section title="Order History">
        {orders.length === 0 ? <div className="text-sm text-gray-600">No orders yet.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Order</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Payment</th>
                  <th className="py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o: any) => (
                  <tr key={o.id} className="border-b">
                    <td className="py-2">#{o.id?.slice(-6)}</td>
                    <td className="py-2">{o.status}</td>
                    <td className="py-2">{o.paymentStatus}</td>
                    <td className="py-2 font-semibold">{new Intl.NumberFormat().format(o.totalAmount)} {o.currency || "NGN"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

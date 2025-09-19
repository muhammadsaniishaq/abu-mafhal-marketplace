"use client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useDoc } from "@/lib/hooks/useDoc";
import { useCol } from "@/lib/hooks/useCol";
import Section from "@/components/buyer/Section";

export default function WalletPage() {
  const { user } = useAuthUser();
  const wallet = useDoc<any>(["wallets", user?.uid || "_"]);
  const txns = useCol<any>({
    path: ["wallets", user?.uid || "_", "transactions"],
    orderBy: [["createdAt", "desc"]],
    limit: 20
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Wallet & Payments</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-gray-500">Balance</div>
          <div className="text-3xl font-bold mt-1">
            {new Intl.NumberFormat().format(wallet?.balance ?? 0)} {wallet?.currency ?? "NGN"}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-gray-500">Currency</div>
          <div className="text-xl font-bold mt-1">{wallet?.currency ?? "NGN"}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-gray-500">Actions</div>
          <div className="mt-2 flex gap-2">
            <button className="border px-3 py-1 rounded">Top Up</button>
            <button className="border px-3 py-1 rounded">Withdraw</button>
          </div>
        </div>
      </div>

      <Section title="Transaction History">
        {txns.length === 0 ? <div className="text-sm text-gray-600">No transactions.</div> : (
          <div className="divide-y text-sm">
            {txns.map((t: any) => (
              <div key={t.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium capitalize">{t.type}</div>
                  <div className="text-xs text-gray-500">{t.ref || t.note}</div>
                </div>
                <div className={`font-semibold ${t.type === "debit" ? "text-red-600" : "text-green-700"}`}>
                  {t.type === "debit" ? "-" : "+"}{new Intl.NumberFormat().format(t.amount)} {t.currency}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

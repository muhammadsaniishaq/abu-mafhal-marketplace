"use client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useCol } from "@/lib/hooks/useCol";
import Section from "@/components/buyer/Section";

export default function WishlistPage() {
  const { user } = useAuthUser();
  const wishlist = useCol<any>({ path: ["wishlists"], where: [["buyerId", "==", user?.uid || ""]] });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Wishlist</h1>
      <Section title="Saved Items">
        {wishlist.length === 0 ? <div className="text-sm text-gray-600">No items.</div> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {wishlist.map((w: any) => (
              <li key={w.id} className="border rounded p-3 bg-white">
                <div className="font-medium">{w.productTitle || w.productId}</div>
                <div className="text-xs text-gray-500">Saved on {new Date(w.addedAt?.seconds*1000||Date.now()).toLocaleDateString()}</div>
                <div className="mt-2 flex gap-2">
                  <button className="border px-3 py-1 rounded">Move to Cart</button>
                  <button className="border px-3 py-1 rounded">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

"use client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useCol } from "@/lib/hooks/useCol";
import Section from "@/components/buyer/Section";

export default function ReviewsPage() {
  const { user } = useAuthUser();
  const reviews = useCol<any>({ path: ["reviews"], where: [["buyerId", "==", user?.uid || ""]] });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">My Reviews</h1>
      <Section title={`You’ve reviewed ${reviews.length} product${reviews.length===1?"":"s"}`}>
        {reviews.length === 0 ? <div className="text-sm text-gray-600">No reviews yet.</div> : (
          <div className="space-y-3">
            {reviews.map((r: any) => (
              <div key={r.id} className="border rounded p-3 bg-white">
                <div className="font-medium">Product: {r.productTitle || r.productId}</div>
                <div className="text-yellow-500">{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</div>
                <div className="text-sm mt-1">{r.comment}</div>
                <div className="mt-2 text-xs text-gray-500">{new Date(r.createdAt?.seconds*1000||Date.now()).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

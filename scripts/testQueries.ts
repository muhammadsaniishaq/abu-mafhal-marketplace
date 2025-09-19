import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

async function testQueries() {
  try {
    console.log("🔍 Testing Firestore collections...");

    const collections = [
      "users",
      "vendors",
      "products",
      "orders",
      "refunds",
      "notifications",
      "auditLogs",
      "media",
      "settings",
      "coupons",
      "subscriptions",
      "reports",
    ];

    for (const col of collections) {
      console.log(`\n📂 Fetching from '${col}'...`);
      const snap = await getDocs(collection(db, col));
      if (snap.empty) {
        console.log(`❌ No documents found in '${col}'`);
      } else {
        snap.forEach((doc) => {
          console.log(`✅ ${col} -> ${doc.id}:`, doc.data());
        });
      }
    }

    console.log("\n🎉 All queries finished!");
  } catch (err) {
    console.error("❌ Error testing queries:", err);
  }
}

testQueries();

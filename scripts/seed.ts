import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// ✅ Your Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "abu-mafhal-marketplace.firebaseapp.com",
  projectId: "abu-mafhal-marketplace",
  storageBucket: "abu-mafhal-marketplace.appspot.com",
  messagingSenderId: "213061869529",
  appId: "1:213061869529:web:55d9498b508e10df4743c8",
};

// ✅ Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  try {
    // === USERS COLLECTION ===
    await setDoc(doc(db, "users", "test-user-1"), {
      email: "user1@example.com",
      role: "customer",
      status: "active",
      createdAt: new Date().toISOString(),
    });

    // === VENDORS COLLECTION ===
    await setDoc(doc(db, "vendors", "vendor-1"), {
      approved: true,
      tier: "gold",
      stats: { sales: 0, products: 0, ratings: 0 },
    });

    // === PRODUCTS COLLECTION ===
    await setDoc(doc(db, "products", "product-1"), {
      vendorId: "vendor-1",
      title: "Sample Product",
      description: "This is a sample product",
      price: 100,
      stock: 50,
      category: "general",
      images: [],
      createdAt: new Date().toISOString(),
    });

    // === ORDERS COLLECTION ===
    await setDoc(doc(db, "orders", "order-1"), {
      buyerId: "test-user-1",
      vendorId: "vendor-1",
      items: [{ productId: "product-1", qty: 2 }],
      totalAmount: 200,
      paymentMethod: "paystack",
      paymentStatus: "pending",
      createdAt: new Date().toISOString(),
    });

    // === SETTINGS SINGLETON ===
    await setDoc(doc(db, "settings", "global"), {
      branding: { name: "Abu Mafhal Marketplace", theme: "light" },
      languages: ["en", "fr"],
      maintenance: false,
    });

    console.log("✅ Seeding complete!");
  } catch (error) {
    console.error("❌ Error seeding:", error);
  }
}

seed();

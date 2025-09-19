import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedFirestore() {
  await setDoc(doc(db, "users", "user-1"), {
    email: "buyer@example.com",
    role: "customer",
    status: "active",
    lastLoginAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    walletBalance: 0,
  });

  // ... (vendors, products, orders, refunds, etc from earlier code)

  console.log("✅ Firestore seeding complete!");
}

seedFirestore();

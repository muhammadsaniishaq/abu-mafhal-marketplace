// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBmNnhtuEp4ULe8ZKynSJIxkuaDYMnb9mg",
  authDomain: "abu-mafhal-marketplace.firebaseapp.com",
  databaseURL: "https://abu-mafhal-marketplace-default-rtdb.firebaseio.com",
  projectId: "abu-mafhal-marketplace",
  storageBucket: "abu-mafhal-marketplace.appspot.com", // ✅ fixed here
  messagingSenderId: "213061869529",
  appId: "1:213061869529:web:55d9498b508e10df4743c8",
  measurementId: "G-YJFGQTFR8B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Export Firebase services for use across the app
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;

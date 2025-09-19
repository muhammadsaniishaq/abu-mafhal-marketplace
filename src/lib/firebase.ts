// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBmNnhtuEp4ULe8ZKynSJIxkuaDYMnb9mg",
  authDomain: "abu-mafhal-marketplace.firebaseapp.com",
  projectId: "abu-mafhal-marketplace",
  storageBucket: "abu-mafhal-marketplace.firebasestorage.app",
  messagingSenderId: "213061869529",
  appId: "1:213061869529:web:55d9498b508e10df4743c8",
  measurementId: "G-YJFGQTFR8B",
};


// Initialize Firebase safely (avoid re-initializing in Next.js)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;

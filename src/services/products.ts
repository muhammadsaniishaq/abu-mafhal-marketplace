import { db } from "@/lib/firebaseClient";
import { addDoc, collection, doc, getDoc, getDocs, query, where, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import type { Product } from "@/types";

export async function createProduct(p: Omit<Product,"id"|"createdAt">) {
  const ref = await addDoc(collection(db,"products"), { ...p, createdAt: Date.now() });
  return ref.id;
}

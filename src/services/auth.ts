import { auth, db } from "@/lib/firebaseClient";
import {
  GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, onAuthStateChanged, updateProfile
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { UserProfile, UserRole } from "@/types";

export async function signUpWithEmail(email: string, password: string, role: UserRole) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const profile: UserProfile = { uid: cred.user.uid, email, role, lastLoginAt: Date.now() };
  await setDoc(doc(db, "users", cred.user.uid), profile);
  return cred.user;
}

export async function emailSignIn(email: string, password: string) {
  const res = await signInWithEmailAndPassword(auth, email, password);
  return res.user;
}

export async function googleSignIn() {
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  // ensure a profile doc exists
  const ref = doc(db, "users", res.user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { uid: res.user.uid, email: res.user.email, role: "buyer", lastLoginAt: Date.now() });
  }
  return res.user;
}

export async function updateDisplayName(name: string) {
  if (!auth.currentUser) return;
  await updateProfile(auth.currentUser, { displayName: name });
  await setDoc(doc(db, "users", auth.currentUser.uid), { name }, { merge: true });
}

export async function logout() { await signOut(auth); }

import type { User } from "firebase/auth";

export function watchAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

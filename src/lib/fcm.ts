import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
export async function saveFcmToken(uid: string, token: string) {
  await setDoc(doc(db, `users/${uid}/meta/fcm`), { token, updatedAt: Date.now() }, { merge: true });
}

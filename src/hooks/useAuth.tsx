'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export function useAuth() {
  const [user, setUser] = useState<User|null>(null);
  const [role, setRole] = useState<'superadmin'|'admin'|'vendor'|'buyer'|'guest'>('guest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid));
        const r = (snap.data()?.role ?? 'buyer') as typeof role;
        setRole(r);
        document.cookie = `role=${r}; path=/;`;
      } else {
        setRole('guest');
        document.cookie = `role=guest; path=/;`;
      }
      setLoading(false);
    });
  }, []);

  return { user, role, loading };
}

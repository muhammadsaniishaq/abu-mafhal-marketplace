"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

const AuthContext = createContext<any>(null);

export function useAuth() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setProfile({
          uid: user.uid,
          email: user.email,
          name: user.displayName,
          role: 'buyer' // Default role for firebase auth if not found
        });
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { profile, loading };
}

export function AuthProviderInner({ children }: { children: React.ReactNode }) {
  const authValue = useAuth();
  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);

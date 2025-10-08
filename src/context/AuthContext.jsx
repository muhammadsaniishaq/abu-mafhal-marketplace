// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Get user role and data
  const getUserData = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data();
      }
      return null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  };

  // Register new user
  const register = async (email, password, userData) => {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(user, {
        displayName: userData.name
      });

      const userDoc = {
        uid: user.uid,
        email: user.email,
        name: userData.name,
        phone: userData.phone || '',
        role: userData.role || 'buyer',
        approved: userData.role === 'vendor' ? false : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        avatar: '',
        address: {},
        loyaltyPoints: 0,
        status: 'active'
      };

      if (userData.role === 'vendor') {
        userDoc.businessName = userData.businessName || '';
        userDoc.businessDescription = '';
        userDoc.businessAddress = '';
        userDoc.businessPhone = '';
        userDoc.bankDetails = {};
        userDoc.totalSales = 0;
        userDoc.totalProducts = 0;
        userDoc.rating = 0;
        userDoc.reviewCount = 0;
      }

      await setDoc(doc(db, 'users', user.uid), userDoc);

      return user;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  // Login
  const login = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const userData = await getUserData(result.user.uid);
      return { ...result.user, ...userData };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Google Sign In
  const loginWithGoogle = async (role = 'buyer') => {
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);

      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          name: user.displayName,
          phone: '',
          role: role,
          approved: role === 'vendor' ? false : true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          avatar: user.photoURL || '',
          address: {},
          loyaltyPoints: 0,
          status: 'active'
        });
      }

      return user;
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  // Reset password
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userData = await getUserData(user.uid);
        setCurrentUser({ ...user, ...userData });
        setUserRole(userData?.role || null);
      } else {
        setCurrentUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    register,
    login,
    loginWithGoogle,
    logout,
    resetPassword,
    getUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
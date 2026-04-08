// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import LoadingScreen from '../components/common/LoadingScreen';
import { supabase } from '../config/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Get user data from Supabase profiles table
  const getUserData = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user data:', error.message);
      return null;
    }
  };

  // Register new user (Supabase)
  const register = async (email, password, userData) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: userData.name,
            role: userData.role || 'buyer'
          }
        }
      });

      if (error) throw error;

      // Upsert into profiles table
      const profileData = {
        id: data.user.id,
        email: email,
        full_name: userData.name,
        role: userData.role || 'buyer',
        created_at: new Date().toISOString()
      };

      const { error: profileError } = await supabase.from('profiles').upsert([profileData]);
      if (profileError) throw profileError;

      return data.user;
    } catch (error) {
      console.error('Registration error:', error.message);
      throw error;
    }
  };

  // Login (Supabase)
  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      const userData = await getUserData(data.user.id);
      return { ...data.user, ...userData };
    } catch (error) {
      console.error('Login error:', error.message);
      throw error;
    }
  };

  // Google Sign In (Supabase)
  const loginWithGoogle = async (role = 'buyer') => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Google login error:', error.message);
      throw error;
    }
  };

  // Logout (Supabase)
  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setUserRole(null);
    } catch (error) {
      console.error('Logout error:', error.message);
      throw error;
    }
  };

  // Reset password (Supabase)
  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
    } catch (error) {
      console.error('Password reset error:', error.message);
      throw error;
    }
  };

  useEffect(() => {
    // Check initial session
    const checkInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const userData = await getUserData(session.user.id);
        setCurrentUser({ ...session.user, ...userData });
        setUserRole(userData?.role || null);
      }
      setLoading(false);
    };

    checkInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const userData = await getUserData(session.user.id);
        setCurrentUser({ ...session.user, ...userData });
        setUserRole(userData?.role || null);
      } else {
        setCurrentUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Update user profile (Supabase)
  const updateProfile = async (userId, updates) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;
      
      const userData = await getUserData(userId);
      if (userData) {
        setCurrentUser(prev => ({ ...prev, ...userData }));
      }
      return true;
    } catch (error) {
      console.error('Update profile error:', error.message);
      throw error;
    }
  };

  const value = {
    currentUser,
    userRole,
    register,
    login,
    loginWithGoogle,
    logout,
    resetPassword,
    getUserData,
    updateProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <LoadingScreen /> : children}
    </AuthContext.Provider>
  );
};
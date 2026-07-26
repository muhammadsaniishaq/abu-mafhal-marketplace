// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import LoadingScreen from '../components/common/LoadingScreen';
import { supabase } from '../config/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const cached = localStorage.getItem('auth_user');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [userRole, setUserRole] = useState(() => {
    try {
      return localStorage.getItem('auth_role');
    } catch { return null; }
  });
  const [loading, setLoading] = useState(!currentUser); // Only show loader if no cache exists

  // Get user data from Supabase profiles table
  const getUserData = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error getting user data:', error.message);
      }
      return data || null;
    } catch (error) {
      console.error('Error getting user data:', error.message);
      return null;
    }
  };

  // Known admin email addresses
  const KNOWN_ADMIN_EMAILS = [
    'sale.abumafhal@gmail.com',
    'admin@abumafhal.com',
    'abumafhal@gmail.com'
  ];

  const isAdminEmail = (email) => {
    if (!email) return false;
    const lower = email.toLowerCase().trim();
    return KNOWN_ADMIN_EMAILS.includes(lower) || lower.includes('admin');
  };

  // Helper to accurately resolve user role across DB profile, auth metadata, and admin email pattern
  const resolveRole = (userData, user) => {
    if (user?.email && isAdminEmail(user.email)) return 'admin';
    if (userData?.role) return userData.role;
    if (user?.user_metadata?.role) return user.user_metadata.role;
    return 'buyer';
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
      // Clear any previous stale cached user session
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_role');

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      let userData = await getUserData(data.user.id);
      const role = resolveRole(userData, data.user);

      // Ensure profile exists in Supabase DB and is kept in sync
      if (!userData) {
        const profileData = {
          id: data.user.id,
          email: data.user.email || email,
          full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || email.split('@')[0],
          role: role,
          created_at: new Date().toISOString()
        };
        await supabase.from('profiles').upsert([profileData]).catch(err => console.warn('Profile sync warning:', err.message));
        userData = profileData;
      } else if (role === 'admin' && userData.role !== 'admin') {
        await supabase.from('profiles').update({ role: 'admin' }).eq('id', data.user.id).catch(err => console.warn('Profile update warning:', err.message));
        userData = { ...userData, role: 'admin' };
      }

      const fullUser = { ...data.user, ...(userData || {}), role };

      setCurrentUser(fullUser);
      setUserRole(role);
      localStorage.setItem('auth_user', JSON.stringify(fullUser));
      localStorage.setItem('auth_role', role);

      return fullUser;
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
      await supabase.auth.signOut().catch(err => console.warn('SignOut network warning:', err.message));
    } finally {
      setCurrentUser(null);
      setUserRole(null);
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_role');
      localStorage.clear();
      sessionStorage.clear();
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
    // In Supabase v2, onAuthStateChange fires immediately with INITIAL_SESSION
    // so we don't need a separate checkInitialSession — that causes duplicate getUserData calls.
    // We wrap everything in try/catch/finally so a DB error never freezes loading.

    // Hard timeout: if for some reason auth doesn't resolve in 3s, unlock the app shell.
    const timeout = setTimeout(() => setLoading(false), 3000);

    let isInitialCheck = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (session?.user) {
          let userData = await getUserData(session.user.id);
          const role = resolveRole(userData, session.user);
          const fullUser = { ...session.user, ...(userData || {}), role };
          
          setCurrentUser(fullUser);
          setUserRole(role);
          localStorage.setItem('auth_user', JSON.stringify(fullUser));
          localStorage.setItem('auth_role', role);
        } else {
          // If session is null/empty for ANY reason, ALWAYS clear currentUser and localStorage
          setCurrentUser(null);
          setUserRole(null);
          localStorage.removeItem('auth_user');
          localStorage.removeItem('auth_role');
        }
      } catch (err) {
        console.error('Auth state change error:', err);
      } finally {
        if (isInitialCheck) {
          isInitialCheck = false;
          clearTimeout(timeout);
          setLoading(false);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
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
      {children}
    </AuthContext.Provider>
  );
};
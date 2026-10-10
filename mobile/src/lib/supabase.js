import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { Platform } from 'react-native';

export const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

const getAuthStorage = () => {
    try {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage;
        }
    } catch (_) {}
    return AsyncStorage;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: getAuthStorage(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Tells Supabase Auth to continuously refresh the session automatically
// if the app is in the foreground (safe-guarded).
AppState.addEventListener('change', (state) => {
    try {
        if (state === 'active') {
            supabase?.auth?.startAutoRefresh?.();
        } else {
            supabase?.auth?.stopAutoRefresh?.();
        }
    } catch (_) {}
});

// Handle Auth State Changes (including refresh errors)
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') {
        // console.log('Auth: Token refreshed successfully');
    }
    if (event === 'SIGNED_OUT') {
        // Session might have been cleared due to invalid refresh token
        // console.log('Auth: User signed out or session expired');
    }
});

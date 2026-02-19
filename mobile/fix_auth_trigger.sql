-- FIX AUTH TRIGGER
-- The error "Database error saving new user" usually means a Trigger on auth.users is failing.
-- This script will safely remove broken triggers so Sign Up works again.

-- 1. List and Drop potentially broken triggers on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. (Optional) Re-create a SAFE trigger if you rely on auto-profile creation
-- Ideally, your App handles profile creation (AuthPage.js line 150), so we don't strictly NEED this trigger.
-- Removing it is the safest way to fix the error immediately.

-- 3. Ensure the 'users' table exists and has correct permissions (just in case)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    "fullName" TEXT,
    "phoneNumber" TEXT,
    role TEXT DEFAULT 'buyer',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    avatar_url TEXT
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their OWN profile (Critical for App-side creation)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile" 
ON public.users FOR INSERT 
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" 
ON public.users FOR UPDATE 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Everyone can read profiles" ON public.users;
CREATE POLICY "Everyone can read profiles" 
ON public.users FOR SELECT 
USING (true);

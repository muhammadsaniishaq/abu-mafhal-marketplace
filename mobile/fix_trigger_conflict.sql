-- FIX TRIGGER CONFLICT
-- The trigger 'on_auth_user_created_wallet' tries to create a wallet immediately after Signup.
-- However, the 'users' profile is created LATER by the App (AuthPage.js).
-- This causes a Foreign Key error because 'public.users' row doesn't exist yet when the trigger runs.

-- 1. Drop the conflicting trigger
DROP TRIGGER IF EXISTS on_auth_user_created_wallet ON auth.users;

-- 2. Drop the function (optional, but good for cleanup if valid)
DROP FUNCTION IF EXISTS public.handle_new_user_wallet();

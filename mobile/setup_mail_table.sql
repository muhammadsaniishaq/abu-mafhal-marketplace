-- Create Mail Table for Logging
-- This table stores all outgoing emails for tracking and debugging.

CREATE TABLE IF NOT EXISTS public.mail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "to" TEXT NOT NULL,
    subject TEXT NOT NULL,
    html TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    error_message TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.mail ENABLE ROW LEVEL SECURITY;

-- Allow Service Role (Admin) full access
-- Supabase handles this, but we explicitly allow it for clarity.
DROP POLICY IF EXISTS "Service role can do everything on mail" ON public.mail;
CREATE POLICY "Service role can do everything on mail" 
ON public.mail FOR ALL 
USING (auth.role() = 'service_role');

-- Allow Admins to see all mail logs
DROP POLICY IF EXISTS "Admins can view all mail logs" ON public.mail;
CREATE POLICY "Admins can view all mail logs" 
ON public.mail FOR SELECT 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Note: We don't allow buyers/drivers to see the mail table for security.

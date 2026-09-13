-- ==============================================================================
-- ABU MAFHAL MARKETPLACE: VENDOR FOLLOWERS TABLE SCHEMA & RLS POLICIES
-- Description: Enables buyers to follow verified vendor stores and vendors to
--              track their followers, audience growth, and send store updates.
-- ==============================================================================

-- 1. Create table for vendor followers
CREATE TABLE IF NOT EXISTS public.vendor_followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id TEXT NOT NULL,                         -- Can be vendor user_id (UUID) or official store key ('official-abumafhal')
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Follower customer account
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_vendor_user_follower UNIQUE (vendor_id, user_id)
);

-- 2. Indexes for high-performance lookups & counts
CREATE INDEX IF NOT EXISTS idx_vendor_followers_vendor_id ON public.vendor_followers(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_followers_user_id ON public.vendor_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_followers_created ON public.vendor_followers(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.vendor_followers ENABLE ROW LEVEL SECURITY;

-- 4. Policies:
-- (a) Public Read: Anyone (buyers, vendors, guests) can query follower lists and counts
DROP POLICY IF EXISTS "Public can view vendor followers" ON public.vendor_followers;
CREATE POLICY "Public can view vendor followers" ON public.vendor_followers
    FOR SELECT USING (true);

-- (b) Authenticated Insert: Logged-in users can follow vendors (matching their auth.uid())
DROP POLICY IF EXISTS "Users can follow vendors" ON public.vendor_followers;
CREATE POLICY "Users can follow vendors" ON public.vendor_followers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- (c) Authenticated Delete: Logged-in users can unfollow vendors
DROP POLICY IF EXISTS "Users can unfollow vendors" ON public.vendor_followers;
CREATE POLICY "Users can unfollow vendors" ON public.vendor_followers
    FOR DELETE USING (auth.uid() = user_id);

-- (d) Service role full access
DROP POLICY IF EXISTS "Service role manage vendor_followers" ON public.vendor_followers;
CREATE POLICY "Service role manage vendor_followers" ON public.vendor_followers
    FOR ALL USING (true) WITH CHECK (true);

-- Grant privileges
GRANT ALL ON TABLE public.vendor_followers TO authenticated;
GRANT ALL ON TABLE public.vendor_followers TO service_role;
GRANT SELECT ON TABLE public.vendor_followers TO anon;

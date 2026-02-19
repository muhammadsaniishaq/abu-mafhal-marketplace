-- SYNC VENDOR LOGOS (From Registration & Profile)

-- 1. Check if vendor applications table has valid logo
-- Note: It might be easier to join on user_id if linking with profiles.

DO $$
BEGIN
    -- Update from Vendor Applications (Registration)
    -- We assume 'vendor_applications' has 'user_id' OR 'business_name' match.
    -- Let's stick to 'user_id' if possible, or simpler exact name match if ID fails.
    
    -- Attempt 1: Using user_id (most reliable)
    -- BUT we need to check if vendor_applications has user_id column.
    -- We'll wrap in exception block just in case column missing.
    BEGIN
        UPDATE vendors v
        SET logo_url = va.logo_url
        FROM vendor_applications va
        WHERE v.user_id = va.user_id
        AND va.status = 'approved'
        AND (v.logo_url IS NULL OR v.logo_url = 'null')
        AND va.logo_url IS NOT NULL;
    EXCEPTION WHEN undefined_column THEN
        -- Fallback if user_id missing in va (unlikely but safe)
        NULL;
    END;

    -- Attempt 2: Using business_name match (fallback)
    UPDATE vendors v
    SET logo_url = va.logo_url
    FROM vendor_applications va
    WHERE v.business_name = va.business_name
    AND (v.logo_url IS NULL OR v.logo_url = 'null')
    AND va.logo_url IS NOT NULL;

    -- Update from User Profile (Avatar) if still NULL
    UPDATE vendors v
    SET logo_url = p.avatar_url
    FROM profiles p
    WHERE v.user_id = p.id
    AND (v.logo_url IS NULL OR v.logo_url = 'null')
    AND p.avatar_url IS NOT NULL;

END $$;

-- 2. Verify results
SELECT id, business_name, logo_url FROM vendors WHERE is_verified = true;

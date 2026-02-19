-- FIX VENDOR LOGOS FINAL (Separate from Profile)

DO $$
BEGIN
    -- 1. Unlink Vendor Logo from Profile Avatar if they match
    --    and set it to Vendor Application Logo if available.
    UPDATE vendors v
    SET logo_url = va.logo_url
    FROM vendor_applications va, profiles p
    WHERE v.user_id = va.user_id
    AND v.user_id = p.id
    AND v.logo_url = p.avatar_url -- It matches profile (which user hates)
    AND va.logo_url IS NOT NULL;  -- And we have a valid app logo

    -- 2. If it matches Profile but NO Vendor Application Logo exists (e.g. Mock Data),
    --    Generate a unique "Store" placeholder so it's not the user's face.
    UPDATE vendors v
    SET logo_url = 'https://ui-avatars.com/api/?name=' || replace(v.store_name, ' ', '+') || '&background=000000&color=fff&size=200&font-size=0.33&length=2'
    FROM profiles p
    WHERE v.user_id = p.id
    AND v.logo_url = p.avatar_url; -- It still matches profile (means step 1 didn't find an app logo)

END $$;

-- 3. Verify results
SELECT id, store_name, logo_url FROM vendors WHERE is_verified = true;

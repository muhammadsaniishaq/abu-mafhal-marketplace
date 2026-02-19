-- CHECK VENDOR LOGO SOURCE

SELECT 
    v.id as vendor_id, 
    v.store_name, 
    v.logo_url as current_vendor_logo,
    p.avatar_url as profile_avatar,
    va.logo_url as application_logo,
    CASE 
        WHEN v.logo_url = p.avatar_url THEN 'MATCHES_PROFILE'
        WHEN v.logo_url = va.logo_url THEN 'MATCHES_APPLICATION'
        ELSE 'OTHER'
    END as source
FROM vendors v
LEFT JOIN profiles p ON v.user_id = p.id
LEFT JOIN vendor_applications va ON v.user_id = va.user_id
WHERE v.is_verified = true;

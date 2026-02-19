-- Re-create the view to ensure it picks up the new 'last_seen' column
CREATE OR REPLACE VIEW public_profiles AS
SELECT 
    id,
    full_name,
    avatar_url,
    role,
    business_name,
    city,
    state,
    country,
    created_at,
    last_seen
FROM profiles;

-- Grant access (idempotent)
GRANT SELECT ON public_profiles TO anon, authenticated, service_role;

-- Verify messages columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages';

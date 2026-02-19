-- POPULATE TESTIMONIALS V3 (Minimal & Robust)

DO $$
DECLARE
    v_user_id uuid;
    v_review_count integer;
BEGIN
    -- 1. Try to set existing reviews to 'approved' and 'displayed'
    -- Note: We check if 'status' column exists implicitly by trying to update it.
    -- If this fails, then 'reviews' table is severely broken.
    UPDATE reviews
    SET is_displayed = true, status = 'approved'
    WHERE id IN (SELECT id FROM reviews ORDER BY random() LIMIT 3);
    
    -- 2. Check if we have any displayed reviews now
    SELECT count(*) INTO v_review_count FROM reviews WHERE is_displayed = true;
    
    -- 3. If NONE exist, create a mock one (using a random user)
    IF v_review_count = 0 THEN
        -- Get a valid user ID from profiles
        SELECT id INTO v_user_id FROM profiles LIMIT 1;
        
        IF v_user_id IS NOT NULL THEN
            -- Minimal INSERT - only columns we represent in UI and are standard
            -- Omitting 'title' and 'verified_purchase' to avoid errors
            INSERT INTO reviews (
                id, 
                user_id, 
                rating, 
                comment, 
                status, 
                is_displayed, 
                created_at
            ) VALUES (
                uuid_generate_v4(),
                v_user_id,
                5,
                'Super fast delivery and great quality. Highly recommended!',
                'approved',
                true,
                now()
            );
        END IF;
    END IF;
END $$;

-- 4. Return final count
SELECT count(*) as displayed_testimonials FROM reviews WHERE is_displayed = true;

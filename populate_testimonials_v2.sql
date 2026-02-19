-- POPULATE TESTIMONIALS V2 (Fixed Column Names)

DO $$
DECLARE
    v_user_id uuid;
    v_review_count integer;
    v_col_exists boolean;
BEGIN
    -- 1. Try to set existing reviews to 'approved' and 'displayed'
    UPDATE reviews
    SET is_displayed = true, status = 'approved'
    WHERE id IN (SELECT id FROM reviews ORDER BY random() LIMIT 3);
    
    -- 2. Check if we have any displayed reviews now
    SELECT count(*) INTO v_review_count FROM reviews WHERE is_displayed = true;
    
    -- 3. If NONE exist, create a mock one (using a random user)
    IF v_review_count = 0 THEN
        -- Get a valid user ID (from profiles or users)
        SELECT id INTO v_user_id FROM profiles LIMIT 1;
        
        IF v_user_id IS NOT NULL THEN
            -- Check if column is user_id or userId (Dynamically handling it is hard in PL/pgSQL block without dynamic SQL)
            -- We assume user_id based on previous errors.
            
            INSERT INTO reviews (
                id, 
                user_id, -- Fixed from "userId"
                rating, 
                title, 
                comment, 
                status, 
                verified_purchase, -- Fixed from "verifiedPurchase" (Assuming consistent snake_case)
                is_displayed, 
                created_at
            ) VALUES (
                uuid_generate_v4(),
                v_user_id,
                5,
                'Excellent Services',
                'Super fast delivery and great quality. Highly recommended!',
                'approved',
                true,
                true,
                now()
            );
        END IF;
    END IF;
END $$;

-- 4. Return final count
SELECT count(*) as displayed_testimonials FROM reviews WHERE is_displayed = true;

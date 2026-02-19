-- POPULATE TESTIMONIALS V4 (Fix Product ID Constraint)

DO $$
DECLARE
    v_user_id uuid;
    v_product_id uuid;
    v_cnt integer;
BEGIN
    -- 1. Check if we have any displayed reviews
    SELECT count(*) INTO v_cnt FROM reviews WHERE is_displayed = true;
    
    -- 2. If NONE exist, create a mock one
    IF v_cnt = 0 THEN
        -- Get a valid user
        SELECT id INTO v_user_id FROM profiles LIMIT 1;
        
        -- Get a valid product (REQUIRED by database constraint)
        SELECT id INTO v_product_id FROM products LIMIT 1;
        
        IF v_user_id IS NOT NULL AND v_product_id IS NOT NULL THEN
            INSERT INTO reviews (
                id,
                user_id,      -- confirmed snake_case from error logs
                product_id,   -- REQUIREMENT: confirmed snake_case from error logs
                rating,
                comment,
                status,
                is_displayed,
                created_at
            ) VALUES (
                uuid_generate_v4(),
                v_user_id,
                v_product_id,
                5,
                'Super fast delivery and great quality. Highly recommended!',
                'approved',
                true,
                now()
            );
        END IF;
    END IF;
END $$;

-- 3. Verify success
SELECT count(*) as displayed_testimonials FROM reviews WHERE is_displayed = true;

-- Mock Data Seed Script
-- Run this in Supabase SQL Editor

DO $$
DECLARE
    v_vendor_id uuid;
    v_buyer_id uuid;
    v_product_id uuid;
    v_order_id uuid;
BEGIN
    -- 1. Identify a Vendor (Get first user with 'vendor' role or just first user)
    SELECT id INTO v_vendor_id FROM public.profiles WHERE role = 'vendor' LIMIT 1;
    
    -- Fallback if no vendor
    IF v_vendor_id IS NULL THEN
        SELECT id INTO v_vendor_id FROM public.profiles LIMIT 1;
        -- Update role to vendor for testing
        UPDATE public.profiles SET role = 'vendor' WHERE id = v_vendor_id;
        
        -- SYNC public.users (Required for Wallets FK)
        -- public.users has columns: id, email, role, "businessName", "displayName" etc.
        -- Note: profiles table does NOT have business_name, so we use a static string.
        INSERT INTO public.users (id, email, role, "businessName", "displayName", "createdAt", "updatedAt")
        SELECT id, email, role::text, 'Mock Vendor Inc', full_name, created_at, updated_at
        FROM public.profiles
        WHERE id = v_vendor_id
        ON CONFLICT (id) DO UPDATE SET
            role = EXCLUDED.role,
            "businessName" = EXCLUDED."businessName";
    END IF;

    -- 2. Identify/Create Vendor Record (in 'vendors' table, separate from 'profiles')
    -- Constraint 'order_items_vendor_id_fkey' references 'vendors(id)'
    -- We assume 'vendors' has (id, owner_id, name, slug) based on typical schema patterns found in 'brands'/'categories'
    -- If this fails, we will need to know exact columns of 'vendors'
    DECLARE
        v_vendor_record_id uuid;
    BEGIN
        SELECT id INTO v_vendor_record_id FROM public.vendors WHERE owner_id = v_vendor_id LIMIT 1;
        
        IF v_vendor_record_id IS NULL THEN
            INSERT INTO public.vendors (owner_id, store_name, store_slug)
            VALUES (v_vendor_id, 'Mock Vendor Business', 'mock-vendor-' || gen_random_uuid())
            RETURNING id INTO v_vendor_record_id;
        END IF;

        -- 2b. Identify a Buyer (Just use same user or another)
        SELECT id INTO v_buyer_id FROM public.profiles WHERE id != v_vendor_id LIMIT 1;
        IF v_buyer_id IS NULL THEN v_buyer_id := v_vendor_id; END IF;
    
        -- 3. Create Category (if needed)
        INSERT INTO public.categories (name, slug) VALUES ('Electronics', 'electronics-mock')
        ON CONFLICT (slug) DO NOTHING;
    
        -- 4. Create Product
        -- Note: products.vendor_id references PROFILES(id) as per FK audit
        INSERT INTO public.products (vendor_id, name, price, stock_quantity, status, category)
        VALUES (v_vendor_id, 'Mock Laptop 2026', 450000, 50, 'approved', 'Electronics')
        RETURNING id INTO v_product_id;
    
        -- 5. Create Order
        -- Note: orders table uses user_id (profile id)
        INSERT INTO public.orders (user_id, total_amount, status, shipping_address)
        VALUES (v_buyer_id, 450000, 'pending', '123 Mock Lane')
        RETURNING id INTO v_order_id;
    
        -- 6. Create Order Item
        -- Note: order_items.vendor_id references VENDORS(id)
        INSERT INTO public.order_items (order_id, product_id, vendor_id, buyer_id, quantity, price)
        VALUES (v_order_id, v_product_id, v_vendor_record_id, v_buyer_id, 1, 450000);
    
        -- 7. Update Wallet
        -- Note: wallets table uses user_id (profile id)
        IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE user_id = v_vendor_id) THEN
            INSERT INTO public.wallets (user_id, balance, currency)
            VALUES (v_vendor_id, 0, 'NGN');
        END IF;
        
        -- Add to balance
        UPDATE public.wallets 
        SET balance = coalesce(balance, 0) + 450000
        WHERE user_id = v_vendor_id;
    
        RAISE NOTICE 'Mock data seeded for Vendor Profile ID: %, Vendor Record ID: %', v_vendor_id, v_vendor_record_id;
    END;
END $$;

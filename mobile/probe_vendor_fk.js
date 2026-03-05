const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function probe() {
    console.log('Probing order_items constraints...');
    const { data, error } = await supabase.rpc('get_table_constraints', { t_name: 'order_items' });

    if (error) {
        // Fallback to raw SQL if RPC doesn't exist
        console.log('RPC failed, trying raw SQL query for constraints...');
        const { data: sqlData, error: sqlError } = await supabase.from('_dummy').select('*').limit(1).catch(() => ({ data: null, error: null }));

        // Since I can't run raw SQL easily without a dedicated tool or knowing the RPCs, 
        // I will try to inspect a few products and their vendor_ids.
        console.log('Checking vendor_ids in products table...');
        const { data: products, error: prodError } = await supabase
            .from('products')
            .select('id, name, vendor_id')
            .limit(10);

        if (prodError) {
            console.error('Error fetching products:', prodError);
            return;
        }

        console.log('Sample Products and Vendor IDs:');
        console.table(products);

        if (products.length > 0) {
            const vendorIds = [...new Set(products.map(p => p.vendor_id).filter(Boolean))];
            if (vendorIds.length > 0) {
                console.log('Verifying if these vendor_ids exist in profiles...');
                const { data: profiles, error: profError } = await supabase
                    .from('profiles')
                    .select('id')
                    .in('id', vendorIds);

                if (profError) {
                    console.error('Error checking profiles:', profError);
                } else {
                    const foundIds = profiles.map(p => p.id);
                    const missingIds = vendorIds.filter(id => !foundIds.includes(id));
                    if (missingIds.length > 0) {
                        console.error('CRITICAL: Following vendor_ids in products do NOT exist in profiles:', missingIds);
                    } else {
                        console.log('All sample vendor_ids exist in profiles.');
                    }
                }
            } else {
                console.log('No vendor_ids found in sample products.');
            }
        }
    } else {
        console.log('Constraints:', data);
    }
}

probe();

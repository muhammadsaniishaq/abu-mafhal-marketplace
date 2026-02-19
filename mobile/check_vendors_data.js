const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkVendors() {
    console.log('--- VENDORS CHECK ---');
    const { data: vendors } = await supabase.from('vendors').select('id, store_name').limit(5);
    console.log('Sample Vendors:', vendors);

    const { data: products } = await supabase.from('products').select('id, name, vendor_id').limit(5);
    console.log('Sample Products:', products);

    if (vendors && vendors.length > 0 && products) {
        const validVendorIds = vendors.map(v => v.id);
        const productsWithValidVendors = products.filter(p => validVendorIds.includes(p.vendor_id));
        console.log('Products with valid vendors in sample:', productsWithValidVendors.length);
    }
}
checkVendors();

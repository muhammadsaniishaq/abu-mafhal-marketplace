const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugPrices() {
    console.log('--- SEARCHING FOR PRODUCT WITH PRICE 4098000 ---');
    const { data: products, error } = await supabase
        .from('products')
        .select('name, price, metadata')
        .eq('price', 4098000);

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    if (!products || products.length === 0) {
        console.log('No product found with exact price 4098000.');
        // Try searching for partial match in metadata just in case
        const { data: allProducts } = await supabase.from('products').select('name, price, metadata').limit(50);
        allProducts.forEach(p => {
            if (p.price.toString().includes('4098')) {
                console.log(`Potential Match: ${p.name} - Price: ${p.price}`);
            }
        });
    } else {
        products.forEach(p => {
            console.log(`Found Match: ${p.name}`);
            console.log(`- Price (DB): ${p.price}`);
        });
    }
}
debugPrices();

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
    console.log('--- DATA CHECK ---');
    const { data: items, error } = await supabase.from('order_items').select('id, product_id, order_id').limit(10);
    if (error) console.log('Error:', error.message);
    else {
        console.log('Order Items Count:', items.length);
        items.forEach(i => console.log(`Item: ${i.id}, Product_ID: ${i.product_id}, Order_ID: ${i.order_id}`));
    }

    const { data: products } = await supabase.from('products').select('id, name').limit(5);
    console.log('\n--- PRODUCTS SAMPLE ---');
    products?.forEach(p => console.log(`Prod: ${p.id}, Name: ${p.name}`));
}
checkData();

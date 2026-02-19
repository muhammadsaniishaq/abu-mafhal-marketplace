
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    console.log('--- SCHEMA INTROSPECTION ---');

    // 1. PRODUCTS
    console.log('\n--- PRODUCTS ---');
    const { data: products } = await supabase
        .from('products')
        .select('*')
        .limit(1);

    if (products?.[0]) {
        console.log(Object.keys(products[0]));
    } else {
        console.log('No products found to infer schema.');
    }

    // 2. ORDERS
    console.log('\n--- ORDERS ---');
    const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .limit(1);

    if (orders?.[0]) {
        console.log(Object.keys(orders[0]));
    } else {
        console.log('No orders found to infer schema.');
    }

    // 3. ORDER ITEMS (Guessing table name)
    console.log('\n--- ORDER ITEMS (Guessing "order_items") ---');
    const { data: orderItems, error } = await supabase
        .from('order_items')
        .select('*')
        .limit(1);

    if (orderItems?.[0]) {
        console.log(Object.keys(orderItems[0]));
    } else {
        console.log('No order_items found or error:', error?.message);
    }
}

run();

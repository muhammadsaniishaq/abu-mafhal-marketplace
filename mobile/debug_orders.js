const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debug() {
    const { data: orders } = await supabase.from('orders').select('*').limit(5);
    console.log('--- ORDERS CHECK ---');
    console.log('Orders Count:', orders?.length || 0);
    if (orders?.length > 0) {
        console.log('Sample Order ID:', orders[0].id);
        console.log('Sample Order Keys:', Object.keys(orders[0]));

        const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orders[0].id);
        console.log('Items for this Order:', items?.length || 0);
    }
}
debug();

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyOrderItems() {
    // These IDs are from the screenshot (partial match)
    const partialIds = ['330B377C', 'D4E3A4D7'];

    console.log('--- VERIFYING ITEMS FOR ORDERS ---');

    // First, find the full UUIDs for these orders
    const { data: orders } = await supabase.from('orders').select('id');

    if (orders) {
        for (const order of orders) {
            const short = order.id.slice(0, 8).toUpperCase();
            if (partialIds.includes(short)) {
                console.log(`Checking Order: ${short} (ID: ${order.id})`);
                const { count } = await supabase
                    .from('order_items')
                    .select('*', { count: 'exact', head: true })
                    .eq('order_id', order.id);
                console.log(`-> Item Count in DB: ${count}`);
            }
        }
    } else {
        console.log('No orders found at all (or RLS blocked).');
    }
}
verifyOrderItems();

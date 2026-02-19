const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkToday() {
    console.log('--- CHECKING TODAY\'S ORDERS (Feb 19) ---');
    const { data: orders } = await supabase
        .from('orders')
        .select('id, created_at')
        .gte('created_at', '2026-02-19T00:00:00Z');

    if (!orders || orders.length === 0) {
        console.log('No orders placed today yet.');
    } else {
        console.log(`Found ${orders.length} orders today.`);
        for (const o of orders) {
            const { count } = await supabase
                .from('order_items')
                .select('*', { count: 'exact', head: true })
                .eq('order_id', o.id);
            console.log(`Order ${o.id.slice(0, 8)}: ${count} items`);
        }
    }
}
checkToday();

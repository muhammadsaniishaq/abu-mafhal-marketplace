
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugOrders() {
    console.log("Fetching latest orders...");
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

    if (error) {
        console.error("Error fetching orders:", error);
        return;
    }

    console.log(`Found ${orders.length} orders.`);

    for (const order of orders) {
        console.log(`\n--- Order ${order.id} ---`);
        console.log(`Status: ${order.status}`);
        console.log(`User ID: ${order.user_id}`);

        // Fetch items separately
        const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select('*, products(*)')
            .eq('order_id', order.id);

        if (itemsError) {
            console.error("Error fetching items:", itemsError);
        } else {
            console.log(`Items count: ${items.length}`);
            if (items.length > 0) {
                console.log(JSON.stringify(items, null, 2));
            } else {
                console.log("NO ITEMS FOUND for this order.");
            }
        }
    }
}

debugOrders();

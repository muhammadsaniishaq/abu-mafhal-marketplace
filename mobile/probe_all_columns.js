const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probeColumns() {
    const columns = [
        'user_id', 'total_amount', 'subtotal', 'shipping_fee', 'tax',
        'discount_applied', 'status', 'shipping_address', 'payment_method',
        'items_count', 'item_count', 'coupon_id', 'order_notes', 'payment_reference',
        'provider', 'provider_reference', 'payment_status', 'buyer_id', 'transaction_id', 'created_at'
    ];

    for (const col of columns) {
        const { error } = await supabase
            .from('orders')
            .insert([{ [col]: null }]); // Using null to trigger "could not find column" or RLS/Constraint error

        if (error && error.message.includes(`Could not find the '${col}' column`)) {
            console.log(`[ABSENT] ${col}`);
        } else {
            console.log(`[PRESENT] ${col} (Error: ${error?.message})`);
        }
    }
}
probeColumns();

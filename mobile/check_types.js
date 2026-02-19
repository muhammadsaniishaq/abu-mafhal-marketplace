const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTypes() {
    console.log('--- TYPE CHECK ---');

    // We can't see the schema directly via anon key usually, 
    // but we can check the format of the IDs in the data.

    const { data: p } = await supabase.from('products').select('id').limit(1);
    if (p?.[0]) {
        console.log('Product ID Sample:', p[0].id, 'Type:', typeof p[0].id);
    }

    const { data: oi } = await supabase.from('order_items').select('product_id').limit(1);
    if (oi?.[0]) {
        console.log('Order Item Product_ID Sample:', oi[0].product_id, 'Type:', typeof oi[0].product_id);
    }
}
checkTypes();

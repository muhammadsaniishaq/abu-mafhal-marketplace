const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listTables() {
    console.log('--- TABLE LIST ---');
    // Using an RPC call if it exists, or a known table to infer
    const { data, error } = await supabase.from('products').select('*').limit(1);
    if (error) console.log('Products Error:', error.message);
    else console.log('Products Table Exists');

    const { data: o, error: oe } = await supabase.from('orders').select('*').limit(1);
    if (oe) console.log('Orders Error:', oe.message);
    else console.log('Orders Table Exists');

    const { data: oi, error: oie } = await supabase.from('order_items').select('*').limit(1);
    if (oie) console.log('Order Items Error:', oie.message);
    else console.log('Order Items Table Exists');

    // Check for profile to see if it's "profiles" or "profile"
    const { data: p, error: pe } = await supabase.from('profiles').select('*').limit(1);
    if (pe) console.log('Profiles Error:', pe.message);
    else console.log('Profiles Table Exists');
}
listTables();

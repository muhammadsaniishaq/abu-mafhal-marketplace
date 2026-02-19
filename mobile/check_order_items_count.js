const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function compareCounts() {
    console.log('--- DB COUNTS ---');
    const { count: oCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
    console.log('Orders Count:', oCount);

    const { count: oiCount } = await supabase.from('order_items').select('*', { count: 'exact', head: true });
    console.log('Order Items Count:', oiCount);
}
compareCounts();

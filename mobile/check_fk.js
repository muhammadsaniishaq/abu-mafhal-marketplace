const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkFK() {
    console.log('--- FOREIGN KEY CHECK ---');

    // We can't query information_schema directly via PostgREST easily
    // But we can try a query that depends on it and see the error or success

    // Try joining products on product_id
    const { data, error } = await supabase
        .from('order_items')
        .select('id, products(id)')
        .limit(1);

    if (error) {
        console.log('Join Error:', error.message);
        console.log('Error Code:', error.code);
        console.log('Error Hint:', error.hint);
    } else {
        console.log('Join Success! Relationship exists.');
    }
}
checkFK();

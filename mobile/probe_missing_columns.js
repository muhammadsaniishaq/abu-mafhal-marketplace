const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probeMissingColumns() {
    // Try to insert with just user_id and total_amount
    // This will fail if other columns are NOT NULL
    const { error } = await supabase
        .from('orders')
        .insert([{
            user_id: '00000000-0000-0000-0000-000000000000',
            total_amount: 1000,
            status: 'pending',
            payment_method: 'Wallet'
        }]);

    if (error) {
        console.log('Probe Error:', error.message);
        console.log('Error details:', error);
    } else {
        console.log('Success! Basic insert worked.');
    }
}
probeMissingColumns();

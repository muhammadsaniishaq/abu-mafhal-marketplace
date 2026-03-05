const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkNullability() {
    const { data, error } = await supabase.rpc('get_column_details', { table_name: 'orders' });
    // If RPC doesn't exist, we fallback to a direct query (if allowed) or another probe

    // Fallback: Try inserting NULL explicitly into payment_reference
    const { error: insertError } = await supabase
        .from('orders')
        .insert([{
            user_id: '00000000-0000-0000-0000-000000000000',
            payment_reference: null
        }]);

    if (insertError) {
        console.log('Insert Error Message:', insertError.message);
        if (insertError.message.includes('null value in column "payment_reference" violates not-null constraint')) {
            console.log('RESULT: payment_reference is NOT NULL.');
        } else {
            console.log('RESULT: Other error:', insertError.message);
        }
    } else {
        console.log('RESULT: Null is allowed (or RLS blocked it silently).');
    }
}
checkNullability();

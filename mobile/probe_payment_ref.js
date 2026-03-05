const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probePaymentRef() {
    // Try to insert without payment_reference
    const { error } = await supabase
        .from('orders')
        .insert([{
            user_id: '00000000-0000-0000-0000-000000000000',
            total_amount: 1000,
            status: 'pending',
            payment_method: 'Wallet'
        }]);

    if (error) {
        console.log('Error Code:', error.code);
        console.log('Error Message:', error.message);
        if (error.message.includes('null value in column "payment_reference"')) {
            console.log('RESULT: payment_reference is MANDATORY but missing in Edge Function.');
        }
    } else {
        console.log('Success! payment_reference is not mandatory.');
    }
}
probePaymentRef();

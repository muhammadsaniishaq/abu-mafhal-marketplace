const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkRPCs() {
    // We try to call them with dummy values
    // If they don't exist, we get a 404 or specific "function not found" error
    const { error: error1 } = await supabase.rpc('decrement_wallet_balance', { p_user_id: '00000000-0000-0000-0000-000000000000', p_amount: 0 });

    if (error1 && error1.message.includes('Could not find the function')) {
        console.log('RPC decrement_wallet_balance: ABSENT');
    } else {
        console.log('RPC decrement_wallet_balance: Might exist (Error: ' + error1?.message + ')');
    }

    const { error: error2 } = await supabase.rpc('increment_wallet_balance', { p_vendor_id: '00000000-0000-0000-0000-000000000000', p_amount: 0 });

    if (error2 && error2.message.includes('Could not find the function')) {
        console.log('RPC increment_wallet_balance: ABSENT');
    } else {
        console.log('RPC increment_wallet_balance: Might exist (Error: ' + error2?.message + ')');
    }
}
checkRPCs();

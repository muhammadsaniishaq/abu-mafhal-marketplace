const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkWalletColumn() {
    const { error } = await supabase
        .from('profiles')
        .insert([{ wallet_balance: 0 }]);

    if (error && error.message.includes("Could not find the 'wallet_balance' column")) {
        console.log('wallet_balance: ABSENT');
    } else {
        console.log('wallet_balance: Might exist (Error: ' + error?.message + ')');
    }
}
checkWalletColumn();

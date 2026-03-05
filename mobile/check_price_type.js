const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkPriceType() {
    // Try to insert a non-numeric string into price
    const { error } = await supabase
        .from('products')
        .insert([{ price: 'not-a-number' }]);

    if (error) {
        console.log('Error Message:', error.message);
        if (error.message.includes('invalid input syntax for type numeric') || error.message.includes('invalid input syntax for type integer')) {
            console.log('RESULT: price is NUMERIC/INTEGER (Safe from NaN).');
        } else {
            console.log('RESULT: Other error:', error.message);
        }
    } else {
        console.log('RESULT: price accepts strings (Potential NaN risk!).');
    }
}
checkPriceType();

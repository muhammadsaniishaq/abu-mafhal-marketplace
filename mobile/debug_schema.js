
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    // Just select one record to see keys
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("Existing Columns in 'orders':");
        console.log(Object.keys(data[0]));
    } else {
        console.log("No orders found, cannot infer schema easily via select *.");
        // Attempt to insert a dummy to see if we get an error or just read information_schema via SQL function if available?
        // Actually, let's just create an RPC to describe table if needed, but select * is good start.
    }
}

checkSchema();

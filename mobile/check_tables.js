
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    const tables = ['drivers', 'couriers', 'shipping_partners', 'delivery_agents'];

    for (const table of tables) {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error && error.code === '42P01') { // undefined_table
            console.log(`Table '${table}' does NOT exist.`);
        } else if (error) {
            console.log(`Table '${table}' exists but error:`, error.message);
        } else {
            console.log(`Table '${table}' EXISTS.`);
        }
    }
}

checkTables();

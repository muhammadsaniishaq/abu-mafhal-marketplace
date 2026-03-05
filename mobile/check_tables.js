const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMoreTables() {
    const tables = ['regions', 'zones', 'locations', 'delivery_areas', 'shipping_rates', 'delivery_fees'];
    for (const table of tables) {
        const { error: e } = await supabase.from(table).select('count').limit(1);
        console.log(`Table ${table}: ${e ? 'NOT FOUND' : 'EXISTS'}`);
    }
}

checkMoreTables();

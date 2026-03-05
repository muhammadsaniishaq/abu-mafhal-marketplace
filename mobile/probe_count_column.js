const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probeItemsCount() {
    const { error: error1 } = await supabase
        .from('orders')
        .insert([{ items_count: 1 }]);

    if (error1 && error1.message.includes("Could not find the 'items_count' column")) {
        console.log('items_count does NOT exist.');
    } else {
        console.log('items_count might exist (or RLS blocked it).', error1?.message);
    }

    const { error: error2 } = await supabase
        .from('orders')
        .insert([{ item_count: 1 }]);

    if (error2 && error2.message.includes("Could not find the 'item_count' column")) {
        console.log('item_count does NOT exist.');
    } else {
        console.log('item_count might exist (or RLS blocked it).', error2?.message);
    }
}
probeItemsCount();

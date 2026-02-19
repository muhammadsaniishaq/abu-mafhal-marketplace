
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugWithUser() {
    // Attempt to login with a test user or just query if public
    // Since I don't have a password, I will query products first to see if connection is ok
    console.log("Checking connection...");
    const { data: products } = await supabase.from('products').select('id, name').limit(1);
    console.log("Public Products check:", products ? "OK" : "FAILED");


    // I cannot login without credentials.
    // However, the issue is that the User's app HAS credentials but gets empty items.
    // This implies select policy on order_items failed.

    // I can't debug RLS further without admin access or a valid user token.
    // BUT I can create a new user to test? No.

    console.log("... Skipping User Login ...");
}

debugWithUser();

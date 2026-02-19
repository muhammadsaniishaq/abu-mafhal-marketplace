
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

const supabase = createClient(supabaseUrl, supabaseKey);

async function assignDriver() {
    // 1. Get the dummy driver
    const { data: drivers, error: driverError } = await supabase
        .from('drivers')
        .select('id')
        .limit(1);

    if (driverError || !drivers || drivers.length === 0) {
        console.error("No driver found. Run the SQL script first.");
        return;
    }

    const driverId = drivers[0].id;
    console.log(`Found Driver ID: ${driverId}`);

    // 2. Get the latest pending/processing order
    const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1);

    if (orderError || !orders || orders.length === 0) {
        console.error("No recent orders found to update.");
        return;
    }

    const orderId = orders[0].id;
    console.log(`Updating Order ID: ${orderId}`);

    // 3. Update the order
    const { error: updateError } = await supabase
        .from('orders')
        .update({
            driver_id: driverId,
            status: 'shipped' // Change status to show progress
        })
        .eq('id', orderId);

    if (updateError) {
        console.error("Error updating order:", updateError);
    } else {
        console.log("SUCCESS: Order updated with Driver ID and status set to 'shipped'.");
    }
}

assignDriver();

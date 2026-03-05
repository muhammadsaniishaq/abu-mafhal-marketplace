const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    try {
        console.log('Fetching delivered orders...');
        const { data: orders, error: ordersErr } = await supabase
            .from('orders')
            .select('id, status, created_at')
            .order('created_at', { ascending: false })
            .limit(1);

        if (ordersErr) throw ordersErr;
        if (!orders || orders.length === 0) {
            console.log('No delivered orders found.');
            return;
        }

        const order = orders[0];
        console.log('Found delivered order:', order.id);

        console.log('\nFetching order items...');
        const { data: items, error: itemsErr } = await supabase
            .from('order_items')
            .select(`
                id, product_id, vendor_id, price, quantity,
                product:products ( vendor_id )
            `)
            .eq('order_id', order.id);

        if (itemsErr) throw itemsErr;

        let totalVendorEarnings = 0;
        const vendorIds = new Set();

        items.forEach(item => {
            const vendorId = item.vendor_id || (item.product ? item.product.vendor_id : null);
            console.log(`Item ${item.id} | Qty: ${item.quantity} | Price: ${item.price} | Derived Vendor: ${vendorId}`);
            if (vendorId) {
                vendorIds.add(vendorId);
                totalVendorEarnings += (item.price * item.quantity);
            }
        });

        console.log(`Total vendor earnings for order: ${totalVendorEarnings}`);

        for (const vendorId of vendorIds) {
            console.log(`\nChecking wallet for vendor: ${vendorId}`);
            const { data: wallet, error: walletErr } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', vendorId)
                .maybeSingle();

            if (walletErr) console.log('Wallet fetch err:', walletErr);
            else console.log('Current wallet state:', wallet);

            console.log('\nCalling credit_vendors_on_delivery RPC...');
            const { data: rpcData, error: rpcErr } = await supabase.rpc('credit_vendors_on_delivery', { p_order_id: order.id });
            if (rpcErr) {
                console.log('RPC ERROR:', rpcErr);
            } else {
                console.log('RPC Success!', rpcData);
            }

            console.log('\nRe-checking wallet...');
            const { data: wallet2 } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', vendorId)
                .maybeSingle();
            console.log('New wallet state:', wallet2);
        }

    } catch (e) {
        console.error('Fatal error:', e);
    }
}

run();

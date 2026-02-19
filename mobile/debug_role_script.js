
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const APP_ID = 'eb8793ae-9817-42e6-97c0-bc1468f9fdbe';

async function run() {
    console.log('--- DEBUGGING ROLE SYNC ---');

    // 1. Fetch Application
    const { data: app, error: appError } = await supabase
        .from('vendor_applications')
        .select('*')
        .eq('id', APP_ID)
        .single();

    if (appError) {
        console.error('Error fetching app:', appError);
        return;
    }

    console.log('Application:', {
        id: app.id,
        user_id: app.user_id,
        status: app.status,
        payment_status: app.payment_status
    });

    if (!app) {
        console.error('Application not found!');
        return;
    }

    // 2. Fetch Profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', app.user_id)
        .single();

    if (profileError) {
        console.error('Error fetching profile:', profileError);
    } else {
        console.log('Profile:', {
            id: profile.id,
            role: profile.role,
            full_name: profile.full_name
        });
    }

    // 3. Fetch Vendor Record
    const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', app.user_id)
        .single();

    if (vendorError && vendorError.code !== 'PGRST116') { // Ignore 'Not found'
        console.error('Error fetching vendor record:', vendorError);
    } else {
        console.log('Vendor Record:', vendor ? { id: vendor.id, vendor_status: vendor.vendor_status } : 'NOT FOUND');
    }

    // 4. FIX LOGIC
    if (app.status === 'approved' && profile.role !== 'vendor') {
        console.log('>>> MISMATCH DETECTED: App is approved but Role is not vendor.');
        console.log('>>> Attempting to force update Profile role...');

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: 'vendor' })
            .eq('id', app.user_id);

        if (updateError) console.error('Failed to update profile:', updateError);
        else console.log('>>> SUCCESS: Profile role updated to vendor.');
    } else if (app.status === 'paid' || app.status === 'pending') {
        console.log('>>> App is not approved yet. Approving now to trigger role update...');

        const { error: approveError } = await supabase
            .from('vendor_applications')
            .update({ status: 'approved' })
            .eq('id', APP_ID);

        if (approveError) console.error('Failed to approve app:', approveError);
        else console.log('>>> SUCCESS: Application approved. Trigger should run now.');
    } else {
        console.log('>>> No obvious mismatch found or invalid state.');
    }
}

run();

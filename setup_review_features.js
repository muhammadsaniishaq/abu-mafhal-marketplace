const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjA3MjE1MCwiZXhwIjoyMDgxNjQ4MTUwfQ.1E6tXzD-r-B8t5_C-H8OPE62j7h4NstG_mU8uFh-LHg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setup() {
    console.log('--- Setting up Review Features ---');

    // 1. Create Bucket
    console.log('Creating bucket "review-images"...');
    const { data: bucket, error: bucketError } = await supabase.storage.createBucket('review-images', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    });

    if (bucketError) {
        if (bucketError.message.includes('already exists')) {
            console.log('Bucket "review-images" already exists.');
        } else {
            console.error('Bucket Error:', bucketError.message);
        }
    } else {
        console.log('Bucket "review-images" created successfully.');
    }

    // 2. Try to add column via a known RPC if possible, or just log.
    // Since we don't have a direct SQL runner, we'll try to insert a test review with images to see if it fails.
    console.log('Testing "images" column existence...');
    const { error: testError } = await supabase.from('reviews').select('images').limit(1);

    if (testError) {
        console.log('Column "images" appears to be missing:', testError.message);
        console.log('--- ACTION REQUIRED ---');
        console.log('Please run the following SQL in the Supabase Dashboard SQL Editor:');
        console.log('ALTER TABLE reviews ADD COLUMN IF NOT EXISTS images text[] DEFAULT \'{}\';');
    } else {
        console.log('Column "images" already exists.');
    }
}

setup();

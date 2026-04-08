
import { supabase } from '../lib/supabase';

async function checkReviews() {
    console.log("Checking reviews table...");
    const { data, error } = await supabase.from('reviews').select('*').limit(10);
    if (error) {
        console.error("Reviews Select Error:", error);
    } else {
        console.log("Found reviews:", data.length);
        data.forEach(r => {
            console.log(`ID: ${r.id}, Status: ${r.status}, Title: ${r.title}, Type: ${r.review_type}`);
        });
    }
}

checkReviews();

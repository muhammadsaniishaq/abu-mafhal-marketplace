const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
-- 1. Alter Drivers Table
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS user_id UUID,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 1) DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS current_location TEXT,
ADD COLUMN IF NOT EXISTS vehicle_number TEXT,
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Map current_lat to latitude if they exist
DO $$ 
BEGIN 
    UPDATE public.drivers SET latitude = current_lat WHERE latitude IS NULL;
    UPDATE public.drivers SET longitude = current_lng WHERE longitude IS NULL;
END $$;

-- 2. Create Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    type TEXT NOT NULL, -- credit or debit
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'completed',
    reference TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Allow driver reads and inserts to transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can read own transactions" ON public.transactions;
    DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
EXCEPTION WHEN OTHERS THEN
END $$;

CREATE POLICY "Users can read own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
`;

async function applySchema() {
    console.log('Applying new driver features schema...');
    
    // First, try running it via RPC
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error && error.message.includes('Could not find the function')) {
        console.log('exec_sql not found, trying run_sql...');
        const res2 = await supabase.rpc('run_sql', { sql });
        if (res2.error) {
            console.error('Error with run_sql:', res2.error);
        } else {
            console.log('Schema applied successfully via run_sql!');
        }
    } else if (error) {
        console.error('Error applying schema:', error);
    } else {
        console.log('Schema applied successfully via exec_sql!');
    }
}

applySchema();

-- Create addresses table if it doesn't exist
CREATE TABLE IF NOT EXISTS addresses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add columns if they are missing (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='addresses' AND column_name='title') THEN
        ALTER TABLE addresses ADD COLUMN title TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='addresses' AND column_name='address') THEN
        ALTER TABLE addresses ADD COLUMN address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='addresses' AND column_name='city') THEN
        ALTER TABLE addresses ADD COLUMN city TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='addresses' AND column_name='state') THEN
        ALTER TABLE addresses ADD COLUMN state TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='addresses' AND column_name='phone') THEN
        ALTER TABLE addresses ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='addresses' AND column_name='is_default') THEN
        ALTER TABLE addresses ADD COLUMN is_default BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view their own addresses" ON addresses;
CREATE POLICY "Users can view their own addresses" ON addresses FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own addresses" ON addresses;
CREATE POLICY "Users can insert their own addresses" ON addresses FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own addresses" ON addresses;
CREATE POLICY "Users can update their own addresses" ON addresses FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own addresses" ON addresses;
CREATE POLICY "Users can delete their own addresses" ON addresses FOR DELETE USING (auth.uid() = user_id);

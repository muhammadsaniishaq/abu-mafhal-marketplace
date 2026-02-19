-- Run this in your Supabase SQL Editor to fix the Chat feature

-- 1. Create the messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT,
    media_url TEXT,
    message_type TEXT DEFAULT 'text',
    read BOOLEAN DEFAULT FALSE
);

-- 2. Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies (Allow users to read/insert their own messages)

-- Allow users to read messages where they are sender OR receiver
CREATE POLICY "Users can read their own messages"
ON public.messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Allow users to insert messages where they are the sender
CREATE POLICY "Users can send messages"
ON public.messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Allow users to update (mark as read) messages they received
CREATE POLICY "Users can update their received messages"
ON public.messages FOR UPDATE
USING (auth.uid() = receiver_id);

-- 4. Create Storage Bucket for chat images if missing
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage Policies
CREATE POLICY "Anyone can upload chat images"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'chat-images' AND auth.role() = 'authenticated' );

CREATE POLICY "Anyone can view chat images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'chat-images' );

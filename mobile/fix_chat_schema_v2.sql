-- FIX V2: Handle existing table with camelCase columns
-- Specify "senderId" (quotes) to handle case sensitivity if it was created that way.

-- 1. Rename existing columns if they exist (CamelCase -> Snake_Case)
DO $$
BEGIN
    -- Rename senderId -> sender_id
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'senderId') THEN
        ALTER TABLE public.messages RENAME COLUMN "senderId" TO sender_id;
    END IF;

    -- Rename receiverId -> receiver_id
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'receiverId') THEN
        ALTER TABLE public.messages RENAME COLUMN "receiverId" TO receiver_id;
    END IF;

    -- Rename mediaUrl -> media_url
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'mediaUrl') THEN
        ALTER TABLE public.messages RENAME COLUMN "mediaUrl" TO media_url;
    END IF;

    -- Rename messageType -> message_type
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'messageType') THEN
        ALTER TABLE public.messages RENAME COLUMN "messageType" TO message_type;
    END IF;
END $$;

-- 2. Add columns if they are still missing
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;

-- 3. Ensure Policies are applied (Drop first to avoid conflicts)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own messages" ON public.messages;
CREATE POLICY "Users can read their own messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update their received messages" ON public.messages;
CREATE POLICY "Users can update their received messages" ON public.messages FOR UPDATE USING (auth.uid() = receiver_id);

-- 4. Storage Bucket Setup
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can upload chat images" ON storage.objects;
CREATE POLICY "Anyone can upload chat images" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'chat-images' AND auth.role() = 'authenticated' );

DROP POLICY IF EXISTS "Anyone can view chat images" ON storage.objects;
CREATE POLICY "Anyone can view chat images" ON storage.objects FOR SELECT USING ( bucket_id = 'chat-images' );

-- FIX V4: Explicit Type Casting for UUIDs
-- This script handles the "operator does not exist: uuid = text" error by forcing casts.

DO $$
BEGIN
    -- 1. HANDLE SENDER_ID (Target: UUID)
    -- If 'sender_id' exists AND 'senderId' exists -> Migrate data WITH CAST
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'sender_id') 
       AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'senderId') THEN
        -- Forced safe cast pattern
        BEGIN
            UPDATE public.messages SET sender_id = "senderId"::text::uuid WHERE sender_id IS NULL;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not migrate some senderId data: %', SQLERRM;
        END;
        ALTER TABLE public.messages DROP COLUMN "senderId";
    
    -- If 'sender_id' MISSING but 'senderId' EXISTS -> Rename & Type Cast
    ELSIF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'sender_id') 
       AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'senderId') THEN
        ALTER TABLE public.messages RENAME COLUMN "senderId" TO sender_id;
        ALTER TABLE public.messages ALTER COLUMN sender_id TYPE UUID USING sender_id::text::uuid;
    END IF;


    -- 2. HANDLE RECEIVER_ID (Target: UUID)
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'receiver_id') 
       AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'receiverId') THEN
        BEGIN
            UPDATE public.messages SET receiver_id = "receiverId"::text::uuid WHERE receiver_id IS NULL;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not migrate some receiverId data: %', SQLERRM;
        END;
        ALTER TABLE public.messages DROP COLUMN "receiverId";

    ELSIF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'receiver_id') 
       AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'receiverId') THEN
        ALTER TABLE public.messages RENAME COLUMN "receiverId" TO receiver_id;
        ALTER TABLE public.messages ALTER COLUMN receiver_id TYPE UUID USING receiver_id::text::uuid;
    END IF;


    -- 3. HANDLE MEDIA_URL (Target: TEXT - Safe)
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'media_url') 
       AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'mediaUrl') THEN
        UPDATE public.messages SET media_url = "mediaUrl" WHERE media_url IS NULL;
        ALTER TABLE public.messages DROP COLUMN "mediaUrl";

    ELSIF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'media_url') 
       AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'mediaUrl') THEN
        ALTER TABLE public.messages RENAME COLUMN "mediaUrl" TO media_url;
    END IF;

    -- 4. HANDLE MESSAGE_TYPE (Target: TEXT - Safe)
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'message_type') 
       AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'messageType') THEN
        UPDATE public.messages SET message_type = "messageType" WHERE message_type IS NULL;
        ALTER TABLE public.messages DROP COLUMN "messageType";

    ELSIF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'message_type') 
       AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'messageType') THEN
        ALTER TABLE public.messages RENAME COLUMN "messageType" TO message_type;
    END IF;

END $$;

-- 5. FINAL CHECK: Ensure all correct columns exist
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;

-- 6. RE-APPLY RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own messages" ON public.messages;
CREATE POLICY "Users can read their own messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update their received messages" ON public.messages;
CREATE POLICY "Users can update their received messages" ON public.messages FOR UPDATE USING (auth.uid() = receiver_id);

-- 7. STORAGE SETUP
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-images', 'chat-images', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can upload chat images" ON storage.objects;
CREATE POLICY "Anyone can upload chat images" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'chat-images' AND auth.role() = 'authenticated' );

DROP POLICY IF EXISTS "Anyone can view chat images" ON storage.objects;
CREATE POLICY "Anyone can view chat images" ON storage.objects FOR SELECT USING ( bucket_id = 'chat-images' );

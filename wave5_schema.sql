-- Add Wave 5 Features for Admin Users
-- 1. Soft-Lock (Restriction)
-- 2. Internal Audit Logs (JSONB Array)

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'is_restricted') THEN
        ALTER TABLE profiles ADD COLUMN is_restricted BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'audit_log') THEN
        ALTER TABLE profiles ADD COLUMN audit_log JSONB DEFAULT '[]';
    END IF;
END $$;

-- RPC to append to audit_log array
CREATE OR REPLACE FUNCTION append_audit_log(user_id UUID, log_entry JSONB)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET audit_log = audit_log || log_entry
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


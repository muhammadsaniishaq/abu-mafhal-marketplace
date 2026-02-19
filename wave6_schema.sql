-- Wave 6: Strategic Prediction & Automation
-- Internal Admin Collaboration Threads

CREATE TABLE IF NOT EXISTS admin_collaboration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES profiles(id),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for collaboration logs
ALTER TABLE admin_collaboration_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can see and create collaboration logs
CREATE POLICY "Admins can manage collaboration logs"
ON admin_collaboration_logs
FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

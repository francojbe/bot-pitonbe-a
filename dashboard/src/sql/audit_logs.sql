
-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT,
    old_amount NUMERIC(10,2),
    new_amount NUMERIC(10,2),
    changed_by TEXT DEFAULT 'system', -- Can eventually be user_id
    change_type TEXT NOT NULL, -- 'STATUS_CHANGE', 'PAYMENT_UPDATE', 'ORDER_CREATED', etc.
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create function to log status changes automatically (Optional, if we want DB triggers)
-- For now, we will handle this in the application layer (React) for simplicity and control
-- But good to have the schema ready.

-- 3. Enable RLS (Row Level Security)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Create Policy for Anon/Public access (If needed for now)
CREATE POLICY "Enable read access for all users" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON audit_logs FOR INSERT WITH CHECK (true);

-- Create agent_learnings table for the Self-Improvement System
CREATE TABLE IF NOT EXISTS agent_learnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source_phone TEXT, -- Reference to the conversation/client
    error_description TEXT, -- Description of the mistake made by the agent
    proposed_rule TEXT, -- The corrective rule proposed by the Auditor
    status TEXT DEFAULT 'pending', -- pending, approved, rejected, archived
    confidence_score FLOAT, -- 0.0 to 1.0 logic confidence
    applied_at TIMESTAMP WITH TIME ZONE -- When it was approved/activated
);

-- Enable RLS (Row Level Security) just in case, though usually internal scripts bypass it or have admin rights
ALTER TABLE agent_learnings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read/write for authenticated users (service role usually bypasses this)
CREATE POLICY "Allow all access to agent_learnings for authenticated users" ON agent_learnings
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

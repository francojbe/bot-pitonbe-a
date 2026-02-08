-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Add embedding column to agent_learnings table
alter table agent_learnings
add column if not exists embedding vector(1536);

-- Create a function to search for learnings
create or replace function match_learnings (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  proposed_rule text,
  error_description text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    agent_learnings.id,
    agent_learnings.proposed_rule,
    agent_learnings.error_description,
    1 - (agent_learnings.embedding <=> query_embedding) as similarity
  from agent_learnings
  where 1 - (agent_learnings.embedding <=> query_embedding) > match_threshold
  and status = 'approved'
  order by agent_learnings.embedding <=> query_embedding
  limit match_count;
end;
$$;

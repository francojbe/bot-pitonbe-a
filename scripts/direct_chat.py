import os
import sys
import io
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_KEY") or os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

def get_conversation():
    lead_id = "62355b5d-6f0b-41f1-8447-2ad843177252"
    res = supabase.table("message_logs").select("role, content, created_at").eq("lead_id", lead_id).order("created_at", desc=False).execute()
    
    logs = []
    for m in res.data:
        role = "CLIENTE" if m['role'] == 'user' else "AGENTE"
        logs.append(f"[{m['created_at'][:19]}] {role}: {m['content']}")
    
    return "\n\n".join(logs)

if __name__ == "__main__":
    print(get_conversation())

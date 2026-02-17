import os
import sys
import io
from supabase import create_client
from dotenv import load_dotenv

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
load_dotenv()

url = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_KEY") or os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

def analyze_full_lead_history():
    lead_id = "62355b5d-6f0b-41f1-8447-2ad843177252" # ID de pitron bena
    history_res = supabase.table("message_logs").select("*").eq("lead_id", lead_id).order("created_at", desc=False).execute()
    
    print(f"--- HISTORIAL COMPLETO DE CLIENTE (ID: {lead_id}) ---")
    for m in history_res.data:
        role = "CLIENTE" if m['role'] == 'user' else "AGENTE"
        print(f"[{m['created_at'][:10]}] {role}: {m['content']}")

if __name__ == "__main__":
    analyze_full_lead_history()

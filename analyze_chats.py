import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_KEY") or os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def analyze_chat():
    print("--- ANÁLISIS DE ÚLTIMOS CHATS ---")
    # Fetch recent messages ordered by creation time
    res = supabase.table("message_logs").select("role, content, created_at, lead_id").order("created_at", desc=True).limit(20).execute()
    
    # Group by lead_id to see conversations
    conversations = {}
    for row in res.data:
        lid = row.get('lead_id')
        if lid not in conversations:
            conversations[lid] = []
        conversations[lid].append(row)
        
    for lid, msgs in conversations.items():
        # Fetch lead name
        lead_res = supabase.table("leads").select("name, phone_number").eq("id", lid).execute()
        name = lead_res.data[0].get('name') if lead_res.data else "Desconocido"
        phone = lead_res.data[0].get('phone_number') if lead_res.data else ""
        
        print(f"\nCliente: {name} ({phone})")
        print("=" * 50)
        
        # Messages come in desc order, reverse them for chronological view
        for m in reversed(msgs):
            role = "🤖 AGENTE" if m['role'] == 'assistant' else "👤 CLIENTE"
            print(f"[{m['created_at']}] {role}: {m['content']}")
        print("-" * 50)

if __name__ == "__main__":
    analyze_chat()

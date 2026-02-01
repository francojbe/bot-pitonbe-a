import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_KEY") or os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

def analyze_chat():
    print("--- CHAT ANALYSIS ---")
    res = supabase.table("message_logs").select("role, content, created_at, lead_id").order("created_at", desc=True).limit(30).execute()
    
    conversations = {}
    for row in res.data:
        lid = row.get('lead_id')
        if lid not in conversations:
            conversations[lid] = []
        conversations[lid].append(row)
        
    for lid, msgs in conversations.items():
        lead_res = supabase.table("leads").select("name, phone_number").eq("id", lid).execute()
        name = lead_res.data[0].get('name') if lead_res.data else "Unknown"
        phone = lead_res.data[0].get('phone_number') if lead_res.data else ""
        
        print(f"\nClient: {name} ({phone})")
        print("-" * 20)
        
        for m in reversed(msgs):
            role = "AGENT" if m['role'] == 'assistant' else "USER"
            content = m['content'].replace('\n', ' ')
            print(f"[{m['created_at'][:19]}] {role}: {content}")

if __name__ == "__main__":
    analyze_chat()

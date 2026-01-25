
import os
import asyncio
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Falta configuración de Supabase")
    exit()

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_last_logs(limit=10):
    try:
        response = supabase.table("message_logs") \
            .select("*") \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
        
        print(f"--- ÚLTIMOS {limit} MENSAJES ---")
        for msg in response.data:
            print(f"[{msg['created_at']}] {msg['role']}: {msg['content']} (Meta: {msg.get('metadata')})")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_last_logs()

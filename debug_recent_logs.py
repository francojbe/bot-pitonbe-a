import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def check_recent_messages():
    print("--- ÚLTIMOS 5 MENSAJES DE USUARIO ---")
    res = supabase.table("message_logs").select("*").eq("role", "user").order("created_at", desc=True).limit(5).execute()
    for row in res.data:
        print(f"ID: {row.get('id')}")
        print(f"Fecha: {row.get('created_at')}")
        content = row.get('content', '')
        # Print only the first 200 chars and the last 200 chars if long
        if len(content) > 400:
            print(f"Content: {content[:200]} ... [TRUNCATED] ... {content[-200:]}")
        else:
            print(f"Content: {content}")
        print("-" * 30)



if __name__ == "__main__":
    check_recent_messages()


import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def ver_todo_reciente():
    print("--- SECUENCIA COMPLETA DE MENSAJES (POST 01:40) ---")
    try:
        # Traer todo después de una hora arbitraria para ver la sesión completa
        response = supabase.table("message_logs") \
            .select("*") \
            .gt("created_at", "2026-01-23T01:40:00") \
            .order("created_at", desc=False) \
            .execute()
            
        for msg in response.data:
            role = "👤 USER" if msg['role'] == 'user' else "🤖 BOT"
            content = msg['content'].replace('\n', ' ')[:100] # Primeros 100 chars
            print(f"[{msg['created_at'][11:19]}] {role}: {content}")
            if "IMAGEN" in msg['content'] or "ERROR" in msg['content']:
                print(f"   >>> DETALLE COMPLETO: {msg['content']}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    ver_todo_reciente()

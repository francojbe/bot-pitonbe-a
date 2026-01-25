
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def buscar_url_imagen():
    try:
        # Buscamos el último mensaje del usuario que contenga "RECIBIDO" (indicador de media)
        response = supabase.table("message_logs") \
            .select("content, created_at") \
            .eq("role", "user") \
            .ilike("content", "%RECIBID%") \
            .order("created_at", desc=True) \
            .limit(5) \
            .execute()
        
        if response.data:
            print(f"--- ENCONTRADOS {len(response.data)} MENSAJES CON MEDIA ---")
            for msg in response.data:
                print(f"📅 Fecha: {msg['created_at']}")
                print(f"🖼️ Contenido: {msg['content']}")
                print("-" * 30)
        else:
            print("❌ No se encontraron mensajes con imágenes recibidas en el log reciente.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    buscar_url_imagen()

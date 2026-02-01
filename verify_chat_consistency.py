import os
import sys
import io
from supabase import create_client
from dotenv import load_dotenv

# Set default encoding to UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

load_dotenv()

url = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_KEY") or os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

def verify_latest_chat():
    # 1. Obtener el último mensaje registrado
    latest_msg_res = supabase.table("message_logs").select("*").order("created_at", desc=True).limit(2).execute()
    
    if not latest_msg_res.data:
        print("No hay mensajes registrados.")
        return

    # Usualmente el último es la respuesta de la IA o el mensaje del usuario
    # Vamos a buscar el último intercambio (User + Assistant) del mismo lead
    lead_id = latest_msg_res.data[0]['lead_id']
    
    # 2. Obtener datos del Lead en la DB
    lead_res = supabase.table("leads").select("*").eq("id", lead_id).execute()
    db_lead = lead_res.data[0] if lead_res.data else None
    
    # 3. Obtener el historial corto de ese lead para ver qué dijo de su nombre
    history_res = supabase.table("message_logs").select("*").eq("lead_id", lead_id).order("created_at", desc=True).limit(5).execute()
    
    print("--- VERIFICACIÓN DE IDENTIDAD Y REGISTRO ---")
    if db_lead:
        print(f"Nombre en Base de Datos: '{db_lead.get('name')}'")
        print(f"Teléfono: {db_lead.get('phone_number')}")
    else:
        print("El Lead no existe en la base de datos.")

    print("\nÚltimos mensajes en el chat:")
    for m in reversed(history_res.data):
        role = "CLIENTE" if m['role'] == 'user' else "AGENTE"
        print(f"[{role}]: {m['content']}")

if __name__ == "__main__":
    verify_latest_chat()

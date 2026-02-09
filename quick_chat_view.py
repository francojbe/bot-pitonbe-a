import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# Obtener últimos 30 mensajes
response = supabase.table("message_logs")\
    .select("*, leads(name, phone_number)")\
    .order("created_at", desc=True)\
    .limit(30)\
    .execute()

print("ÚLTIMAS CONVERSACIONES DEL AGENTE")
print("=" * 100)

for msg in response.data:
    lead_name = msg.get('leads', {}).get('name', 'Desconocido') if msg.get('leads') else 'Desconocido'
    role = "CLIENTE" if msg['role'] == 'user' else "RICHARD"
    content = msg['content'][:150] + "..." if len(msg['content']) > 150 else msg['content']
    intent = f" [{msg['intent']}]" if msg.get('intent') else ""
    
    print(f"\n{role} ({lead_name}){intent}:")
    print(f"  {content}")
    print(f"  Fecha: {msg['created_at']}")

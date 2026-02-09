import os
from dotenv import load_dotenv
from supabase import create_client
from datetime import datetime, timedelta
import json

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# Obtener conversaciones de los últimos 3 días
three_days_ago = (datetime.now() - timedelta(days=3)).isoformat()

response = supabase.table("message_logs")\
    .select("*, leads(name, phone_number)")\
    .gte("created_at", three_days_ago)\
    .order("created_at", desc=True)\
    .limit(100)\
    .execute()

messages = response.data

# Agrupar por lead
conversations = {}
for msg in messages:
    lead_id = msg.get('lead_id')
    if lead_id not in conversations:
        lead_info = msg.get('leads', {})
        conversations[lead_id] = {
            'name': lead_info.get('name', 'Desconocido') if lead_info else 'Desconocido',
            'phone': lead_info.get('phone_number', 'Sin teléfono') if lead_info else 'Sin teléfono',
            'messages': []
        }
    conversations[lead_id]['messages'].append(msg)

# Crear reporte
report = []
report.append("=" * 100)
report.append("ANÁLISIS DE CONVERSACIONES RECIENTES (Últimos 3 días)")
report.append("=" * 100)
report.append(f"\nTotal de mensajes: {len(messages)}")
report.append(f"Conversaciones únicas: {len(conversations)}\n")

for idx, (lead_id, conv) in enumerate(conversations.items(), 1):
    report.append("\n" + "-" * 100)
    report.append(f"CONVERSACIÓN #{idx}: {conv['name']} ({conv['phone']})")
    report.append("-" * 100)
    report.append(f"Total mensajes: {len(conv['messages'])}\n")
    
    # Mostrar mensajes (más recientes primero)
    for msg in conv['messages'][:10]:  # Limitar a 10 mensajes por conversación
        timestamp = datetime.fromisoformat(msg['created_at'].replace('Z', '+00:00'))
        role = "👤 CLIENTE" if msg['role'] == 'user' else "🤖 RICHARD"
        intent = f" [{msg['intent']}]" if msg.get('intent') else ""
        
        report.append(f"\n{role}{intent} - {timestamp.strftime('%Y-%m-%d %H:%M')}")
        report.append(f"{msg['content']}\n")
    
    if len(conv['messages']) > 10:
        report.append(f"... y {len(conv['messages']) - 10} mensajes más\n")

# Estadísticas
report.append("\n" + "=" * 100)
report.append("ESTADÍSTICAS")
report.append("=" * 100)

user_msgs = sum(1 for msg in messages if msg['role'] == 'user')
assistant_msgs = sum(1 for msg in messages if msg['role'] == 'assistant')
total_tokens = sum(msg.get('tokens_used') or 0 for msg in messages)

report.append(f"\nMensajes de clientes: {user_msgs}")
report.append(f"Mensajes de Richard: {assistant_msgs}")
report.append(f"Total tokens: {total_tokens:,}")

# Intents
all_intents = [msg.get('intent') for msg in messages if msg.get('intent')]
intent_counts = {}
for intent in all_intents:
    intent_counts[intent] = intent_counts.get(intent, 0) + 1

if intent_counts:
    report.append("\nIntents más frecuentes:")
    for intent, count in sorted(intent_counts.items(), key=lambda x: x[1], reverse=True):
        report.append(f"  • {intent}: {count}")

# Guardar reporte
report_text = '\n'.join(report)
with open('REPORTE_CONVERSACIONES.txt', 'w', encoding='utf-8') as f:
    f.write(report_text)

print(report_text)
print(f"\n✅ Reporte guardado en: REPORTE_CONVERSACIONES.txt")

"""
🕵️‍♂️ Juez Silencioso (Auditor de Conversaciones)
Analiza conversaciones recientes y propone reglas de mejora.
"""
import os
import json
from typing import List, Dict
import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

load_dotenv()

# Configuración
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not all([SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY]):
    print("❌ Error: Faltan claves de entorno.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
llm = ChatOpenAI(model_name="gpt-4o", temperature=0.0) # Modelo inteligente para auditar

def get_recent_conversations(days=1) -> Dict[str, List[Dict]]:
    """Obtiene logs de los últimos N días agrupados por teléfono."""
    print(f"📥 Descargando conversaciones de los últimos {days} días...")
    
    cutoff = (datetime.datetime.now() - datetime.timedelta(days=days)).isoformat()
    
    # Obtener mensajes
    try:
        res = supabase.table("message_logs") \
            .select("*") \
            .gte("timestamp", cutoff) \
            .order("timestamp", desc=True) \
            .execute()
        
        logs = res.data
        conversations = {}
        
        for log in logs:
            phone = log.get("phone_number")
            if not phone: continue
            
            if phone not in conversations:
                conversations[phone] = []
            
            conversations[phone].append({
                "role": log.get("role"),
                "content": log.get("content"),
                "timestamp": log.get("timestamp")
            })
            
        # Ordenar cronológicamente
        for phone in conversations:
            conversations[phone].sort(key=lambda x: x["timestamp"])
            
        return conversations
    except Exception as e:
        print(f"❌ Error obteniendo logs: {e}")
        return {}

def analyze_conversation(phone: str, messages: List[Dict]):
    """Usa GPT-4o para auditar una conversación."""
    
    # Formatear chat como string
    chat_text = ""
    for m in messages:
        role = "🤖 AGENTE" if m["role"] == "assistant" else "👤 CLIENTE"
        chat_text += f"{role}: {m['content']}\n"
    
    print(f"🧠 Analizando chat con {phone} ({len(messages)} mensajes)...")
    
    audit_prompt = f"""
    Eres el AUDITOR SENIOR de un agente de IA de una imprenta.
    Tu trabajo es encontrar ERRORES SUTILES en el comportamiento del agente y proponer REGLAS para evitarlos.

    CONTEXTO DE NEGOCIO:
    - Imprenta: PB Imprenta.
    - Servicios: Tarjetas, Flyers, Pendones.
    - Diseño: Se cobra aparte (Básico/Medio/Premium). Si hay diseño, NO se pide PDF.
    - Pagos: Transferencia Banco Estado.
    - Estilo: Amable, usa emojis, profesional.

    CONVERSACIÓN A AUDITAR:
    {chat_text}

    TAREA:
    1. Detecta si el agente cometió algún error (lógico, de tono, de proceso, duplicación de órdenes, confundir diseño, etc.).
    2. Si todo estuvo perfecto, responde "OK".
    3. Si hubo error, describe el error y redacta una "REGLA CORRECTIVA" concisa para agregar al prompt del sistema.

    FORMATO JSON DE RESPUESTA:
    {{
        "error_detected": true/false,
        "description": "Descripción breve del error...",
        "severity": "low/medium/high",
        "proposed_rule": "Texto exacto de la regla a agregar..."
    }}
    """
    
    try:
        response = llm.invoke([
            SystemMessage(content="Eres un sistema de auditoría de calidad para IA."),
            HumanMessage(content=audit_prompt)
        ])
        
        content = response.content.strip()
        # Limpiar markdown json si existe
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "")
        
        return json.loads(content)
        
    except Exception as e:
        print(f"❌ Error en análisis LLM: {e}")
        return None

def save_learning(phone: str, analysis: Dict):
    """Guarda el aprendizaje en Supabase."""
    if not analysis.get("error_detected"):
        print(f"✅ Chat con {phone}: Comportamiento correcto.")
        return

    print(f"⚠️ DETECTADO ERROR ({analysis.get('severity')}): {analysis.get('description')}")
    print(f"💡 PROPUESTA: {analysis.get('proposed_rule')}")
    
    record = {
        "source_phone": phone,
        "error_description": analysis.get("description"),
        "proposed_rule": analysis.get("proposed_rule"),
        "status": "pending",
        "confidence_score": 0.95 # Simulado por ahora
    }
    
    try:
        supabase.table("agent_learnings").insert(record).execute()
        print("💾 Lección guardada en base de datos.")
    except Exception as e:
        print(f"⚠️ No se pudo guardar en DB (¿Tabla no existe?). Guardando en local.")
        # Fallback local
        with open("local_agent_learnings.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

def main():
    conversations = get_recent_conversations(days=1)
    print(f"📊 Encontradas {len(conversations)} conversaciones activas hoy.")
    
    for phone, msgs in conversations.items():
        if len(msgs) < 2: continue # Ignorar chats vacíos
        
        analysis = analyze_conversation(phone, msgs)
        if analysis:
            save_learning(phone, analysis)

if __name__ == "__main__":
    main()

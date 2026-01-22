import os
import requests
import json
import logging
from typing import List, Optional
from fastapi import FastAPI, Request
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage, AIMessage
from supabase import create_client, Client

# Logging profesional
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cargar variables
load_dotenv()

# Configuración
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY")
INSTANCE_NAME = os.getenv("WHATSAPP_INSTANCE_NAME")

# Inicializar
app = FastAPI(title="WhatsApp RAG Bot Enterprise")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
llm = ChatOpenAI(model_name="gpt-4o-mini", temperature=0.3, openai_api_key=OPENAI_API_KEY)

# --- GESTIÓN DE LEADS (CRM) ---
def get_or_create_lead(phone: str, push_name: str = None) -> str:
    """Busca un lead por teléfono o lo crea si es nuevo. Retorna su UUID."""
    try:
        # 1. Buscar lead existente
        response = supabase.table("leads").select("id, name").eq("phone_number", phone).execute()
        
        if response.data:
            lead_id = response.data[0]['id']
            # Actualizar timestamp de última interacción
            supabase.table("leads").update({"last_interaction": "now()"}).eq("id", lead_id).execute()
            
            # Si no teníamos nombre y WhatsApp nos da uno (pushName), tratar de guardarlo
            if push_name and not response.data[0]['name']:
                 supabase.table("leads").update({"name": push_name}).eq("id", lead_id).execute()
            
            return lead_id
        else:
            # 2. Crear nuevo lead
            print(f"✨ Nuevo Lead detectado: {phone}")
            new_lead = {
                "phone_number": phone,
                "name": push_name, # Guardamos el nombre que sale en WhatsApp si existe
                "status": "new"
            }
            response = supabase.table("leads").insert(new_lead).execute()
            return response.data[0]['id']
            
    except Exception as e:
        logger.error(f"Error gestionando Lead: {e}")
        return None

# --- FUNCIONES DE MEMORIA PRO ---
def get_chat_history_pro(lead_id: str, limit: int = 10) -> List[Any]:
    """Obtiene historial vinculado al LEAD UUID."""
    if not lead_id: return []
    try:
        response = supabase.table("message_logs") \
            .select("role, content") \
            .eq("lead_id", lead_id) \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
        
        mensajes_db = response.data[::-1]
        
        historial = []
        for msg in mensajes_db:
            if msg['role'] == 'user':
                historial.append(HumanMessage(content=msg['content']))
            else:
                historial.append(AIMessage(content=msg['content']))
        return historial
    except Exception as e:
        logger.error(f"Error historial PRO: {e}")
        return []

def save_message_pro(lead_id: str, phone: str, role: str, content: str, intent: str = None):
    """Guarda mensaje con metadatos enriquecidos."""
    if not lead_id: return
    try:
        supabase.table("message_logs").insert({
            "lead_id": lead_id,
            "phone_number": phone,
            "role": role,
            "content": content,
            "intent": intent, # Aquí podríamos poner lógica de clasificación
            "metadata": {"source": "whatsapp_rag_v2"}
        }).execute()
    except Exception as e:
        logger.error(f"Error guardando logs PRO: {e}")

# --- INTELIGENCIA RAG ---
def buscar_contexto(pregunta: str) -> str:
    try:
        vector = embeddings.embed_query(pregunta)
        response = supabase.rpc("match_documents", {
            "query_embedding": vector,
            "match_threshold": 0.5,
            "match_count": 3
        }).execute()
        
        matches = response.data
        if not matches: return ""
        return "\n\n---\n\n".join([item['content'] for item in matches])
    except Exception as e:
        logger.error(f"Error RAG: {e}")
        return ""

def procesar_mensaje_ia_pro(lead_id: str, phone: str, pregunta: str) -> str:
    try:
        # 1. Recuperar contexto y memoria
        contexto_rag = buscar_contexto(pregunta)
        historial = get_chat_history_pro(lead_id)
        
        # 2. PROMPT MAESTRO (Versión Enterprise)
        # Incluimos info del lead si la tenemos
        system_prompt_text = f"""
Eres el Asistente Comercial de **Pitrón Beña Impresión**.
Tu objetivo: Vender y asesorar con precisión técnica usando SOLO la base de conocimiento.

BASE DE CONOCIMIENTO (Verdad Absoluta):
{contexto_rag}

ESTRATEGIA DE ATENCIÓN:
1. **Identificación**: Si no sabes el nombre del cliente, pregúntalo amablemente al inicio.
2. **Flujo de Cotización (The Funnel)**:
   - FASE 1: Entender qué quiere (Producto). Da opciones numeradas.
   - FASE 2: Obtener CANTIDAD explícita.
   - FASE 3: Definir DISEÑO (¿Tiene o no tiene?).
   - FASE 4: Cotización final con calculadora mental.
     * Si no tiene diseño: Sumar $6.000 (o lo que diga el contexto).
     * Precio Final = (Neto + Diseño) * 1.19 (IVA).
3. **Personalidad**: Eres eficiente, usas emojis 🖨️✨ y eres muy educado.

REGLAS DE SEGURIDAD:
- JAMÁS inventes precios.
- Si la info no está en el CONTEXTO, di "No tengo esa información en este momento" y ofrece derivar con un humano.
- Datos bancarios SOLO al confirmar la venta explícitamente.

Formato de Cotización Visual:
🪪 *Producto:* ...
📦 *Cantidad:* ...
💰 *Neto:* ...
💵 *TOTAL:* ... (IVA Inc.)
"""
        
        system_message = SystemMessage(content=system_prompt_text)
        
        messages = [system_message] + historial + [HumanMessage(content=pregunta)]
        
        # 3. Invocar IA
        resp_ia = llm.invoke(messages)
        contenido_resp = resp_ia.content
        
        # 4. Guardar todo
        save_message_pro(lead_id, phone, "user", pregunta)
        save_message_pro(lead_id, phone, "assistant", contenido_resp)
        
        return contenido_resp

    except Exception as e:
        logger.error(f"Error Critical IA: {e}")
        return "⚠️ Tuve un error de conexión interno. Por favor escríbeme de nuevo en 1 minuto."

# --- WEBHOOK WHATSAPP ---
def enviar_whatsapp(numero: str, texto: str):
    try:
        base_url = EVOLUTION_API_URL.rstrip('/')
        from urllib.parse import quote
        instance_encoded = quote(INSTANCE_NAME)
        url = f"{base_url}/message/sendText/{instance_encoded}"
        
        payload = {
            "number": numero,
            "options": {"delay": 1500, "presence": "composing"}, # Delay para parecer humano
            "textMessage": {"text": texto},
            "text": texto
        }
        
        requests.post(
            url, 
            json=payload, 
            headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"}
        ).raise_for_status()
        
    except Exception as e:
        logger.error(f"Error enviando WhatsApp: {e}")

@app.post("/webhook")
async def webhook_whatsapp(request: Request):
    try:
        payload = await request.json()
        if isinstance(payload, list): payload = payload[0]
        body = payload.get("body", {}) if "body" in payload else payload

        if body.get("event") != "messages.upsert": return {"status": "ignored"}
        
        data = body.get("data", {})
        key = data.get("key", {})
        message = data.get("message", {})
        push_name = data.get("pushName") # Nombre que tiene puesto el usuario en WhatsApp
        
        if key.get("fromMe") or "g.us" in key.get("remoteJid", ""):
            return {"status": "ignored"}

        texto = message.get("conversation") or message.get("extendedTextMessage", {}).get("text", "")
        if not texto: return {"status": "ignored"}

        numero_full = key.get("remoteJid", "")
        numero_limpio = numero_full.split("@")[0]
        
        logger.info(f"📩 {numero_limpio} ({push_name}): {texto}")
        
        # 1. Obtener/Crear Lead (CRM)
        lead_id = get_or_create_lead(numero_limpio, push_name)
        
        # 2. Procesar respuesta
        resp_ia = procesar_mensaje_ia_pro(lead_id, numero_limpio, texto)
        
        # 3. Enviar
        enviar_whatsapp(numero_limpio, resp_ia)
        
        return {"status": "processed"}

    except Exception as e:
        logger.error(f"Crash en Webhook: {e}")
        return {"status": "error"}

@app.get("/")
def health(): return {"status": "online", "mode": "enterprise"}

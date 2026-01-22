import os
import requests
import json
import logging
import asyncio
from typing import List, Optional, Any, Dict
from fastapi import FastAPI, Request, BackgroundTasks
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage, AIMessage
from supabase import create_client, Client

# Logging
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
app = FastAPI(title="WhatsApp RAG Bot Enterprise V2")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
llm = ChatOpenAI(model_name="gpt-4o-mini", temperature=0.1, openai_api_key=OPENAI_API_KEY) # Temp baja para matemáticas

# --- BUFFER DE MENSAJES (Memoria Volátil) ---
# Diccionario para agrupar mensajes: { "569...": {"timer": Task, "messages": ["Hola", "precio"]} }
message_buffer: Dict[str, Any] = {}
BUFFER_DELAY = 4.0 # Segundos a esperar por más mensajes

# --- GESTIÓN DE LEADS ---
def get_or_create_lead(phone: str, push_name: str = None) -> str:
    try:
        response = supabase.table("leads").select("id, name").eq("phone_number", phone).execute()
        if response.data:
            supabase.table("leads").update({"last_interaction": "now()"}).eq("id", response.data[0]['id']).execute()
            return response.data[0]['id']
        else:
            new_lead = {"phone_number": phone, "name": push_name, "status": "new"}
            response = supabase.table("leads").insert(new_lead).execute()
            return response.data[0]['id']
    except Exception as e:
        logger.error(f"Error Lead: {e}")
        return None

# --- HISTORIAL Y LOGS ---
def get_chat_history_pro(lead_id: str, limit: int = 10):
    if not lead_id: return []
    try:
        response = supabase.table("message_logs").select("role, content").eq("lead_id", lead_id).order("created_at", desc=True).limit(limit).execute()
        mensajes = []
        for msg in response.data[::-1]:
            if msg['role'] == 'user': mensajes.append(HumanMessage(content=msg['content']))
            else: mensajes.append(AIMessage(content=msg['content']))
        return mensajes
    except: return []

def save_message_pro(lead_id: str, phone: str, role: str, content: str):
    if not lead_id: return
    try:
        supabase.table("message_logs").insert({
            "lead_id": lead_id, "phone_number": phone, "role": role, "content": content
        }).execute()
    except Exception as e: logger.error(f"Error save logs: {e}")

# --- INTELIGENCIA ---
def buscar_contexto(pregunta: str) -> str:
    try:
        vector = embeddings.embed_query(pregunta)
        response = supabase.rpc("match_documents", {"query_embedding": vector, "match_threshold": 0.5, "match_count": 4}).execute()
        if not response.data: return ""
        return "\n\n---\n\n".join([item['content'] for item in response.data])
    except: return ""

async def procesar_y_responder(phone: str, mensajes_acumulados: List[str], push_name: str):
    """Procesa el bloque completo de mensajes."""
    try:
        texto_completo = " ".join(mensajes_acumulados)
        logger.info(f"🤖 Procesando bloque para {phone}: {texto_completo}")
        
        lead_id = get_or_create_lead(phone, push_name)
        
        # Recuperar nombre real del cliente desde la DB (por si ya lo teníamos guardado o es el push_name)
        lead_data = supabase.table("leads").select("name").eq("id", lead_id).execute()
        cliente_nombre = lead_data.data[0]['name'] if lead_data.data else "Cliente"
        
        historial = get_chat_history_pro(lead_id)
        contexto = buscar_contexto(texto_completo)
        
        # PROMPT REFINADO V3 (Estética WhatsApp + Datos Bancarios + NOMBRE)
        prompt = f"""
Eres el Asistente Virtual Oficial de **Pitrón Beña Impresión**.
Tu cliente se llama: **{cliente_nombre}**. Úsalo para dirigirte a él/ella con calidez.
Tu tono es: Cordial, profesional y eficiente 🖨️✨.

BASE DE CONOCIMIENTO (Verdad Absoluta):
{contexto}

REGLAS DE FORMATO (CRÍTICO PARA WHATSAPP):
1. **NO uses Markdown de títulos** (NADA de #, ##, ###). Se ven mal en WhatsApp.
2. Usa **negritas** (*) para resaltar precios y productos importantes.
3. Usa emojis para listar (ej: 🔹 Opción 1).
4. Deja doble espacio entre párrafos para que sea legible.

REGLAS DE COMPORTAMIENTO:
1. **Saludo**: Si el historial es corto o saludan, di:
   "¡Hola {cliente_nombre}! 👋 Bienvenido a Pitrón Beña. Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?"
   (Si pregunta precio directo, responde directo pero usando el nombre al final ej: "...espero te sirva, Franco").

2. **Cálculo Matemático**:
   - Fórmula: (Neto + Diseño) * 1.19 = Total.
   - Ejemplo: $10.000 neto + $0 diseño = $10.000 -> x 1.19 = $11.900 Total.
   - Muestra el precio final claramente.

3. **CIERRE / PAGOS**:
   - Si el cliente pide pagar, cuenta, transferencia o "dame los datos":
   🏦 **Datos Bancarios:**
   Banco Santander
   Titular: LUIS PITRON
   RUT: 15355843-4
   Cuenta Corriente: 79-63175-2
   (Indica que envíe el comprobante por aquí).

Formato de Cotización Visual:
🪪 *Producto:* [Nombre]
📝 *Descripción:* [Detalle]
📦 *Cantidad:* [N]
💰 *Neto:* $[Valor]
🎨 *Diseño:* $[Valor]
💵 *TOTAL:* $[Calculo Total] (IVA Inc.)
"""
        
        system_img = SystemMessage(content=prompt)
        messages_to_ai = [system_img] + historial + [HumanMessage(content=texto_completo)]
        
        respuesta = llm.invoke(messages_to_ai)
        resp_content = respuesta.content
        
        # Guardar (User: texto completo, AI: respuesta)
        save_message_pro(lead_id, phone, "user", texto_completo)
        save_message_pro(lead_id, phone, "assistant", resp_content)
        
        # Enviar
        enviar_whatsapp(phone, resp_content)

    except Exception as e:
        logger.error(f"Error procesando bloque: {e}")

# --- CONTROLADOR DEL BUFFER ---
async def buffer_manager(phone: str, push_name: str):
    """Espera X segundos. Si no llegan más mensajes, dispara el proceso."""
    await asyncio.sleep(BUFFER_DELAY)
    
    # Verificar si seguimos siendo la tarea activa (no hemos sido cancelados/reemplazados)
    if phone in message_buffer:
        data = message_buffer.pop(phone) # Sacamos los mensajes y limpiamos el buffer
        mensajes = data["messages"]
        # Disparar procesamiento en background real
        await procesar_y_responder(phone, mensajes, push_name)

# --- WEBHOOK ---
def enviar_whatsapp(numero: str, texto: str):
    try:
        base_url = EVOLUTION_API_URL.rstrip('/')
        from urllib.parse import quote
        instance_encoded = quote(INSTANCE_NAME)
        url = f"{base_url}/message/sendText/{instance_encoded}"
        payload = {
            "number": numero, "options": {"delay": 1000, "presence": "composing"},
            "textMessage": {"text": texto}, "text": texto
        }
        requests.post(url, json=payload, headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"})
    except Exception as e: logger.error(f"Error envío WA: {e}")

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
        
        if key.get("fromMe") or "g.us" in key.get("remoteJid", ""): return {"status": "ignored"}

        texto = message.get("conversation") or message.get("extendedTextMessage", {}).get("text", "")
        if not texto: return {"status": "ignored"}

        numero = key.get("remoteJid", "").split("@")[0]
        push_name = data.get("pushName")

        # --- LÓGICA DE BUFFER ---
        # Si ya hay un timer corriendo para este numero, lo cancelamos (reset del reloj)
        if numero in message_buffer:
            message_buffer[numero]["timer"].cancel()
            message_buffer[numero]["messages"].append(texto)
        else:
            message_buffer[numero] = {"messages": [texto]}
        
        # Iniciamos nuevo timer
        task = asyncio.create_task(buffer_manager(numero, push_name))
        message_buffer[numero]["timer"] = task
        
        return {"status": "buffered"}

    except Exception as e:
        logger.error(f"Error webhook: {e}")
        return {"status": "error"}

@app.get("/")
def health(): return {"status": "online", "buffer": "active"}

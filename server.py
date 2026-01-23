import os
import requests
import json
import logging
import asyncio
from typing import List, Optional, Any, Dict
from fastapi import FastAPI, Request, BackgroundTasks
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
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

def save_message_pro(lead_id: str, phone: str, role: str, content: str, intent: str = None):
    if not lead_id: return
    try:
        supabase.table("message_logs").insert({
            "lead_id": lead_id, "phone_number": phone, "role": role, "content": content, "intent": intent
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
        
        # PROMPT REFINADO V6 (Flujo Conversacional Estricto + Anti-Markdown)
        prompt = f"""
Eres el Asistente Virtual Oficial de **Pitrón Beña Impresión**.
Tu cliente actual es: **{cliente_nombre}**.
Estilo: Breve, útil y profesional 🖨️.

BASE DE CONOCIMIENTO:
{contexto}

🚨 GESTIÓN DE NOMBRES:
Si detectas un nombre nuevo (ej: "Soy Pedro"), inicia con: `[[UPDATE_NAME: Pedro]]`.

⛔ REGLAS DE FORMATO (CRÍTICAS):
1. **JAMÁS uses #, ## o ### para títulos.** (Se ven horribles en WhatsApp).
2. Usa **negritas (*texto*)** solo para resaltar el producto o precio final.
3. Para listas usa emojis:
   🔹 Opción A
   🔹 Opción B

⛔ REGLAS DE FLUJO COMERCIAL:
1. **Preguntas de Precio ("¿Cuánto vale X?"):**
   - 🛑 NO des el precio final aún.
   - ❓ Pregunta primero: "¿Qué cantidad necesitas?" y "¿Tienes el diseño?".

2. **Cliente Indeciso / Preguntas Generales ("¿Qué tipos tienen?"):**
   - ✅ MUESTRA las opciones disponibles (ej: "Tenemos impresión por 1 lado, 2 lados, con polilaminado...").
   - Usa una lista con emojis.
   - Cierra preguntando: "¿Cuál de estas opciones te interesa cotizar?".

3. **Cálculo Final (Solo con todos los datos):**
   - Fórmula: (Neto + Diseño) * 1.19 = Total.
   - Desglose claro.

4. **Datos Bancarios**:
   - ENTREGAR INMEDIATAMENTE si piden pagar o transfieren.
   🏦 **Datos Transferencia:**
   Banco: Santander
   Tipo: Cta Corriente
   N°: 79-63175-2
   Titular: LUIS PITRON
   RUT: 15.355.843-4
   *(Favor enviar comprobante)*.

5. **Recepción de Archivos/Diseños**:
   - Si el mensaje dice `[ARCHIVO RECIBIDO]` o el usuario envía una imagen/PDF:
     - Confirma la recepción: "✅ He recibido tu archivo/diseño."
     - Si es el comprobante, agradece y di que pasaremos el pedido a producción.
     - Si es el diseño, confirma que lo revisaremos.

Formato de Cotización Final:
🪪 *Producto:* [Nombre]
📦 *Cantidad:* [N]
💰 *Neto:* $[Valor]
🎨 *Diseño:* $[Valor]
💵 *TOTAL:* $[Total con IVA] (IVA Inc.)
"""
        
        system_img = SystemMessage(content=prompt)
        messages_to_ai = [system_img] + historial + [HumanMessage(content=texto_completo)]
        
        respuesta = llm.invoke(messages_to_ai)
        resp_content = respuesta.content
        
        # --- LÓGICA DE INTERCEPTACIÓN "UPDATE_NAME" ---
        import re
        match = re.search(r"\[\[UPDATE_NAME:\s*(.*?)\]\]", resp_content)
        if match:
            nuevo_nombre = match.group(1).strip()
            # 1. Actualizar DB
            print(f"🔄 Actualizando nombre lead {lead_id} a: {nuevo_nombre}")
            try:
                supabase.table("leads").update({"name": nuevo_nombre}).eq("id", lead_id).execute()
            except Exception as e:
                logger.error(f"Error actualizando nombre: {e}")
            
            # 2. Limpiar etiqueta del mensaje visible
            resp_content = resp_content.replace(match.group(0), "").strip()

        # Guardar logs
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

        # --- UNWRAPPER RECURSIVO PARA MENSAJES ANIDADOS ---
        def unwrap_message(msg_dict):
            """Desempaqueta mensajes anidados como viewOnceMessage, ephemeralMessage, etc."""
            if not msg_dict: return {}
            # Lista de claves conocidas que envuelven el mensaje real
            wrapper_keys = ["viewOnceMessage", "viewOnceMessageV2", "ephemeralMessage", "documentWithCaptionMessage"]
            
            for k in wrapper_keys:
                if k in msg_dict and "message" in msg_dict[k]:
                    return unwrap_message(msg_dict[k]["message"])
            
            return msg_dict

        # Desempaquetar el mensaje real
        real_message = unwrap_message(message)

        # [CRÍTICO] Inyectar campos 'base64' y 'mediaUrl' de Evolution API (que están en el padre dat, NO en message)
        # en el mensaje real 'imageMessage' o 'documentMessage' si existen.
        # Esto soluciona el bug donde 'real_message' solo tenía la URL interna de WhatsApp.
        evolution_base64 = data.get("base64")
        evolution_media_url = data.get("mediaUrl")

        if evolution_base64 or evolution_media_url:
            # FIX: Asegurar que extraemos desde 'data' y no 'message'
            # Buscar si el mensaje real es de un tipo compatible (imagen/documento) y enriquecerlo
            for media_type in ["imageMessage", "documentMessage", "audioMessage", "videoMessage", "stickerMessage"]:
                if media_type in real_message:
                    logger.info(f"💉 Inyectando datos de Evolution en {media_type}")
                    if evolution_base64:
                        real_message[media_type]["base64"] = evolution_base64
                    if evolution_media_url:
                        real_message[media_type]["mediaUrl"] = evolution_media_url
                    break

        # --- EXTRACCIÓN Y SUBIDA DE MEDIOS ---
        texto = ""
        media_url = None
        
        # Helper robusto para guardar medios (B64 o URL -> Supabase)
        def save_media_to_supabase(b64_data, file_url, mime, ext):
            file_bytes = None
            import base64
            import time

            # 1. Intentar decode B64
            if b64_data and len(b64_data) > 20 and not b64_data.startswith("http"):
                try:
                    file_bytes = base64.b64decode(b64_data)
                except Exception as e:
                    logger.error(f"Error base64 decode: {e}")
            
            # 2. Si no hay B64 válido, intentar descargar URL
            if not file_bytes and file_url and file_url.startswith("http"):
                try:
                    logger.info(f"📥 Descargando media desde: {file_url}")
                    # Timeout corto para no bloquear el webhook
                    resp = requests.get(file_url, timeout=15)
                    if resp.status_code == 200:
                        file_bytes = resp.content
                    else:
                        logger.warning(f"Fallo descarga media {resp.status_code}")
                except Exception as e:
                    logger.error(f"Error downloading media: {e}")

            # 3. Subir a Supabase si tenemos bytes
            if file_bytes:
                try:
                    filename = f"{key.get('remoteJid')}_{int(time.time())}.{ext}"
                    path = f"inbox/{filename}"
                    # upsert=True por si acaso
                    supabase.storage.from_("chat-media").upload(path, file_bytes, {"content-type": mime, "upsert": "true"})
                    public_url = supabase.storage.from_("chat-media").get_public_url(path)
                    logger.info(f"✅ Media guardada en Supabase: {public_url}")
                    return public_url
                except Exception as e:
                    logger.error(f"Error uploading to Supabase: {e}")
            
            # 4. Fallback: Devolver URL original si no pudimos procesarla internamente
            return file_url

        # [PROCESAMIENTO SEGURO DEL CONTENIDO]
        try:
            # 1. Texto plano
            if "conversation" in real_message:
                texto = real_message["conversation"]
            elif "extendedTextMessage" in real_message:
                texto = real_message["extendedTextMessage"].get("text", "")
            
            # 2. Imágenes
            elif "imageMessage" in real_message:
                img_msg = real_message["imageMessage"]
                caption = img_msg.get("caption", "")
                
                # 'base64' y 'mediaUrl' ya fueron inyectados en real_message[type] si existían en 'data'
                b64 = img_msg.get("base64") 
                url_msg = img_msg.get("mediaUrl") or img_msg.get("url")
                
                # Intentar guardar (B64 o Download URL)
                final_url = save_media_to_supabase(b64, url_msg, "image/jpeg", "jpg")
                
                if final_url:
                    texto = f"[IMAGEN RECIBIDA: {final_url}] {caption}"
                else:
                    # Fallback a URL original (interna o minio) si falla supabase
                    fallback_url = url_msg or "[URL NO DISPONIBLE]"
                    texto = f"[IMAGEN RECIBIDA: {fallback_url}] {caption}"

            # 3. Documentos
            elif "documentMessage" in real_message:
                doc_msg = real_message["documentMessage"]
                filename = doc_msg.get("title", "doc")
                caption = doc_msg.get("caption", "")
                
                b64 = doc_msg.get("base64")
                url_msg = doc_msg.get("mediaUrl") or doc_msg.get("url")
                mime_type = doc_msg.get("mimetype", "application/pdf")
                
                # Simple mapeo de extensión
                ext = "pdf"
                if "image" in mime_type: ext = "jpg"
                elif "word" in mime_type: ext = "docx"
                elif "excel" in mime_type: ext = "xlsx"
                
                final_url = save_media_to_supabase(b64, url_msg, mime_type, ext)

                if final_url:
                    texto = f"[DOCUMENTO RECIBIDO: {filename} - URL: {final_url}] {caption}"
                else:
                    fallback_url = url_msg or "[URL NO DISPONIBLE]"
                    texto = f"[DOCUMENTO RECIBIDO: {filename}] {caption}"
                    
        except Exception as e:
            logger.error(f"🔥 CRASH LÓGICA CONTENIDO: {e}")
            texto = "[ERROR INTERNO PROCESANDO MENSAJE - EL USUARIO ENVIÓ ALGO PERO FALLÓ EL PROCESO]"

        if not texto: 
            # Si no extrajimos texto pero es un mensaje 'messageContextInfo' u otro tipo raro,
            # podríamos retornarlo como [MENSAJE DESCONOCIDO] para que el log sepa que algo llegó.
            # Pero por ahora lo ignoramos para no spammear.
            return {"status": "ignored"}

        numero = key.get("remoteJid", "").split("@")[0]
        push_name = data.get("pushName")

        # --- LÓGICA DE BUFFER ---
        if numero in message_buffer:
            message_buffer[numero]["timer"].cancel()
            message_buffer[numero]["messages"].append(texto)
        else:
            message_buffer[numero] = {"messages": [texto]}
        
        task = asyncio.create_task(buffer_manager(numero, push_name))
        message_buffer[numero]["timer"] = task
        
        return {"status": "buffered"}

    except Exception as e:
        logger.error(f"Error webhook: {e}")
        return {"status": "error"}

@app.get("/")
def health(): return {"status": "online", "buffer": "active"}

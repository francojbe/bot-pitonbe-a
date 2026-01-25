import os
import requests
import json
import logging
import asyncio
from typing import List, Optional, Any, Dict
from fastapi import FastAPI, Request, BackgroundTasks
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_core.tools import tool
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

# --- TOOLS PARA EL AGENTE ---
@tool
def calculate_quote(product_type: str, quantity: int, sides: int = 1, finish: str = "normal", design_service: str = "none") -> str:
    """
    Calcula el precio EXACTO. USO OBLIGATORIO para dar precios.
    Args:
        product_type: 'tarjetas', 'flyers', 'pendon', 'foam'.
        quantity: Cantidad (ej: 100, 1000).
        sides: 1 o 2 (lados de impresión).
        finish: 'normal' o 'polilaminado'.
        design_service: 'none', 'basico' ($30k), 'medio' ($60k), 'complejo' ($180k).
    Returns: Texto con el desglose y Total con IVA.
    """
    neto = 0
    iva_incluido = False 
    
    # Lógica Hardcoded (Fuente de Verdad de Precios)
    p_lower = product_type.lower()
    
    if "tarjeta" in p_lower:
        if quantity == 100:
            if finish == "polilaminado":
                neto = 12000 if sides == 1 else 16000
            else:
                neto = 7000 if sides == 1 else 11000
        elif quantity == 1000:
            # 1000 Tarjetas
            if sides == 1: 
                neto = 23800 # Base aprox para llegar a ~28k con IVA
            else: 
                neto = 47600
                
            if finish == "polilaminado":
                 neto += 4000 # Ajuste fino para coincidir con precios de mercado si es necesario
    
    elif "flyer" in p_lower:
        if quantity == 1000:
            iva_incluido = True
            neto = 23800 if sides == 1 else 47600
    
    if neto == 0:
        return f"⚠️ No tengo precio automático para {quantity} {product_type}. Revisa la base de conocimiento manual."

    # Costo Diseño
    costo_diseno = 0
    if design_service == "basico": costo_diseno = 30000
    elif design_service == "medio": costo_diseno = 60000
    elif design_service == "complejo": costo_diseno = 180000
    
    # Cálculo Final
    if iva_incluido:
        total = neto + costo_diseno
        detalle = f"Base (IVA Inc): ${neto:,} + Diseño: ${costo_diseno:,}"
    else:
        iva = int(neto * 0.19)
        total = neto + iva + costo_diseno
        detalle = f"Neto: ${neto:,} + IVA: ${iva:,} + Diseño: ${costo_diseno:,}"

    return f"""
    💰 COTIZACIÓN CALCULADA:
    - Producto: {product_type} x {quantity} u.
    - {detalle}
    --------------------------------
    💵 TOTAL FINAL: ${total:,} (IVA Incluido)
    """

@tool
def register_order(description: str, amount: int, rut: str, address: str, email: str, has_file: bool, files: List[str] = None, lead_id: str = "inject_me") -> str:
    """
    Registra la orden. 
    Si no hay archivo y no contratan diseño, falla.
    Args:
        lead_id: SE INYECTA AUTOMATICAMENTE.
        has_file: SE INYECTA AUTOMATICAMENTE.
        files: Lista de URLs de archivos (inyectado automáticamente).
    """
    # Validar si es un Servicio de Diseño real o solo mención
    desc_lower = description.lower()
    is_design_service = any(phrase in desc_lower for phrase in ["servicio de diseño", "diseño básico", "diseño medio", "diseño complejo", "creación de diseño", "costo diseño"])
    
    if not is_design_service and not has_file:
        return "❌ ERROR: No se puede crear orden sin archivo adjunto. El cliente debe enviar el archivo O contratar un 'Servicio de Diseño'."

    try:
        # 1. Update Lead
        supabase.table("leads").update({"rut": rut, "address": address, "email": email}).eq("id", lead_id).execute()
        # 2. Create Order
        new_order = {
            "lead_id": lead_id, 
            "description": description, 
            "total_amount": amount, 
            "status": "NUEVO",
            "files_url": files if files else []
        }
        res = supabase.table("orders").insert(new_order).execute()
        return f"✅ Orden #{str(res.data[0]['id'])[:8]} Creada Exitosamente."
    except Exception as e:
        return f"Error DB: {str(e)}"

async def procesar_y_responder(phone: str, mensajes_acumulados: List[str], push_name: str):
    """Procesa el bloque completo de mensajes usando Agentic Workflow."""
    try:
        texto_completo = " ".join(mensajes_acumulados)
        logger.info(f"🤖 Procesando bloque para {phone}: {texto_completo}")
        
        lead_id = get_or_create_lead(phone, push_name)
        lead_data = supabase.table("leads").select("name").eq("id", lead_id).execute()
        cliente_nombre = lead_data.data[0]['name'] if lead_data.data else "Cliente"
        
        # Verificar archivo reciente Y EXTRAER URL
        last_logs = supabase.table("message_logs").select("content").eq("lead_id", lead_id).order("created_at", desc=True).limit(10).execute()
        recent_txt = " ".join([m['content'] for m in last_logs.data])
        
        # Detectar presencia y URL
        import re
        url_match = re.search(r"((?:https?://|www\.)[^\s]+(?:\.jpg|\.png|\.pdf))", recent_txt + " " + texto_completo)
        extracted_url = url_match.group(1) if url_match else None
        
        has_file_context = "[IMAGEN RECIBIDA" in recent_txt or "[DOCUMENTO RECIBIDO" in recent_txt or "[IMAGEN RECIBIDA" in texto_completo

        
        historial = get_chat_history_pro(lead_id)
        contexto = buscar_contexto(texto_completo)
        
        system_prompt = f"""
Eres el Asistente Virtual Oficial de **Pitrón Beña Impresión**.
Cliente: **{cliente_nombre}**.
Tiene Archivo: {"✅ SÍ" if has_file_context else "❌ NO"}.

🧠 HERRAMIENTAS (USO OBLIGATORIO):
1. `calculate_quote`: **ÚNICA FUENTE DE VERDAD PARA PRECIOS.**
   - 🚫 NO uses precios que leas en la "Base de Conocimiento" o historial. Pueden ser antiguos.
   - Si te preguntan "cuánto vale?", EJECUTA LA TOOL.
2. `register_order`: Para cerrar la venta.

📚 BASE DE CONOCIMIENTO (Solo para dudas técnicas, NO para precios):
{contexto}

⛔ REGLAS DE SEGURIDAD:
- **Regla de Archivos:**
  - Si el cliente NO tiene archivo y NO contrata diseño -> 🚫 NO vendas. Pide el archivo.
  - Si dice "tengo el diseño" -> Pídelo ("Por favor envíamelo por aquí"). NO crees la orden aún.
  - Solo usa `register_order` si `has_file` es True o si contratan diseño explícitamente.
-5. **Recepción de Archivos/Diseños**:
   - Si recibes una imagen (`[IMAGEN RECIBIDA]`) o documento (`[DOCUMENTO RECIBIDO]`):
     - **¡CRÍTICO!** ESTO SIGNIFICA QUE `has_file` ES VERDADERO.
     - Si estabas esperando el archivo para cerrar una venta, **EJECUTA `register_order` DE INMEDIATO** (si ya tienes los datos del cliente).
     - Si no tienes los datos (RUT, etc), responde: "✅ Archivo recibido correctamente. Ahora por favor indícame tus datos para la factura (RUT, Nombre, Dirección, Email) y procederé."
     - NO digas "no tengo el archivo" si ves el tag `[IMAGEN RECIBIDA]`.

Formato de Cotización Final:
🪪 *Producto:* [Nombre]
📦 *Cantidad:* [N]
💰 *Neto:* $[Valor]
🎨 *Diseño:* $[Valor]
💵 *TOTAL:* $[Total con IVA] (IVA Inc.)

📝 FLUJO DE ATENCIÓN:
1. **Cliente pregunta precio:**
   - Invoca `calculate_quote(product, quantity, ...)`.
   - Responde CON el resultado de la tool.

2. **Cliente quiere comprar:**
   - Pide: RUT, Nombre, Dirección, Email.
   - Una vez recibidos, y si tienes el archivo/diseño -> `register_order`.

3. **Datos Transferencia:**
   - Banco Santander, Cta Corriente 79-63175-2, RUT 15.355.843-4 (Luis Pitron).

"""
        
        messages_to_ai = [SystemMessage(content=system_prompt)] + historial + [HumanMessage(content=texto_completo)]
        
        # --- BIND TOOLS ---
        llm_with_tools = llm.bind_tools([calculate_quote, register_order])

        # --- BUCLE DE AGENTE (REACT LOOP) ---
        # 1. Primera llamada al LLM
        response = llm_with_tools.invoke(messages_to_ai)
        messages_to_ai.append(response)
        
        resp_content = response.content

        # 2. Ejecutar Tools si las pide
        if response.tool_calls:
            for tool_call in response.tool_calls:
                fn_name = tool_call["name"]
                args = tool_call["args"]
                logger.info(f"🛠️ Tool Call: {fn_name} {args}")
                
                res = "Error"
                if fn_name == "calculate_quote":
                    res = calculate_quote.invoke(args)
                elif fn_name == "register_order":
                    args["lead_id"] = lead_id
                    # Le pasamos el contexto real de archivos al tool
                    args["has_file"] = has_file_context
                    if has_file_context and extracted_url:
                         args["files"] = [extracted_url]
                    res = register_order.invoke(args)
                
                # Añadir resultado al historial de la conversación actual
                messages_to_ai.append(ToolMessage(tool_call_id=tool_call["id"], content=str(res)))
            
            # 3. Segunda llamada al LLM (Respuesta Final interpretando la tool)
            final_response = llm_with_tools.invoke(messages_to_ai)
            resp_content = final_response.content
        
        # Guardar y Enviar
        save_message_pro(lead_id, phone, "user", texto_completo)
        save_message_pro(lead_id, phone, "assistant", resp_content)
        if resp_content: enviar_whatsapp(phone, resp_content)

    except Exception as e:
        logger.error(f"Error Agente: {e}")

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
        
        # [DEBUG EXTREMO] Guardar el último payload
        import json
        with open("last_payload.json", "w") as f:
            json.dump(payload, f, indent=4)

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

        # [CRÍTICO] Extraer 'base64' y 'mediaUrl' buscando en 'data' y en 'message' 
        # (Evolution API varía la ubicación según la versión/configuración)
        evolution_base64 = data.get("base64") or message.get("base64")
        evolution_media_url = data.get("mediaUrl") or message.get("mediaUrl")

        if evolution_base64 or evolution_media_url:
            # Buscar si el mensaje real es de un tipo compatible y enriquecerlo
            media_types = ["imageMessage", "documentMessage", "audioMessage", "videoMessage", "stickerMessage"]
            for m_type in media_types:
                if m_type in real_message:
                    logger.info(f"💉 Inyectando datos de Evolution en {m_type} (URL: {bool(evolution_media_url)}, B64: {bool(evolution_base64)})")
                    if evolution_base64:
                        real_message[m_type]["evolution_base64"] = evolution_base64
                    if evolution_media_url:
                        real_message[m_type]["evolution_media_url"] = evolution_media_url
                    break


        # --- EXTRACCIÓN Y SUBIDA DE MEDIOS ---
        texto = ""
        media_url = None
        
        # Helper robusto para guardar medios (B64 o URL -> Supabase)
        def save_media_to_supabase(b64_data, file_url, mime, ext):
            file_bytes = None
            import base64
            import time

            # 1. Prioridad: Intentar descargar desde URL (ya que suele estar desencriptada por MinIO)
            if file_url and isinstance(file_url, str) and file_url.startswith("http"):
                try:
                    logger.info(f"📥 Intentando descargar media desde URL: {file_url}")
                    resp = requests.get(file_url, timeout=20)
                    if resp.status_code == 200:
                        file_bytes = resp.content
                        logger.info(f"✅ Descarga exitosa ({len(file_bytes)} bytes)")
                    else:
                        logger.warning(f"⚠️ Fallo descarga media {resp.status_code}")
                except Exception as e:
                    logger.error(f"❌ Error downloading media: {e}")

            # 2. Fallback: Intentar decode B64 si la descarga falló
            if not file_bytes and b64_data and isinstance(b64_data, str) and len(b64_data) > 20:
                try:
                    # Limpiar prefijos de data URI si existen
                    clean_b64 = b64_data.split(",")[-1] if "," in b64_data else b64_data
                    if not clean_b64.startswith("http"):
                        logger.info(f"🧬 Intentando Fallback a B64 (inicio: {clean_b64[:30]}...)")
                        file_bytes = base64.b64decode(clean_b64)
                except Exception as e:
                    logger.error(f"❌ Error base64 decode: {e}")

            # 3. Subir a Supabase si tenemos bytes
            if file_bytes:
                # [OPTIONAL] Validar si son bytes de imagen reales (opcional pero recomendado)
                if not file_bytes.startswith(b'\xff\xd8') and not file_bytes.startswith(b'\x89PNG'):
                    logger.warning(f"⚠️ Los bytes recibidos no parecen una imagen válida (JPG/PNG). Primeros bytes: {file_bytes[:10].hex(' ')}")
                
                try:
                    # Extraer número de teléfono para la carpeta
                    jid = key.get('remoteJid', 'unknown').split('@')[0]
                    timestamp = int(time.time())
                    filename = f"{timestamp}.{ext}"
                    path = f"inbox/{jid}/{filename}"
                    
                    logger.info(f"📤 Subiendo a carpeta de usuario: {path}...")
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
                
                # Usar los campos inyectados que sabemos que funcionan
                b64 = img_msg.get("evolution_base64") or img_msg.get("base64")
                url_msg = img_msg.get("evolution_media_url") or img_msg.get("mediaUrl") or img_msg.get("url")
                
                # Detectar mime y extensión real
                mime = img_msg.get("mimetype", "image/jpeg")
                ext = "jpg"
                if "png" in mime: ext = "png"
                elif "webp" in mime: ext = "webp"
                elif "gif" in mime: ext = "gif"

                logger.info(f"🖼️ Procesando imagen ({mime}). URL origen: {url_msg[:50]}...")
                final_url = save_media_to_supabase(b64, url_msg, mime, ext)

                
                if final_url:
                    texto = f"[IMAGEN RECIBIDA: {final_url}] {caption}"
                else:
                    texto = f"[IMAGEN RECIBIDA (Fallo local): {url_msg}] {caption}"

            # 3. Documentos
            elif "documentMessage" in real_message:
                doc_msg = real_message["documentMessage"]
                filename = doc_msg.get("title", "doc")
                caption = doc_msg.get("caption", "")
                
                b64 = doc_msg.get("evolution_base64") or doc_msg.get("base64")
                url_msg = doc_msg.get("evolution_media_url") or doc_msg.get("mediaUrl") or doc_msg.get("url")
                mime_type = doc_msg.get("mimetype", "application/pdf")
                
                ext = "pdf"
                if "image" in mime_type: ext = "jpg"
                elif "word" in mime_type: ext = "docx"
                elif "excel" in mime_type: ext = "xlsx"
                
                logger.info(f"📄 Procesando documento. URL origen: {url_msg[:50]}...")
                final_url = save_media_to_supabase(b64, url_msg, mime_type, ext)

                if final_url:
                    texto = f"[DOCUMENTO RECIBIDO: {filename} - URL: {final_url}] {caption}"
                else:
                    texto = f"[DOCUMENTO RECIBIDO: {filename} - URL origen: {url_msg}] {caption}"

                    
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

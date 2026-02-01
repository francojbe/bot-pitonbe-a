import os
import requests
import json
import logging
import asyncio
from typing import List, Optional, Any, Dict
from fastapi import FastAPI, Request, BackgroundTasks
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_core.tools import tool
from supabase import create_client, Client
from io import BytesIO
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import cm

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

# Configurar CORS para permitir peticiones del Dashboard
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
llm = ChatOpenAI(model_name="gpt-4o-mini", temperature=0.1, openai_api_key=OPENAI_API_KEY) # Temp baja para matemáticas

# --- BUFFER DE MENSAJES (Memoria Volátil) ---
# Diccionario para agrupar mensajes: { "569...": {"timer": Task, "messages": ["Hola", "precio"]} }
message_buffer: Dict[str, Any] = {}
BUFFER_DELAY = 4.0 # Segundos a esperar por más mensajes

# --- GESTIÓN DE INACTIVIDAD ---
inactivity_timers: Dict[str, asyncio.Task] = {}

async def inactivity_manager(phone: str, lead_id: str):
    """Maneja los tiempos de inactividad: 5min alerta, +10min cierre."""
    try:
        # 1. Espera de 5 minutos para la ALERTA
        await asyncio.sleep(300) 
        
        alerta = "Te comento que nuestra conversación debería ser continua para poder agendar tu trabajo con éxito; de lo contrario, tendríamos que reagendar todo desde cero."
        enviar_whatsapp(phone, alerta)
        save_message_pro(lead_id, phone, "assistant", alerta, metadata={"type": "inactivity_alert"})
        logger.info(f"⏰ Alerta de inactividad enviada a {phone}")

        # 2. Espera de 10 minutos adicionales para el CIERRE
        await asyncio.sleep(600)
        
        cierre_msg = "La sesión ha expirado por inactividad. Si deseas continuar, por favor envíanos un nuevo mensaje para iniciar de nuevo."
        enviar_whatsapp(phone, cierre_msg)
        save_message_pro(lead_id, phone, "assistant", cierre_msg, metadata={"type": "session_closed"})
        logger.info(f"🚫 Sesión cerrada por inactividad para {phone}")

    except asyncio.CancelledError:
        logger.info(f"✅ Inactividad cancelada para {phone} (Usuario respondió)")


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
        logger.error(f"❌ Error crítico en get_or_create_lead para {phone}: {e}")
        return None

# --- HISTORIAL Y LOGS ---
def get_chat_history_pro(lead_id: str, limit: int = 10):
    if not lead_id or lead_id == "None": 
        logger.warning(f"⚠️ get_chat_history_pro: lead_id es nulo")
        return []
    try:
        response = supabase.table("message_logs").select("role, content").eq("lead_id", lead_id).order("created_at", desc=True).limit(limit).execute()
        mensajes = []
        for msg in response.data[::-1]:
            if msg['role'] == 'user': mensajes.append(HumanMessage(content=msg['content']))
            else: mensajes.append(AIMessage(content=msg['content']))
        return mensajes
    except Exception as e: 
        logger.error(f"❌ Error recuperando historial: {e}")
        return []

def save_message_pro(lead_id: str, phone: str, role: str, content: str, intent: str = None, tokens: int = None, metadata: dict = None):
    if not lead_id: return
    try:
        supabase.table("message_logs").insert({
            "lead_id": lead_id, 
            "phone_number": phone, 
            "role": role, 
            "content": content, 
            "intent": intent,
            "tokens_used": tokens,
            "metadata": metadata or {}
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
def calculate_quote(product_type: str, quantity: int, sides: int = 1, finish: str = "normal", design_service: str = "none", size: str = "estandar") -> str:
    """
    Calcula el precio EXACTO. USO OBLIGATORIO para dar precios.
    Args:
        product_type: 'tarjetas', 'flyers', 'pendon', 'foam'.
        quantity: Cantidad (unidades).
        sides: 1 o 2 (lados de impresión).
        finish: 'normal' o 'polilaminado'.
        design_service: 'none', 'basico' ($30k), 'medio' ($60k), 'complejo' ($180k).
        size: '10x14', '20x14' (media carta), '20x28' (carta), '80x200', '90x200', etc.
    Returns: Texto con el desglose, Total con IVA y Tiempo de Entrega.
    """
    neto = 0
    iva_incluido = False 
    plazo = "Consultar"
    
    p_lower = product_type.lower()
    s_lower = size.lower()
    
    # 1. TARJETAS
    if "tarjeta" in p_lower:
        plazo = "1 a 3 días hábiles (Entrega al día siguiente si envías el diseño listo)"
        precio_100_1lado = 8330 # Antes 7000 neto
        precio_100_2lados = 13090 # Antes 11000 neto
        if finish == "polilaminado":
            precio_100_1lado = 14280 # Antes 12000 neto
            precio_100_2lados = 19040 # Antes 16000 neto
        
        # Escala unitaria basada en 100u ($ / 100u)
        base = precio_100_2lados if sides == 2 else precio_100_1lado
        unit_price = base / 100
        neto = int(unit_price * quantity)
        iva_incluido = True

    # 2. FLYERS
    elif "flyer" in p_lower:
        if quantity == 100 and ("10x15" in s_lower or "10x14" in s_lower):
            neto = 12800 # Antes 10756 neto
            iva_incluido = True
            plazo = "1 hora (Express)"
        elif quantity >= 1000:
            iva_incluido = True
            plazo = "3 a 4 días hábiles"
            if "10x14" in s_lower or "estandar" in s_lower:
                neto = 47600 if sides == 2 else 23800
            elif "20x14" in s_lower or "media carta" in s_lower:
                neto = 95200 if sides == 2 else 47600
            elif "20x28" in s_lower or "carta" in s_lower:
                neto = 190400 if sides == 2 else 95200
            else:
                neto = 23800 # Fallback 10x14
            
            # Ajuste por cantidad si es múltiplo de 1000
            neto = int((neto / 1000) * quantity)

    # 3. PENDONES ROLLER
    elif "pendon" in p_lower:
        plazo = "24-48 horas"
        precios_pendon = {
            "80x200": 55930, "90x200": 67830, "100x200": 80920,
            "120x200": 116620, "150x200": 159650, "200x200": 309400,
            "250x200": 362404, "300x200": 553486
        }
        neto = 0
        for k, v in precios_pendon.items():
            if k in s_lower.replace(" ", ""):
                neto = v * quantity
                break
        if neto == 0: neto = 55930 * quantity
        iva_incluido = True

    # 4. FOAM / TROVICEL
    elif "foam" in p_lower or "trovicel" in p_lower:
        plazo = "2 a 3 días"
        if "33x48" in s_lower:
            neto = 7140 * quantity
        else: # Tamaño carta o menor
            if quantity < 10: unit = 3570
            elif quantity < 20: unit = 2975
            elif quantity < 30: unit = 2737
            else: unit = 2380
            neto = unit * quantity
        iva_incluido = True

    if neto == 0:
        return f"⚠️ No tengo precio automático para {product_type} {size}. Por favor, consulta manualmente."

    # Costo Diseño (Valores con IVA Incluido)
    # Tiers: basico ($7.140), medio ($35.700), avanzado ($71.400), premium ($214.200)
    costo_diseno = 0
    ds_lower = design_service.lower()
    
    if "basico" in ds_lower: costo_diseno = 7140
    elif "medio" in ds_lower: costo_diseno = 35700
    elif "avanzado" in ds_lower: costo_diseno = 71400
    elif "premium" in ds_lower: costo_diseno = 214200
    
    # Aplicar Diseño Gratuito si la compra supera los $60.000 (Aplica al nivel básico)
    bono_txt = ""
    if neto >= 60000 and "basico" in ds_lower:
        costo_diseno = 0
        bono_txt = " (Bonificación por compra > $60k)"
    
    # Cálculo Final (Todo ya tiene IVA)
    total = neto + costo_diseno
    detalle = f"Valor Base (IVA Inc): ${neto:,} + Diseño (IVA Inc): ${costo_diseno:,}{bono_txt}"

    return f"""
    💰 COTIZACIÓN OFICIAL:
    - Producto: {product_type} ({size}) x {quantity} u.
    - {detalle}
    - Plazo de entrega: {plazo}
    --------------------------------
    💵 TOTAL FINAL: ${total:,} (IVA Incluido)
    """



@tool
def register_order(description: str, amount: int, rut: str, address: str, email: str, has_file: bool, name: str = None, address_custom: str = None, files: List[str] = None, lead_id: str = "inject_me", phone: str = None) -> str:
    """
    Registra la orden y actualiza datos del cliente (RUT, Nombre, Email, Dirección).
    
    CRITICAL:
    - amount: DEBE SER EL PRECIO TOTAL EN DINERO (CLP). (Ej: 16560). NO LA CANTIDAD DE PRODUCTOS.
    """
    # Validar diseño
    desc_lower = description.lower()
    is_design_service = any(phrase in desc_lower for phrase in ["servicio de diseño", "diseño básico", "diseño medio", "diseño complejo", "creación de diseño", "costo diseño"])
    
    if not is_design_service and not has_file:
        return "❌ ERROR: No se puede crear orden sin archivo adjunto. El cliente debe enviar el archivo O contratar un 'Servicio de Diseño'."

    try:
        # Logs para depuración
        print(f"📝 Registrando Orden - Cliente: {name} | RUT: {rut} | Email: {email} | Phone: {phone}")

        # 1. Update Lead (Using PHONE for safety if available, else ID)
        update_data = {}
        if name and name.strip() not in ["", "None", "N/A"]: update_data["name"] = name
        if rut and rut.strip() not in ["", "None", "N/A"]: update_data["rut"] = rut
        # Usamos 'address' del parámetro o 'address_custom' si existiera (aquí 'address' es el estándar)
        final_address = address or address_custom
        if final_address and final_address.strip() not in ["", "None", "N/A"]: update_data["address"] = final_address
        if email and email.strip() not in ["", "None", "N/A"]: update_data["email"] = email
        
        if update_data:
            if phone:
                res_upd = supabase.table("leads").update(update_data).eq("phone_number", phone).execute()
                print(f"✅ Lead actualizado por teléfono: {len(res_upd.data)} filas.")
            else:
                supabase.table("leads").update(update_data).eq("id", lead_id).execute()

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
    # CANCELAR timer de inactividad previo si el usuario respondió
    if phone in inactivity_timers:
        inactivity_timers[phone].cancel()
        del inactivity_timers[phone]

    try:
        texto_completo = " ".join(mensajes_acumulados)

        logger.info(f"🤖 Procesando bloque para {phone}: {texto_completo}")
        
        lead_id = get_or_create_lead(phone, push_name)
        if not lead_id:
            logger.error(f"🚫 No se pudo cargar/crear el lead para {phone}. Abortando respuesta.")
            return

        lead_data = supabase.table("leads").select("name, rut, email, address").eq("id", lead_id).execute()
        if lead_data.data:
            lead_row = lead_data.data[0]
            cliente_nombre = lead_row.get('name') or "Cliente"
            # Recuperamos datos guardados para el prompt
            saved_rut = lead_row.get('rut')
            saved_email = lead_row.get('email')
            saved_address = lead_row.get('address')
            
            datos_guardados_txt = ""
            if saved_rut:
                datos_guardados_txt = f"""
✅ DATOS CLIENTE REGISTRADOS:
- RUT: {saved_rut}
- Email: {saved_email}
- Dirección: {saved_address}
(Si el cliente confirma la compra, MUESTRA estos datos y pregunta si se mantienen. NO pidas todo de nuevo si ya lo tienes).
"""
        else:
             cliente_nombre = "Cliente"
             datos_guardados_txt = ""

        
        # Verificar archivo reciente Y EXTRAER URL
        # ESTRATEGIA: Basada en TIEMPO, no cantidad.
        # Solo consideramos archivos válidos si se enviaron en los últimos 150 minutos (Sesión Activa)
        last_logs = supabase.table("message_logs").select("content, created_at").eq("lead_id", lead_id).order("created_at", desc=True).limit(20).execute()
        
        recent_valid_content = []
        from datetime import datetime, timedelta, timezone
        ahora = datetime.now(timezone.utc)
        
        for msg in last_logs.data:
            ts_str = msg['created_at']
            # Fix robusto para ISO format en Python < 3.11
            try:
                if ts_str.endswith('Z'):
                    ts_str = ts_str.replace('Z', '+00:00')
                fecha_msg = datetime.fromisoformat(ts_str)
            except ValueError:
                # Fallback: Quitar microsegundos y zona si falla
                ts_str = ts_str.split('.')[0] 
                fecha_msg = datetime.strptime(ts_str, "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)

            # Si el mensaje es de hace menos de 15 minutos, lo consideramos "Contexto Vivo"
            if (ahora - fecha_msg).total_seconds() < 900: # 15 min = 900 seg
                recent_valid_content.append(msg['content'])
        
        recent_txt = " ".join(recent_valid_content)
        
        # Detectar presencia y URL de archivo
        import re
        url_match = re.search(r"((?:https?://|www\.)[^\s]+(?:\.jpg|\.png|\.pdf))", recent_txt + " " + texto_completo)
        extracted_url = url_match.group(1) if url_match else None
        
        has_file_context = "[IMAGEN RECIBIDA" in recent_txt or "[DOCUMENTO RECIBIDO" in recent_txt or "[IMAGEN RECIBIDA" in texto_completo

        # EXTRACCIÓN INTELIGENTE DE DATOS DE CLIENTE (RUT/EMAIL) DEL HISTORIAL
        # Para que no olvide datos dados hace 3 mensajes.
        full_context_str = recent_txt + " " + texto_completo
        
        # Regex mejorados para capturar RUTs en medio de texto multilinea
        import re
        # RUT: 1-9 millones, con guion y digito verificador (k o numero)
        found_rut = re.search(r"(\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])", full_context_str)
        # Email: Standard
        found_email = re.search(r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})", full_context_str)
        
        datos_detectados = ""
        if found_rut or found_email:
             rut_val = found_rut.group(1) if found_rut else 'No detectado'
             email_val = found_email.group(1) if found_email else 'No detectado'
             datos_detectados = f"\n📋 DATOS DETECTADOS EN CHAT RECIENTE (ÚSALOS para registrar la orden si no te los dan ahora):\n- RUT: {rut_val}\n- Email: {email_val}\n"
             # [DEBUG]
             logger.info(f"🕵️‍♂️ DATOS DETECTADOS POR REGEX: RUT={rut_val}, EMAIL={email_val}")

        historial = get_chat_history_pro(lead_id)
        contexto = buscar_contexto(texto_completo)
        system_prompt = f"""
Eres **Richard**, el Asistente Virtual Oficial de **Pitrón Beña Impresión**.

✨ PRIMERA INTERACCIÓN:
- Si el cliente te saluda por primera vez o el historial está vacío, DEBES presentarte: "¡Hola! Soy **Richard**, el asistente virtual de Pitrón Beña Impresión. ¿En qué puedo ayudarte hoy?" (Sé cordial y profesional).

Cliente Registrado: **{cliente_nombre}**.
Tiene Archivo: {"✅ SÍ" if has_file_context else "❌ NO"}.
{datos_detectados}
{datos_guardados_txt}

🧠 CÓMO USAR TU CONOCIMIENTO:
1. **DESCUBRIMIENTO (RAG):**
   - Consulta tu "BASE DE CONOCIMIENTO" para dar detalles técnicos.
   - **REGLA DE PDF (IMPORTANTE):** Siempre solicita los archivos para impresión en formato **PDF** (curvado/vectorizado) para máxima calidad.
   - **REGLA DE DISEÑO (CRÍTICA):** Al ofrecer diseño, DEBES usar el **Disclaimer Específico** de ese nivel. 
     - *Básico/Gratis*: Aclara que NO se entrega el archivo digital.
     - *Medio*: Entrega JPG.
     - *Avanzado*: Entrega PDF.
     - *Premium*: Entrega Editable (.AI).
   - Siempre aclara la regla de **3 cambios máximo** y cobro al 4to.

2. **PRECIOS (HERRAMIENTA):**
   - Una vez el cliente elija producto y cantidad, **USA EXCLUSIVAMENTE** la herramienta `calculate_quote`.

📚 BASE DE CONOCIMIENTO:
{contexto}

⛔ REGLAS DE SEGURIDAD:
- **Prioridad de Nombre:** Si el cliente dice llamarse distinto a "{cliente_nombre}", usa el nuevo nombre y PÁSALO a `register_order`.
- **Regla de Archivos:** Solo usa `register_order` si `has_file` es True o si contratan diseño.
- **Datos Fiscales:** Pide RUT, Nombre real/empresa, Dirección y Email.

Formato de Cotización Final:
🪪 *Producto:* [Nombre]
📦 *Cantidad:* [N]
💰 *Valor Base:* $[Valor] (IVA Inc.)
🎨 *Diseño:* $[Valor] (IVA Inc.) - [Nivel y Disclaimer resumido]
💵 *TOTAL:* $[Total con IVA] (IVA Inc.)

📝 FLUJO DE ATENCIÓN:
1. **Cotización:** Invoca `calculate_quote`.
2. **Registro:** Pide RUT, Nombre, Dirección, Email.
3. **Pago:** Santander, Cta Corriente 79-63175-2, RUT 15.355.843-4 (Luis Pitron).
"""

        
        messages_to_ai = [SystemMessage(content=system_prompt)] + historial + [HumanMessage(content=texto_completo)]
        
        # --- BIND TOOLS ---
        llm_with_tools = llm.bind_tools([calculate_quote, register_order])

        # 313. BUCLE DE AGENTE (REACT LOOP)
        total_tokens = 0
        
        # 1. Primera llamada al LLM
        response = llm_with_tools.invoke(messages_to_ai)
        messages_to_ai.append(response)
        
        # Acumular tokens primera llamada
        if hasattr(response, 'response_metadata'):
             usage = response.response_metadata.get('token_usage', {})
             total_tokens += usage.get('total_tokens', 0)
        
        resp_content = response.content

        # 2. Ejecutar Tools si las pide
        order_created_this_turn = False
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
                    args["phone"] = phone # SAFETY INJECTION
                    # 1. Inyección de Archivos
                    args["has_file"] = has_file_context
                    if has_file_context and extracted_url:
                         args["files"] = [extracted_url]
                    
                    # 2. Inyección de Datos Fiscales (Recuperación de Memoria)
                    if (not args.get("rut") or args["rut"] == "") and found_rut:
                        args["rut"] = found_rut.group(1)
                        logger.info(f"💉 Inyectando RUT recuperado: {args['rut']}")
                    
                    if (not args.get("email") or args["email"] == "") and found_email:
                        args["email"] = found_email.group(0)
                        logger.info(f"💉 Inyectando Email recuperado: {args['email']}")

                    res = register_order.invoke(args)
                    if "✅" in str(res):
                        order_created_this_turn = True
                
                # Añadir resultado al historial de la conversación actual
                messages_to_ai.append(ToolMessage(tool_call_id=tool_call["id"], content=str(res)))
            
            # 3. Segunda llamada al LLM (Respuesta Final interpretando la tool)
            final_response = llm_with_tools.invoke(messages_to_ai)
            resp_content = final_response.content
            
            # Acumular tokens segunda llamada
            if hasattr(final_response, 'response_metadata'):
                 usage = final_response.response_metadata.get('token_usage', {})
                 total_tokens += usage.get('total_tokens', 0)
        
        # Guardar y Enviar
        meta_envio = {}
        if resp_content: 
            status_envio = enviar_whatsapp(phone, resp_content)
            meta_envio = {"whatsapp_delivery": status_envio}

        save_message_pro(lead_id, phone, "user", texto_completo)
        save_message_pro(lead_id, phone, "assistant", resp_content, tokens=total_tokens, metadata=meta_envio)

        # INICIAR nuevo timer de inactividad tras la respuesta SÓLO SI no se creó una orden
        if not order_created_this_turn:
            inactivity_timers[phone] = asyncio.create_task(inactivity_manager(phone, lead_id))
        else:
            logger.info(f"✅ Orden detectada para {phone}. Se omite timer de inactividad.")


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



# --- COMUNICACIÓN EXTERNA ---
def enviar_whatsapp(numero: str, texto: str) -> dict:
    """Envía un mensaje de texto vía Evolution API y retorna el status."""
    result = {"status": "unknown", "code": 0}
    try:
        base_url = EVOLUTION_API_URL.rstrip('/')
        from urllib.parse import quote
        instance_encoded = quote(INSTANCE_NAME)
        url = f"{base_url}/message/sendText/{instance_encoded}"
        
        payload = {
            "number": numero, 
            "options": {"delay": 1000, "presence": "composing"},
            "textMessage": {"text": texto}, 
            "text": texto
        }
        
        logger.info(f"📤 Intentando enviar WA a {numero}...")
        response = requests.post(
            url, 
            json=payload, 
            headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"},
            timeout=15
        )
        
        result["code"] = response.status_code
        if response.status_code in [200, 201]:
            logger.info(f"✅ WA enviado exitosamente a {numero}")
            result["status"] = "success"
            result["evolution_id"] = response.json().get("key", {}).get("id")
        else:
            logger.error(f"❌ Error Evolution API ({response.status_code}): {response.text}")
            result["status"] = "error"
            result["response"] = response.text
            
    except Exception as e: 
        logger.error(f"🔥 Error crítico envío WA: {e}")
        result["status"] = "exception"
        result["error"] = str(e)
    
    return result

def enviar_documento_wa(numero: str, archivo_bytes: bytes, filename: str, caption: str = "") -> dict:
    """Envía un archivo PDF vía Evolution API como media."""
    result = {"status": "unknown", "code": 0}
    try:
        import base64
        base_url = EVOLUTION_API_URL.rstrip('/')
        from urllib.parse import quote
        instance_encoded = quote(INSTANCE_NAME)
        url = f"{base_url}/message/sendMedia/{instance_encoded}"
        
        base64_data = base64.b64encode(archivo_bytes).decode('utf-8')
        
        payload = {
            "number": numero,
            "mediatype": "document",
            "mimetype": "application/pdf",
            "caption": caption,
            "media": base64_data,
            "fileName": filename
        }
        
        logger.info(f"📄 Intentando enviar PDF a {numero}...")
        response = requests.post(
            url, 
            json=payload, 
            headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"},
            timeout=30
        )
        
        result["code"] = response.status_code
        if response.status_code in [200, 201]:
            logger.info(f"✅ Documento enviado exitosamente a {numero}")
            result["status"] = "success"
        else:
            logger.error(f"❌ Error Evolution Media ({response.status_code}): {response.text}")
            result["status"] = "error"
    except Exception as e:
        logger.error(f"🔥 Error enviando media: {e}")
        result["status"] = "exception"
    
    return result

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
        logger.error(f"🔥 Error Webhook: {e}")
        return {"status": "error"}

@app.get("/")
def health_check():
    return {"status": "ok", "service": "Whatsapp Bot & API"}

# --- ENDPOINT NOTIFICACIÓN ESTADOS ---
class StatusUpdate(BaseModel):
    order_id: str
    new_status: str

@app.post("/notify_update")
async def notify_status_update(update: StatusUpdate):
    """Endpoint llamado por el Dashboard cuando cambia un estado."""
    try:
        logger.info(f"🔔 Recibida notificación de estado: Order {update.order_id} -> {update.new_status}")
        
        # 1. Obtener datos de la orden y el cliente
        res = supabase.table("orders").select("*, leads(name, phone_number)").eq("id", update.order_id).execute()
        if not res.data:
            logger.warning(f"⚠️ Orden {update.order_id} no encontrada en DB")
            return {"status": "error", "message": "Orden no encontrada"}
        
        order = res.data[0]
        lead = order.get('leads')
        if not lead or not lead.get('phone_number'):
            logger.warning(f"⚠️ Orden {update.order_id} no tiene lead o teléfono")
            return {"status": "skipped", "message": "Orden sin teléfono asociado"}
        
        lead_id = order.get('lead_id')
        nombre = lead.get('name', 'Cliente').split(' ')[0]
        phone = lead['phone_number']
        
        # Limpieza de descripción para el mensaje
        desc = order.get('description', 'tu pedido')
        producto = (desc[:37] + "...") if len(desc) > 40 else desc
        status = update.new_status

        # 2. Elegir Plantilla de Mensaje
        mensaje = ""
        if status == "DISEÑO":
            mensaje = f"🎨 Hola {nombre}, te informamos que tu pedido de *{producto}* ha ingresado a la etapa de **DISEÑO**. Estamos revisando tus archivos."
        elif status == "PRODUCCIÓN":
            mensaje = f"⚙️ ¡Buenas noticias {nombre}! Tu pedido pasó a **PRODUCCIÓN** y ya se está imprimiendo/fabricando."
        elif status == "LISTO":
            mensaje = f"📦✨ ¡Tu pedido está **LISTO**! Puedes pasar a retirarlo a nuestro local en **Arturo Prat 230, Local 117**, Santiago Centro. Te esperamos."
        elif status == "ENTREGADO":
            mensaje = f"✅ ¡Gracias por tu compra {nombre}! Tu pedido figura como **ENTREGADO**. Esperamos verte pronto en Pitrón Beña Impresión."
        
        # 3. Enviar Mensaje
        if mensaje:
            status_envio = enviar_whatsapp(phone, mensaje)
            
            # 4. GUARDAR EN EL LOG (Para rastreo)
            save_message_pro(lead_id, phone, "assistant", mensaje, intent="NOTIFICATION_UPDATE", metadata={"whatsapp_delivery": status_envio})
            
            return {"status": "sent", "message": mensaje, "delivery": status_envio}
        else:
            logger.info(f"ℹ️ Estado {status} no configurado para notificación automática.")
            return {"status": "ignored", "message": f"No hay mensaje configurado para estado {status}"}

    except Exception as e:
        logger.error(f"🔥 Error en notify_status_update: {e}")
        return {"status": "error", "detail": str(e)}
@app.post("/generate_invoice")
async def generate_invoice(update: StatusUpdate):
    """Genera un PDF de factura proforma y lo envía por WhatsApp."""
    try:
        # 1. Obtener datos
        res = supabase.table("orders").select("*, leads(*)").eq("id", update.order_id).execute()
        if not res.data:
            return {"status": "error", "message": "Orden no encontrada"}
        
        order = res.data[0]
        lead = order.get('leads')
        if not lead or not lead.get('phone_number'):
            return {"status": "error", "message": "Cliente sin teléfono"}

        phone = lead['phone_number']
        nombre_cliente = lead.get('name', 'Cliente')
        
        # 2. Generar PDF en Memoria
        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=LETTER)
        width, height = LETTER

        # Logo / Encabezado
        p.setFont("Helvetica-Bold", 16)
        p.drawString(2*cm, height-2*cm, "PITRÓN BEÑA IMPRESIÓN")
        p.setFont("Helvetica", 10)
        p.drawString(2*cm, height-2.5*cm, "Arturo Prat 230, Local 117, Santiago")
        p.drawString(2*cm, height-3*cm, "RUT: 15.355.843-4")
        
        p.setFont("Helvetica-Bold", 14)
        p.drawRightString(width-2*cm, height-2*cm, "FACTURA PROFORMA")
        p.setFont("Helvetica", 10)
        p.drawRightString(width-2*cm, height-2.5*cm, f"Orden: #{order['id'][:8]}")
        p.drawRightString(width-2*cm, height-3*cm, f"Fecha: {order['created_at'][:10]}")

        # Datos Cliente
        p.line(2*cm, height-4*cm, width-2*cm, height-4*cm)
        p.setFont("Helvetica-Bold", 11)
        p.drawString(2*cm, height-4.8*cm, "DATOS DEL CLIENTE:")
        p.setFont("Helvetica", 10)
        p.drawString(2*cm, height-5.4*cm, f"Nombre: {nombre_cliente}")
        p.drawString(2*cm, height-6*cm, f"RUT: {lead.get('rut', 'No informado')}")
        p.drawString(2*cm, height-6.6*cm, f"Email: {lead.get('email', '--')}")

        # Detalle
        p.line(2*cm, height-7.5*cm, width-2*cm, height-7.5*cm)
        p.setFont("Helvetica-Bold", 11)
        p.drawString(2*cm, height-8.2*cm, "DESCRIPCIÓN")
        p.drawRightString(width-2*cm, height-8.2*cm, "TOTAL (IVA INC.)")
        
        p.setFont("Helvetica", 10)
        p.drawString(2*cm, height-9.2*cm, order.get('description', 'Servicio de Impresión'))
        p.drawRightString(width-2*cm, height-9.2*cm, f"${order.get('total_amount', 0):,}")

        # Pie de página / Transferencia
        p.line(2*cm, 4*cm, width-2*cm, 4*cm)
        p.setFont("Helvetica-Bold", 10)
        p.drawString(2*cm, 3.4*cm, "DATOS DE TRANSFERENCIA:")
        p.setFont("Helvetica", 9)
        p.drawString(2*cm, 2.9*cm, "Banco Santander - Cta Corriente 79-63175-2")
        p.drawString(2*cm, 2.4*cm, "Luis Pitron - RUT 15.355.843-4 - contacto@pitron.cl")

        p.showPage()
        p.save()
        
        pdf_bytes = buffer.getvalue()
        buffer.close()

        # 3. Enviar por WhatsApp
        filename = f"Factura_PB_{order['id'][:6]}.pdf"
        caption = f"📄 Hola {nombre_cliente.split(' ')[0]}, adjuntamos la factura proforma de tu pedido."
        status_wa = enviar_documento_wa(phone, pdf_bytes, filename, caption)

        # 4. Log
        save_message_pro(lead['id'], phone, "assistant", f"[ARCHIVO ENVIADO: {filename}]", intent="INVOICE_GENERATION", metadata={"whatsapp_delivery": status_wa})

        return {"status": "success", "wa_status": status_wa}

    except Exception as e:
        logger.error(f"🔥 Error Generando Factura: {e}")
        return {"status": "error", "message": str(e)}

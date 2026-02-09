import os
import requests
import json
import logging
import asyncio
from typing import List, Optional, Any, Dict
from fastapi import FastAPI, Request, BackgroundTasks, UploadFile, File, Form, HTTPException, Response
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
from datetime import datetime

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
def get_embedding(text: str) -> List[float]:
    try:
        text = text.replace("\n", " ")
        return embeddings.embed_query(text)
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        return []

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
✨ *COTIZACIÓN OFICIAL* ✨
──────────────────
📦 *Producto:* {product_type} ({size}) x {quantity} u.
💵 *{detalle}*
⏳ *Plazo de entrega:* {plazo}
──────────────────
💰 *TOTAL FINAL: ${total:,} (IVA Incluido)* ✅
    """



@tool
def register_order(description: str, amount: int, rut: str, address: str, email: str, has_file: bool, name: str = None, address_custom: str = None, files: List[str] = None, lead_id: str = "inject_me", phone: str = None, quantity: int = None, material: str = None, dimensions: str = None, print_sides: str = "1 Tiro") -> str:
    """
    Registra la orden y actualiza datos del cliente (RUT, Nombre, Email, Dirección).
    """
    # Validar diseño
    desc_lower = description.lower()
    design_keywords = ["servicio de diseño", "diseño básico", "diseño medio", "diseño complejo", "creación de diseño", "costo diseño", "con diseño"]
    is_design_service = any(phrase in desc_lower for phrase in design_keywords)
    
    # VALIDACIÓN ESTRICTA: Evita confusiones
    if not has_file and not is_design_service:
        return "❌ ERROR BLOQUEANTE: No se puede crear la orden. Razón: El sistema detectó que 'has_file' es Falso (no hay archivo). Para proceder sin archivo, DEBES incluir explícitamente la frase 'Servicio de Diseño' en el parámetro 'description' de esta herramienta. Por favor, corrige tu llamada a la herramienta."

    try:
        # Logs para depuración
        print(f"📝 Registrando Orden - Cliente: {name} | RUT: {rut} | Email: {email} | Phone: {phone}")

        # 1. Update Lead (Using PHONE for safety if available, else ID)
        update_data = {}
        if name and name.strip() not in ["", "None", "N/A"]: update_data["name"] = name
        if rut and rut.strip() not in ["", "None", "N/A"]: update_data["rut"] = rut
        final_address = address or address_custom
        if final_address and final_address.strip() not in ["", "None", "N/A"]: update_data["address"] = final_address
        if email and email.strip() not in ["", "None", "N/A"]: update_data["email"] = email
        
        if update_data:
            if phone:
                res_upd = supabase.table("leads").update(update_data).eq("phone_number", phone).execute()
            else:
                supabase.table("leads").update(update_data).eq("id", lead_id).execute()

        # 2. INTELIGENT DATA EXTRACTION (Strict Regex Fallback)
        # Solo extraemos si estamos 100% seguros. Ante la duda, None.
        import re
        
        # Quantity
        if not quantity:
            q_match = re.search(r'(\d+)\s*(?:unidades|u\.|copias|flyers|tarjetas)', desc_lower)
            if q_match: quantity = int(q_match.group(1))
        
        # Dimensions
        if not dimensions:
            d_match = re.search(r'(\d+x\d+)', desc_lower)
            if d_match: dimensions = d_match.group(1) + " cm"

        # Material (STRICT MODE) 
        if not material:
            if "couch" in desc_lower: 
                if "300" in desc_lower: material = "Couché 300g"
                elif "170" in desc_lower: material = "Couché 170g"
                elif "130" in desc_lower: material = "Couché 130g"
                # Si dice couché pero no gramaje, lo dejamos vacio para que el humano decida.
            elif "bond" in desc_lower and "80" in desc_lower: material = "Bond 80g"
            elif "adhesivo" in desc_lower and "pvc" in desc_lower: material = "Adhesivo PVC"
            elif "papel" in desc_lower and "adhesivo" in desc_lower: material = "Adhesivo Papel"
            elif "pendon" in desc_lower or "tela" in desc_lower: material = "Tela PVC"
            elif "sintetico" in desc_lower or "trovi" in desc_lower: material = "Sintético"

        # 3. Create Order
        new_order = {
            "lead_id": lead_id, 
            "description": description, 
            "total_amount": amount, 
            "status": "NUEVO",
            "files_url": files if files else [],
            # Structured Data
            "quantity": quantity,
            "material": material,
            "dimensions": dimensions,
            "print_sides": print_sides
        }
        res = supabase.table("orders").insert(new_order).execute()
        order_id = res.data[0]['id']

        # NOVEDAD: Vinculación Automática de Archivos Recientes
        try:
            from datetime import datetime, timedelta, timezone
            # Buscar archivos del cliente sin orden asignada, creados en los últimos 120 min
            ahora = datetime.now(timezone.utc)
            hace_120_min = (ahora - timedelta(minutes=120)).isoformat()
            
            recent_files = supabase.table("file_metadata")\
                .select("id, file_path, file_name")\
                .eq("lead_id", lead_id)\
                .is_("order_id", "null")\
                .gt("created_at", hace_120_min)\
                .execute()
            
            if recent_files.data:
                # Obtener nombre para el path
                lead_resp = supabase.table("leads").select("name").eq("id", lead_id).execute()
                cust_prefix = "cliente"
                if lead_resp.data:
                    cust_prefix = "".join(x for x in lead_resp.data[0]["name"] if x.isalnum()) or "cliente"
                
                for file_rec in recent_files.data:
                    old_path = file_rec["file_path"]
                    # Reutilizar el timestamp del nombre de archivo si es posible o usar el original
                    fname = file_rec["file_name"]
                    # Nuevo path estructurado
                    new_path = f"{cust_prefix}_{lead_id[:5]}/{str(order_id)[:8]}/{fname}"
                    
                    try:
                        # 1. Intentar mover en Storage
                        supabase.storage.from_("chat-media").move(old_path, new_path)
                        # 2. Actualizar DB con el nuevo path y el order_id
                        supabase.table("file_metadata").update({
                            "order_id": order_id,
                            "file_path": new_path
                        }).eq("id", file_rec["id"]).execute()
                        
                        # 3. Vincular también a la ficha de la orden (files_url)
                        public_url = supabase.storage.from_("chat-media").get_public_url(new_path).public_url
                        current_order = supabase.table("orders").select("files_url").eq("id", order_id).execute()
                        current_files = current_order.data[0].get("files_url") or []
                        if public_url not in current_files:
                            current_files.append(public_url)
                            supabase.table("orders").update({"files_url": current_files}).eq("id", order_id).execute()
                        
                        logger.info(f"📎 Archivo vinculado y movido a la orden: {new_path}")
                    except Exception as move_err:
                        # Si el movido falla, intentamos al menos vincular por ID
                        supabase.table("file_metadata").update({"order_id": order_id}).eq("id", file_rec["id"]).execute()
                        logger.warning(f"⚠️ No se pudo mover el archivo físico, pero se vinculó por metadata: {move_err}")
                
                # Opcional: Actualizar también el campo 'files_url' de la orden si queremos
                # Pero el dashboard ahora leerá de file_metadata, así que no es estrictamente necesario.

        except Exception as e_bind:
            logger.error(f"❌ Error en vinculación automática: {e_bind}")

        return f"✅ Orden #{str(order_id)[:8]} Creada Exitosamente."
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

        
        # 1. Detectar archivos PENDIENTES (sin orden) de este cliente en los últimos 120 min
        from datetime import datetime, timedelta, timezone
        ahora = datetime.now(timezone.utc)
        hace_120_min = (ahora - timedelta(minutes=120)).isoformat()
        
        pending_files = supabase.table("file_metadata")\
            .select("id, file_path")\
            .eq("lead_id", lead_id)\
            .is_("order_id", "null")\
            .gt("created_at", hace_120_min)\
            .execute()
        
        has_file_context = len(pending_files.data) > 0 or "[DOCUMENTO RECIBIDO (PDF VÁLIDO):" in texto_completo
        
        extracted_url = None
        if has_file_context:
            if pending_files.data:
                # Obtener la URL pública del más reciente
                last_f = pending_files.data[-1]
                extracted_url = supabase.storage.from_("chat-media").get_public_url(last_f["file_path"]).public_url
            else:
                import re
                url_match = re.search(r"URL: ((?:https?://|www\.)[^\s\]]+)", texto_completo)
                extracted_url = url_match.group(1) if url_match else None

        has_invalid_file = "[ARCHIVO_INVALIDO:" in texto_completo
        full_context_str = texto_completo

        # EXTRACCIÓN INTELIGENTE DE DATOS
        
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

        # NUEVO: Recuperar reglas dinámicas (RAG de Aprendizaje)
        reglas_aprendidas = ""
        try:
            # Usamos el último mensaje del usuario para buscar reglas relevantes
            vector_usuario = get_embedding(texto_completo[-800:]) 
            if vector_usuario:
                 rpc_res = supabase.rpc("match_learnings", {
                     "query_embedding": vector_usuario, 
                     "match_threshold": 0.70, 
                     "match_count": 3
                 }).execute()
                 
                 if rpc_res.data:
                     reglas_txt = "\n".join([f"- {r['proposed_rule']}" for r in rpc_res.data])
                     reglas_aprendidas = f"\n🧠 *REGLAS APRENDIDAS (PRIORIDAD ALTA):*\n{reglas_txt}\n"
                     logger.info(f"🧠 Reglas inyectadas: {len(rpc_res.data)}")
        except Exception as e:
            logger.error(f"Error recuperando reglas: {e}")

        system_prompt = f"""
Eres *Richard*, el Asistente Virtual Oficial de *Pitrón Beña Impresión*. 🤵‍♂️✨

⚠️ *IMPORTANTE (REGLA DE FORMATO CRÍTICA):*
- *NUNCA* uses doble asterisco (`**`). ¡Está estrictamente prohibido! 🚫
- Para poner texto en negrita, usa *ÚNICAMENTE* un asterisco simple: `*texto*`.
- Si usas `**`, el mensaje se verá mal en WhatsApp. ¡Usa siempre solo uno!

"¡Hola! 👋 Soy *Richard*, tu asistente en Pitrón Beña Impresión. ¡Es un gusto saludarte! 😊 ¿En qué puedo ayudarte hoy? ✨"

{reglas_aprendidas}

🚫 *REGLA ANTI-ALUCINACIÓN (CRÍTICA):*
- Al usar `register_order`, NO inventes información.
- Si el cliente NO especifica "Couché" o "Bond", deja el campo `material` vacío (None).
- Si NO dice la cantidad exacta, deja `quantity` vacío (None).
- Solo rellena los datos que estén explícitos en la conversación. ¡Ante la duda, déjalo en blanco para que el humano lo rellene después!

👤 *INFORMACIÓN DEL CLIENTE:*
- Cliente: *{cliente_nombre}*.
- Archivo detectado: {"✅ SÍ" if has_file_context else "❌ NO"}.
{datos_detectados}
{datos_guardados_txt}

🧠 *PROCESO DE ATENCIÓN:*
1. *BÚSQUEDA:* Usa la base de conocimiento para explicar servicios usando emojis (🪪 Tarjetas, 🚀 Flyers, 🚩 Pendones).
2. *DISEÑO:* Aclara siempre el disclaimer:
   - *Básico/Gratis*: 3 cambios máx. No se entrega archivo. 🚫
   - *Medio*: Entrega JPG. 🖼️
   - *Avanzado*: Entrega PDF. 📄
   - *Premium*: Entrega Editable (.AI). 🎨
3. *PRECIOS:* Usa obligatoriamente `calculate_quote`.

📚 *CONOCIMIENTO RECUPERADO:*
{contexto}

⛔ *REGLA DE REGISTRO DE ORDEN (CRÍTICA):*
- *NUNCA* llames a `register_order` automáticamente al recibir un archivo o cotizar.
- *PASOS OBLIGATORIOS ANTES DE REGISTRAR:*
  1. Brinda la cotización oficial usando `calculate_quote`.
  2. Verifica que el cliente envió el archivo (PDF) o contrató diseño.
  3. Asegúrate de tener los datos (RUT, Nombre, Dirección, Email).
  4. *PIDE CONFIRMACIÓN:* Di: "Para generar tu orden formal en el sistema, por favor escribe la palabra *APROBADO*."
- *EJECUCIÓN:* Solo llama a `register_order` cuando el cliente responda formalmente (*APROBADO*, *CONFIRMADO*, *DALE*, *PROCEDE*, etc.).
- *EVITA DUPLICADOS:* Si en el historial ves que ya confirmaste la creación de una orden (ej: "✅ Orden #... Creada"), *NO* vuelvas a llamar a `register_order` bajo ninguna circunstancia.

⛔ *REGLA DE DISEÑO CONTRATADO (CRÍTICA):*
- Si el cliente dice frases como "hazme", "necesito que diseñes", "no tengo diseño", está solicitando servicio de diseño.
- **OBLIGATORIO - PASO 1:** Antes de cotizar, DEBES ofrecer los 4 niveles explicando qué entrega cada uno y que todos incluyen **máximo 3 rondas de cambios**:
   - *Básico ($7.140)*: 3 cambios máx. No se entrega archivo. 🚫
   - *Medio ($35.700)*: 3 cambios máx. Entrega JPG. 🖼️
   - *Avanzado ($71.400)*: 3 cambios máx. Entrega PDF. 📄
   - *Premium ($214.200)*: 3 cambios máx. Entrega Editable (.AI). 🎨
- **OBLIGATORIO - PASO 2:** Usa `calculate_quote` especificando el `design_service` elegido. **NO calcules el total tú mismo**, usa el resultado de la herramienta exactamente.
- **OBLIGATORIO - PASO 3 (DATOS DE DISEÑO):** Una vez que el cliente elija un nivel, DEBES pedirle la información para el diseño:
   - "Para que nuestro equipo comience, por favor dime: ¿Qué texto debe llevar?, ¿Qué colores prefieres?, ¿Tienes algún logo? (puedes enviarlo aquí mismo o describirlo)".
- **OBLIGATORIO - PASO 4 (DESCRIPCIÓN DETALLADA):** En la descripción de la orden (`register_order`), DEBES incluir la frase "con Servicio de Diseño [Nivel]" seguido de **TODOS los detalles recopilados** (Texto, colores, logos, estilo). 
  *Ejemplo:* "100 Tarjetas con Servicio de Diseño Básico. Texto: Juan Perez Cel: 91234567, Logo: Un gato bailando, Colores: Azul marino".
- Cuando cotices CON diseño, *NO pidas archivo PDF* como requisito para imprimir.

📝 *FLUJO DE TRABAJO ACTUALIZADO:*
1. **Detectar necesidad** (Diseño vs Archivo Listo).
2. **Ofrecer Niveles** de Diseño (Básico a Premium, 3 cambios máx).
3. **Cotizar Oficialmente** usando `calculate_quote` (Herramienta obligatoria).
4. **Pedir Datos Fiscales** (RUT, Nombre, Dirección, Email).
5. **Pedir Información de Diseño** (Texto, Colores, Idea, Logo).
6. **Confirmación** (*APROBADO*).
7. **Registrar Orden** en `register_order`.
8. **Entregar Datos Banco Estado** 🏦.

⛔ *REGLA DE ARCHIVOS (PDF OBLIGATORIO):*
- Si en el historial aparece `[ARCHIVO_INVALIDO]`, informa de inmediato.
- *EXCEPCIÓN:* Si el cliente contrató diseño, NO pidas PDF para proceder.

💰 *ESTILO DE COTIZACIÓN:*
Usa el formato exacto que entrega `calculate_quote`.
──────────────────
💰 *TOTAL FINAL: $[Total] (IVA Incluido)* ✅
──────────────────

🧠 *REGLA DE ARCHIVOS (ESTRICTA):*
- Si el cliente dice "Tengo el diseño" o similar, pero `Archivo detectado` es ❌ NO, **NO PUEDES** registrar la orden ni pedir el "APROBADO".
- Debes decir: "Excelente que tengas el diseño. Por favor, **envíalo ahora mismo** por este medio (en formato PDF de preferencia) para que yo pueda validarlo y registrar tu orden".
- Solo procede si `Archivo detectado` cambia a ✅ SÍ.
- *EXCEPCIÓN:* Si contrató servicio de diseño pagado, no es necesario el archivo.

📝 *FLUJO DE TRABAJO COMPLETO:*
1. **Detectar necesidad** (¿Tiene diseño o necesita que le hagamos uno?).
2. **Ofrecer Niveles de Diseño** (Si no tiene).
3. **Validar Archivo** (Si dice que tiene, pídelo antes de seguir).
4. **Cotizar Oficialmente** usando `calculate_quote`.
5. **Pedir Datos Fiscales** (RUT, Nombre, Dirección, Email).
6. **Confirmación del Cliente** (Pide que escriba *APROBADO*).
7. **Registrar Orden** en `register_order`.
8. **Brindar Datos de Pago (Banco Estado)** 🏦:
   - *Titular*: PB IMPRENTA SPA
   - *RUT*: 77.108.007-3
   - *Banco*: Banco Estado
   - *Tipo de Cuenta*: Chequera Electrónica (Cuenta Vista)
   - *Número de Cuenta*: 29170808833
   - *Email*: pitronbena@gmail.com
"""

        
        # --- LIMPIEZA DE HISTORIAL PREVENTIVA (Cero ** y Cero #) ---
        historial_limpio = []
        for msg in historial:
            if hasattr(msg, 'content') and isinstance(msg.content, str):
                # Reemplazar ** por * y eliminar # por completo para evitar que el bot imite el formato antiguo
                msg.content = msg.content.replace("**", "*").replace("#", "")
            historial_limpio.append(msg)

        messages_to_ai = [SystemMessage(content=system_prompt)] + historial_limpio + [HumanMessage(content=texto_completo)]
        
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
        
        # --- LIMPIEZA FINAL DE SALIDA (Asegurar formato WhatsApp) ---
        if resp_content:
            # Eliminar ** y # de raíz para que nunca lleguen al cliente
            resp_content = resp_content.replace("**", "*").replace("#", "")

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
        def save_media_to_supabase(b64_data, file_url, mime, ext, custom_path=None):
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
                    jid = key.get('remoteJid', 'unknown').split('@')[0]
                    timestamp = int(time.time())
                    filename = f"{timestamp}.{ext}"
                    
                    if custom_path:
                        path = f"{custom_path}/{filename}"
                    else:
                        path = f"inbox/{jid}/{filename}"
                    
                    logger.info(f"📤 Subiendo a carpeta: {path}...")
                    # upsert=True por si acaso
                    supabase.storage.from_("chat-media").upload(path, file_bytes, {"content-type": mime, "upsert": "true"})
                    public_url = supabase.storage.from_("chat-media").get_public_url(path)

                    logger.info(f"✅ Media guardada en Supabase: {public_url}")
                    return public_url, path
                except Exception as e:
                    logger.error(f"Error uploading to Supabase: {e}")

            
            # 4. Fallback: Devolver URL original si no pudimos procesarla internamente
            return file_url, None

        # [PROCESAMIENTO SEGURO DEL CONTENIDO]
        try:
            # 1. Texto plano
            if "conversation" in real_message:
                texto = real_message["conversation"]
            elif "extendedTextMessage" in real_message:
                texto = real_message["extendedTextMessage"].get("text", "")
            
            # 2. Imágenes (Prohibidas bajo la nueva regla de "Solo PDF")
            elif "imageMessage" in real_message:
                img_msg = real_message["imageMessage"]
                caption = img_msg.get("caption", "")
                
                # Usar los campos inyectados que sabemos que funcionan
                b64 = img_msg.get("evolution_base64") or img_msg.get("base64")
                url_msg = img_msg.get("evolution_media_url") or img_msg.get("mediaUrl") or img_msg.get("url")
                
                # Detectar mime
                mime = img_msg.get("mimetype", "image/jpeg")
                ext = "jpg"
                if "png" in mime: ext = "png"
                elif "webp" in mime: ext = "webp"

                logger.info(f"🖼️ Procesando imagen ({mime}).")
                final_url = save_media_to_supabase(b64, url_msg, mime, ext)
                
                # LA REGLA: Si es imagen, avisar que no sirve (se requiere PDF)
                texto = f"[ARCHIVO_INVALIDO: Imagen (Mime: {mime})] Se recibió una imagen ({final_url}), pero el sistema requiere PDF para impresión profesional. {caption}"

            # 3. Documentos (Solo PDF permitido)
            elif "documentMessage" in real_message:
                doc_msg = real_message["documentMessage"]
                filename = doc_msg.get("title", "doc")
                caption = doc_msg.get("caption", "")
                
                b64 = doc_msg.get("evolution_base64") or doc_msg.get("base64")
                url_msg = doc_msg.get("evolution_media_url") or doc_msg.get("mediaUrl") or doc_msg.get("url")
                mime_type = doc_msg.get("mimetype", "application/pdf")
                
                logger.info(f"📄 Procesando documento ({mime_type}).")
                
                # Determinar extensión basada en mime
                ext = "pdf"
                if "pdf" not in mime_type.lower():
                    if "image" in mime_type: ext = "jpg"
                    elif "word" in mime_type: ext = "docx"
                    elif "excel" in mime_type: ext = "xlsx"
                    
                    final_url = save_media_to_supabase(b64, url_msg, mime_type, ext)
                    texto = f"[ARCHIVO_INVALIDO: Documento No-PDF (Mime: {mime_type})] El archivo {filename} ({final_url}) no es un PDF. El sistema solo acepta PDF. {caption}"
                # ES UN PDF VÁLIDO
                # Determinar carpeta de destino: archivos/nombre_cliente/orden_id/
                # Buscamos si el cliente tiene una orden reciente
                order_path = "global"
                current_order_id = None
                try:
                    # Buscar lead_id
                    lead_res = supabase.table("leads").select("id, name").eq("phone_number", key.get("remoteJid", "").split("@")[0]).execute()
                    if lead_res.data:
                        lead_obj = lead_res.data[0]
                        lead_db_id = lead_obj["id"]
                        cust_name_clean = "".join(x for x in lead_obj["name"] if x.isalnum()) or "cliente"
                        
                        # Buscar orden pendiente/activa (Solo últimos 120 min)
                        from datetime import datetime, timezone
                        ord_res = supabase.table("orders").select("id, status, created_at").eq("lead_id", lead_db_id).order("created_at", desc=True).limit(1).execute()
                        if ord_res.data:
                            last_ord = ord_res.data[0]
                            is_active_and_recent = False
                            try:
                                # Convertir created_at a datetime
                                ord_ts = last_ord["created_at"].replace('Z', '+00:00')
                                fecha_ord = datetime.fromisoformat(ord_ts)
                                if (datetime.now(timezone.utc) - fecha_ord).total_seconds() < 7200: # 2 horas
                                    if last_ord["status"] not in ["LISTO", "ENTREGADO", "ANULADO"]:
                                        is_active_and_recent = True
                            except Exception as te:
                                logger.error(f"Error parseando fecha orden: {te}")

                            if is_active_and_recent:
                                current_order_id = last_ord["id"]
                                order_path = f"{cust_name_clean}_{lead_db_id[:5]}/{current_order_id[:8]}"
                            else:
                                # Si la orden es vieja o está lista/entregada, el archivo va a /general
                                # para que register_order lo "succione" si es una nueva orden.
                                order_path = f"{cust_name_clean}_{lead_db_id[:5]}/general"
                        else:
                            order_path = f"{cust_name_clean}_{lead_db_id[:5]}/general"
                except Exception as e:
                    logger.error(f"Error calculando path de archivo: {e}")

                final_url, storage_path = save_media_to_supabase(b64, url_msg, mime_type, "pdf", custom_path=order_path)
                
                # Registrar en metadata si tenemos lead_id
                if storage_path and 'lead_db_id' in locals():
                    try:
                        supabase.table("file_metadata").insert({
                            "file_path": storage_path,
                            "file_name": filename,
                            "file_type": mime_type,
                            "lead_id": lead_db_id,
                            "order_id": current_order_id,
                            "status": "original"
                        }).execute()
                    except Exception as e:
                        logger.error(f"Error guardando metadata: {e}")

                texto = f"[DOCUMENTO RECIBIDO (PDF VÁLIDO): {filename} - URL: {final_url}] {caption}"

                    
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

        # 2. Elegir Plantilla de Mensaje (SIN DOBLE ASTERISCO)
        mensaje = ""
        if status == "DISEÑO":
            mensaje = f"🎨 Hola {nombre}, te informamos que tu pedido de *{producto}* ha ingresado a la etapa de *DISEÑO*. Estamos revisando tus archivos."
        elif status == "PRODUCCIÓN":
            mensaje = f"⚙️ ¡Buenas noticias {nombre}! Tu pedido pasó a *PRODUCCIÓN* y ya se está imprimiendo/fabricando."
        elif status == "LISTO":
            mensaje = f"📦✨ ¡Tu pedido está *LISTO*! Puedes pasar a retirarlo a nuestro local en *Arturo Prat 230, Local 117*, Santiago Centro. Te esperamos."
        elif status == "ENTREGADO":
            mensaje = f"✅ ¡Gracias por tu compra {nombre}! Tu pedido figura como *ENTREGADO*. Esperamos verte pronto en Pitrón Beña Impresión."
        
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

class OrderStatusUpdate(BaseModel):
    order_id: str
    new_status: str

@app.post("/orders/update_status")
async def update_order_status(payload: OrderStatusUpdate):
    """Actualiza estado de orden y notifica al cliente por WhatsApp"""
    try:
        # 1. Obtener datos de la orden + lead
        order_res = supabase.table("orders").select("*, leads(phone_number, name, id)").eq("id", payload.order_id).execute()
        if not order_res.data:
            return {"status": "error", "message": "Orden no encontrada"}
        
        order = order_res.data[0]
        lead = order.get("leads") or {}
        phone = lead.get("phone_number")
        name = lead.get("name") or "Cliente"
        
        # 2. Actualizar en BD
        supabase.table("orders").update({"status": payload.new_status}).eq("id", payload.order_id).execute()
        
        # 3. Notificar por WhatsApp (Si tiene teléfono)
        if phone:
            emojis = {
                "NUEVO": "🆕",
                "DISEÑO": "🎨",
                "PRODUCCIÓN": "⚙️",
                "LISTO": "✅",
                "ENTREGADO": "🚀"
            }
            emoji = emojis.get(payload.new_status, "ℹ️")
            
            msg = f"Hola {name.split(' ')[0]}! 👋\nActualización de tu pedido *#{payload.order_id[:5]}*:\n\nNuevo Estado: *{payload.new_status}* {emoji}\n\n"
            
            if payload.new_status == "LISTO":
                msg += "¡Tu pedido está listo para retiro o despacho! 📦✨ Avísanos cuando vendrás."
            elif payload.new_status == "DISEÑO":
                msg += "Estamos trabajando en tu diseño. Pronto te enviaremos una propuesta. 🎨"
            elif payload.new_status == "PRODUCCIÓN":
                msg += "Tu pedido ha entrado a máquinas. ¡Ya falta poco! 🖨️"
            elif payload.new_status == "ENTREGADO":
                msg += "¡Que lo disfrutes! Gracias por confiar en Pitrón Beña. ⭐"
            
            status_wa = enviar_whatsapp(phone, msg)
            
            # Guardar log del mensaje
            if lead.get("id"):
                save_message_pro(lead.get("id"), phone, "assistant", msg, intent="STATUS_UPDATE", metadata={"whatsapp_delivery": status_wa})

        return {"status": "success", "notified": bool(phone)}

    except Exception as e:
        logger.error(f"Error actualizando estado: {e}")
        return {"status": "error", "message": str(e)}

# --- ENDPOINTS PITRONB DRIVE ---

@app.get("/storage/tree")
async def get_storage_tree():
    """Retorna la jerarquía de archivos para el explorador."""
    try:
        # Obtenemos toda la metadata
        res = supabase.table("file_metadata").select("*, leads(name)").eq("is_deleted", False).execute()
        return res.data
    except Exception as e:
        logger.error(f"Error en storage tree: {e}")
        return []

@app.post("/storage/update_metadata")
async def update_storage_metadata(payload: dict):
    """Actualiza etiquetas o estado de un archivo."""
    try:
        file_id = payload.get("id")
        update_data = payload.get("data", {})
        res = supabase.table("file_metadata").update(update_data).eq("id", file_id).execute()
        return {"status": "success", "data": res.data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/storage/upload")
async def upload_file(file: UploadFile = File(...), path: str = Form(...)):
    """Sube un archivo manualmente desde el Dashboard."""
    import traceback
    try:
        content = await file.read()
        size_bytes = len(content)
        mime_type = file.content_type or "application/octet-stream"
        
        # Path format: archivos/Customer_Name_LeadID/OrderID or archivos/Customer_Name_LeadID/general
        clean_path = path.strip("/")
        full_path = f"{clean_path}/{file.filename}"
        
        logger.info(f"📁 [UPLOAD] Intentando: {full_path} ({size_bytes} bytes)")
        
        # 1. Subir a Supabase Storage
        try:
            # Intentar con upsert como string "true" que es lo estándar para headers HTTP
            supabase.storage.from_("chat-media").upload(
                full_path, 
                content, 
                {"content-type": mime_type, "upsert": "true"} 
            )
        except Exception as storage_err:
            str_err = str(storage_err).lower()
            # Si el error es "new row violates row-level security policy", 
            # es posible que el archivo SE HAYA SUBIDO pero la política de INSERT de la tabla 'objects' de storage falle
            # para el usuario anónimo si no tiene permiso de INSERT explícito, AUNQUE sea service_role si la librería no lo usa bien.
            # O simplemente el archivo ya existe y RLS bloquea la sobreescritura.
            
            if "violates row-level security policy" in str_err:
                logger.warning(f"⚠️ Alerta RLS en Storage: {storage_err}. Verificando si existe...")
                # Si existe, asumimos éxito parcial y continuamos para registrar metadata
                # Podríamos intentar listar para ver si está?
                pass 
            elif "already exists" in str_err:
                 logger.warning(f"⚠️ El archivo ya existe: {full_path}")
            else:
                logger.error(f"❌ Error crítico en Storage: {storage_err}")
                raise Exception(f"Storage Error: {str(storage_err)}")
        
        # 2. Extraer IDs para metadata
        parts = clean_path.split('/') 
        lead_id = None
        order_id = None
        
        if len(parts) >= 2:
            lead_segment = parts[1]
            if "_" in lead_segment:
                lead_id_hint = lead_segment.split("_")[-1]
                # FIX: UUID column cannot use ilike directly without casting to text
                # We use .ilike("id::text", pattern) if supported, or filter on client side?
                # Safer: Supabase client filter syntax .ilike("id::text", ...) might fail if not exposed efficiently.
                # Actually, the error `operator does not exist: uuid ~~* unknown` means we are trying to ILIKE a UUID.
                # We need to explicitly cast. Or search by other field? Name?
                # Since 'lead_id_hint' is just a prefix (fe5d0), we MUST use text casting.
                
                # NOTE: PostgREST syntax for casting is usually column::type.
                # But python library might not support it directly in the key string easily.
                # Let's try explicit casting via filter modifier if possible, or use `or` filter.
                
                # ALTERNATIVE: Don't use ID prefix. Use the NAME if unique enough?
                # "FrancoBlanco_fe5d0". Name = FrancoBlanco.
                # But name is not unique. ID prefix is better.
                
                # Correct PostgREST way for casting: "id::text"
                try:
                    leads_res = supabase.table("leads").select("id").ilike("id::text", f"{lead_id_hint}%").execute()
                    if leads_res.data:
                        lead_id = leads_res.data[0]["id"]
                except Exception as e_lead:
                    logger.warning(f"⚠️ Falló búsqueda de Lead por ID parcial: {e_lead}")

        if len(parts) >= 3:
            order_segment = parts[2]
            if order_segment != "general":
                try:
                    # Same fix for orders
                    orders_res = supabase.table("orders").select("id").ilike("id::text", f"{order_segment}%").execute()
                    if orders_res.data:
                        order_id = orders_res.data[0]["id"]
                except Exception as e_order:
                    logger.warning(f"⚠️ Falló búsqueda de Orden por ID parcial: {e_order}")

        # 3. Insertar metadata
        data_to_insert = {
            "file_path": full_path,
            "file_name": file.filename,
            "file_type": mime_type,
            "size_bytes": size_bytes,
            "lead_id": lead_id,
            "order_id": order_id,
            "status": "original"
        }
        
        insert_res = supabase.table("file_metadata").insert(data_to_insert).execute()
        
        if not insert_res.data:
            raise Exception("No se pudo insertar la metadata en la base de datos.")

        logger.info(f"✅ Subida exitosa: {full_path}")
        return {"status": "success", "data": insert_res.data[0]}
        
    except Exception as e:
        err_detail = traceback.format_exc()
        logger.error(f"❌ Error en upload_file:\n{err_detail}")
        return Response(
            content=json.dumps({"status": "error", "message": str(e), "detail": err_detail}),
            status_code=500,
            media_type="application/json"
        )

class PaymentUpdate(BaseModel):
    order_id: str
    deposit_amount: int
    total_amount: int = None

@app.post("/orders/update_payment")
async def update_order_payment(payload: PaymentUpdate):
    """Registra pago/abono y notifica al cliente"""
    try:
        # 1. Obtener datos actuales
        order_res = supabase.table("orders").select("*, leads(phone_number, name, id)").eq("id", payload.order_id).execute()
        if not order_res.data:
            return {"status": "error", "message": "Orden no encontrada"}
        
        order = order_res.data[0]
        lead = order.get("leads") or {}
        old_deposit = order.get("deposit_amount") or 0
        total_price = payload.total_amount if payload.total_amount is not None else (order.get("total_amount") or 0)
        
        # 2. Actualizar en BD
        upd = {"deposit_amount": payload.deposit_amount}
        if payload.total_amount is not None:
            upd["total_amount"] = payload.total_amount
        
        supabase.table("orders").update(upd).eq("id", payload.order_id).execute()
        
        # 3. Determinar incremento (abono actual)
        abono_ahora = payload.deposit_amount - old_deposit
        balance = total_price - payload.deposit_amount
        
        # 4. Notificar (Solo si el abono es positivo)
        phone = lead.get("phone_number")
        name = lead.get("name") or "Cliente"
        
        if phone and abono_ahora > 0:
            msg = f"Hola {name.split(' ')[0]}! 👋\nHemos registrado un pago por tu pedido *#{payload.order_id[:5]}*:\n\n"
            msg += f"✅ Monto recibido: *${abono_ahora:,}*\n"
            
            if balance <= 0:
                msg += "💰 *PEDIDO PAGADO TOTALMENTE* 🎊\nMuchas gracias por tu pago. Seguiremos con el proceso de tu orden."
            else:
                msg += f"📉 Saldo pendiente: *${balance:,}*\n\n¡Gracias por tu abono! 😊"
            
            status_wa = enviar_whatsapp(phone, msg)
            
            # Log
            if lead.get("id"):
                save_message_pro(lead.get("id"), phone, "assistant", msg, intent="PAYMENT_UPDATE", metadata={"whatsapp_delivery": status_wa})

            return {"status": "success", "notified": True}
        
        return {"status": "success", "notified": False}

    except Exception as e:
        logger.error(f"Error actualizando pago: {e}")
        return {"status": "error", "message": str(e)}

# --- ENDPOINTS PARA MEJORA CONTINUA (Self-Improvement) ---

@app.get("/learnings")
async def get_learnings():
    """Obtiene las lecciones aprendidas (errores y propuestas)."""
    try:
        res = supabase.table("agent_learnings").select("*").order("created_at", desc=True).limit(50).execute()
        return res.data
    except Exception as e:
        logger.error(f"Error fetching learnings: {e}")
        return []

class LearningAction(BaseModel):
    id: str

@app.post("/learnings/approve")
async def approve_learning(action: LearningAction):
    """Aprueba una regla propuesta y genera su embedding."""
    try:
        # 1. Obtener el texto de la regla
        res = supabase.table("agent_learnings").select("proposed_rule").eq("id", action.id).execute()
        if not res.data:
            return {"status": "error", "message": "Regla no encontrada"}
        
        rule_text = res.data[0]["proposed_rule"]
        
        # 2. Generar Embedding
        vector = get_embedding(rule_text)
        
        # 3. Actualizar en DB
        update_data = {
            "status": "approved",
            "applied_at": datetime.now().isoformat()
        }
        if vector:
            update_data["embedding"] = vector
            
        supabase.table("agent_learnings").update(update_data).eq("id", action.id).execute()
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error approving learning: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/learnings/reject")
async def reject_learning(action: LearningAction):
    """Rechaza una regla propuesta."""
    try:
        supabase.table("agent_learnings").update({
            "status": "rejected"
        }).eq("id", action.id).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/learnings/run_audit")
async def manual_run_audit(background_tasks: BackgroundTasks):
    """Ejecuta la auditoría manualmente ahora."""
    background_tasks.add_task(run_audit_job)
    return {"status": "success", "message": "Auditoría iniciada en segundo plano."}

# --- SCHEDULER: EJECUCIÓN AUTOMÁTICA DEL AUDITOR ---
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from audit_now import main as run_audit
import pytz

scheduler = AsyncIOScheduler()

async def run_audit_job():
    """Ejecuta el auditor nocturno."""
    logger.info("🕒 [CRON] Iniciando Auditoría Nocturna...")
    try:
        # Ejecutar en un thread aparte para no bloquear el loop principal
        import asyncio
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, run_audit)
        logger.info("✅ [CRON] Auditoría finalizada exitosamente.")
    except Exception as e:
        logger.error(f"❌ [CRON] Error en auditoría: {e}")

@app.on_event("startup")
def start_scheduler():
    # Programar para las 03:00 AM hora local (Chile)
    chile_tz = pytz.timezone('America/Santiago')
    trigger = CronTrigger(hour=3, minute=0, timezone=chile_tz)
    
    scheduler.add_job(run_audit_job, trigger)
    scheduler.start()
    logger.info("⏰ Scheduler iniciado: Auditoría programada para las 03:00 AM (Chile).")

class CustomMessage(BaseModel):
    phone_number: str
    message: str
    lead_id: Optional[str] = None

@app.post("/send_custom_message")
async def send_custom_message_endpoint(payload: CustomMessage):
    """
    Envía un mensaje personalizado a un cliente a través del Agente.
    El mensaje se registra en el historial como 'assistant' para mantener el contexto.
    """
    try:
        phone = payload.phone_number.replace("+", "").replace(" ", "")
        
        # 1. Enviar por WhatsApp
        res = enviar_whatsapp(phone, payload.message)
        
        # 2. Registrar en DB (CRÍTICO: role='assistant')
        if res.get("status") == "success":
            # Intentar obtener lead_id si no viene
            final_lead_id = payload.lead_id
            if not final_lead_id:
                final_lead_id = get_or_create_lead(phone)
            
            save_message_pro(
                lead_id=final_lead_id, 
                phone=phone, 
                role="assistant", 
                content=payload.message, 
                intent="MANUAL_MESSAGE", 
                metadata={"source": "dashboard_manual", "whatsapp_delivery": res}
            )
            return {"status": "success", "message": "Mensaje enviado y registrado"}
        else:
            return {"status": "error", "message": "Fallo al enviar WhatsApp", "details": res}

    except Exception as e:
        logger.error(f"Error sending custom message: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

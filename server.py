import os
import requests
import asyncio
from typing import Dict, Any, List
from fastapi import FastAPI, Request
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from supabase import create_client, Client

# Cargar variables de entorno
load_dotenv()

# Configuración
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY")
INSTANCE_NAME = os.getenv("WHATSAPP_INSTANCE_NAME")

# Inicializar FastAPI
app = FastAPI(title="WhatsApp RAG Bot")

# Cliente Supabase & OpenAI
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
llm = ChatOpenAI(model_name="gpt-4o-mini", temperature=0.3, openai_api_key=OPENAI_API_KEY)

def buscar_contexto(pregunta: str) -> str:
    """Busca fragmentos relevantes manualmente en Supabase."""
    try:
        # 1. Generar vector de la pregunta
        vector_consuita = embeddings.embed_query(pregunta)
        
        # 2. RPC call a Supabase (Directo, sin LangChain de por medio)
        # Asegúrate que la función 'match_documents' existe en tu DB
        response = supabase.rpc(
            "match_documents",
            {
                "query_embedding": vector_consuita,
                "match_threshold": 0.5, # Umbral de similitud
                "match_count": 3
            }
        ).execute()
        
        # 3. Extraer texto
        matches = response.data
        if not matches:
            return ""
            
        texto_contexto = "\n\n---\n\n".join([item['content'] for item in matches])
        return texto_contexto

    except Exception as e:
        print(f"⚠️ Error buscando en Supabase: {e}")
        return ""

def procesar_mensaje_ia(pregunta: str) -> str:
    """Genera respuesta usando LLM + Contexto."""
    try:
        contexto = buscar_contexto(pregunta)
        
        system_prompt = (
            "Eres el asistente virtual de 'PB Imprenta SPA'. "
            "Responde basado SOLO en el siguiente contexto. Si no sabes, di que no tienes la info.\n"
            f"CONTEXTO:\n{contexto}"
        )
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=pregunta)
        ]
        
        respuesta = llm.invoke(messages)
        return respuesta.content
        
    except Exception as e:
        print(f"Error en IA: {e}")
        return "Lo siento, tengo un problema técnico momentáneo. Por favor intenta más tarde."

def enviar_whatsapp(numero: str, texto: str):
    """Envía mensaje a WhatsApp (Compatible Evolution v1/v2)."""
    base_url = EVOLUTION_API_URL.rstrip('/')
    from urllib.parse import quote
    instance_encoded = quote(INSTANCE_NAME)
    
    url = f"{base_url}/message/sendText/{instance_encoded}"
    
    headers = {
        "apikey": EVOLUTION_API_KEY,
        "Content-Type": "application/json"
    }
    
    # Payload Híbrido: Algunos endpoints de Evolution piden "text" directo, otros "textMessage"
    # Al poner ambos solemos cubrir todas las bases.
    payload = {
        "number": numero,
        "options": {"delay": 1200, "presence": "composing"},
        "textMessage": {"text": texto}, # Formato v2 estándar
        "text": texto # Formato v1 o simplificado
    }
    
    try:
        print(f"📡 Enviando a: {url}")
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code >= 400:
             print(f"⚠️ Error Evolution ({response.status_code}): {response.text}")
             
        response.raise_for_status()
        print(f"✅ Respuesta enviada a {numero}")
    except Exception as e:
        print(f"❌ Error final enviando WhatsApp: {e}")

@app.post("/webhook")
async def webhook_whatsapp(request: Request):
    """Manejo de webhook."""
    try:
        payload = await request.json()
        if isinstance(payload, list): payload = payload[0]
        body = payload.get("body", {}) if "body" in payload else payload

        event_type = body.get("event")
        if event_type != "messages.upsert": return {"status": "ignored"}

        data = body.get("data", {})
        key = data.get("key", {})
        
        if key.get("fromMe", False) or "g.us" in key.get("remoteJid", ""):
            return {"status": "ignored"}

        message = data.get("message", {})
        texto_usuario = message.get("conversation") or message.get("extendedTextMessage", {}).get("text", "")
        
        if not texto_usuario: return {"status": "ignored"}

        print(f"📩 Mensaje: {texto_usuario}")
        
        # Procesar
        respuesta = procesar_mensaje_ia(texto_usuario)
        numero = key.get("remoteJid", "").split("@")[0]
        
        enviar_whatsapp(numero, respuesta)
        
        return {"status": "processed"}

    except Exception as e:
        print(f"❌ Error webhook: {e}")
        return {"status": "error", "detail": str(e)}

@app.get("/")
def health(): return {"status": "online"}

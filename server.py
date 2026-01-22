import os
import requests
from typing import Dict, Any
from fastapi import FastAPI, Request, HTTPException
from dotenv import load_dotenv
from pydantic import BaseModel

# LangChain & Supabase Imports
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import SupabaseVectorStore
from langchain.chains import RetrievalQA
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

# Cliente Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)

# Vector Store (Conexión a la memoria)
# Nota: Pasamos el cliente directamente. LangChain manejará la consulta.
vector_store = SupabaseVectorStore(
    client=supabase,
    embedding=embeddings,
    table_name="documents",
    query_name="match_documents"
)

# LLM (Cerebro)
llm = ChatOpenAI(
    model_name="gpt-4o-mini",
    temperature=0.3,
    openai_api_key=OPENAI_API_KEY
)

# Cadena de RAG (Retrieval Augmented Generation)
# Actualizado a 'invoke' en lugar de 'run' para evitar warnings
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",
    retriever=vector_store.as_retriever(search_kwargs={"k": 3}),
    return_source_documents=False
)

def procesar_mensaje_ia(pregunta: str) -> str:
    """Busca en la base de datos y genera una respuesta."""
    try:
        system_prompt = (
            "Eres un asistente virtual útil y amable de 'PB Imprenta SPA'. "
            "Usa la siguiente información de contexto para responder a la pregunta del usuario. "
            "Si no sabes la respuesta basándote en el contexto, di honestamente que no tienes esa información "
            "y sugiere contactar a un humano. Responde de forma breve y cordial."
        )
        
        # Usamos invoke() que es el método moderno
        respuesta = qa_chain.invoke(f"{system_prompt}\n\Pregunta: {pregunta}")
        
        # RetrievalQA a veces devuelve un dict {'query': '...', 'result': '...'}
        if isinstance(respuesta, dict) and 'result' in respuesta:
            return respuesta['result']
        return str(respuesta)
        
    except Exception as e:
        print(f"Error en IA: {e}")
        # Fallback simple si falla la vector store: responder algo genérico
        return "¡Hola! Estoy teniendo un pequeño problema técnico para consultar mi base de datos, pero soy el asistente de PB Imprenta. ¿En qué puedo ayudarte?"

def enviar_whatsapp(numero: str, texto: str):
    """Envía un mensaje usando Evolution API."""
    # Aseguramos que el endpoint esté limpio
    base_url = EVOLUTION_API_URL.rstrip('/')
    
    # IMPORTANTE: Encodeamos el nombre de la instancia correctamente para URL
    from urllib.parse import quote
    instance_encoded = quote(INSTANCE_NAME)
    
    url = f"{base_url}/message/sendText/{instance_encoded}"
    
    headers = {
        "apikey": EVOLUTION_API_KEY,
        "Content-Type": "application/json"
    }
    
    # Payload estándar de Evolution v2
    payload = {
        "number": numero, # Evolution suele aceptar formato internacional sin + (569...)
        "options": {
            "delay": 1200,
            "presence": "composing",
        },
        "textMessage": {
            "text": texto
        }
    }
    
    try:
        print(f"📡 Enviando a: {url}")
        response = requests.post(url, json=payload, headers=headers)
        
        # Si falla con 400, intentamos imprimir detalle
        if response.status_code != 200 and response.status_code != 201:
            print(f"⚠️ Error Evolution ({response.status_code}): {response.text}")
            
        response.raise_for_status()
        print(f"✅ Respuesta enviada a {numero}")
    except Exception as e:
        print(f"❌ Error enviando WhatsApp: {e}")

@app.post("/webhook")
async def webhook_whatsapp(request: Request):
    """Endpoint que recibe los eventos de Evolution API."""
    try:
        # Evolution API a veces envía el JSON directamente o dentro de un array
        # El JSON compartido muestra que es un array o un objeto con "body"
        payload = await request.json()
        
        # Si llega como una lista (caso n8n o batch), tomamos el primer elemento
        if isinstance(payload, list):
            payload = payload[0]

        # El contenido real suele estar dentro de 'body' según tu ejemplo
        body = payload.get("body", {}) if "body" in payload else payload
        
        # Validar tipo de evento (solo nos interesa 'messages.upsert')
        event_type = body.get("event")
        if event_type != "messages.upsert":
            return {"status": "ignored", "reason": "not_upsert"}

        data = body.get("data", {})
        key = data.get("key", {})
        message = data.get("message", {})
        
        # 1. Ignorar mensajes enviados por mí mismo (fromMe: true)
        if key.get("fromMe", False):
            return {"status": "ignored", "reason": "fromMe"}

        # 2. Ignorar mensajes de grupos (si termina en g.us)
        remote_jid = key.get("remoteJid", "") 
        if "g.us" in remote_jid:
            return {"status": "ignored", "reason": "group_message"}

        # 3. Extraer el texto del mensaje
        # Evolution API pone el texto en distintos lugares según el tipo
        texto_usuario = ""
        if "conversation" in message:
            texto_usuario = message["conversation"]
        elif "extendedTextMessage" in message:
            texto_usuario = message["extendedTextMessage"].get("text", "")
        
        # Si no hay texto (ej: es una imagen o audio), lo ignoramos por ahora
        if not texto_usuario:
            return {"status": "ignored", "reason": "no_text_found"}

        print(f"📩 Mensaje recibido de {remote_jid}: {texto_usuario}")

        # --- FLUJO PRINCIPAL ---
        
        # Paso A: Consultar a la IA
        respuesta_ia = procesar_mensaje_ia(texto_usuario)
        
        # Paso B: Enviar respuesta
        # Limpiamos el número para enviarlo (aunque Evolution suele aceptar JID)
        # De "56974263408@s.whatsapp.net" a "56974263408"
        numero_limpio = remote_jid.split("@")[0]
        
        enviar_whatsapp(numero_limpio, respuesta_ia)
        
        return {"status": "processed", "user": numero_limpio}

    except Exception as e:
        print(f"❌ Error crítico en webhook: {e}")
        # Retornamos 200 para que Evolution no reintente infinitamente
        return {"status": "error_handled", "detail": str(e)}

@app.get("/")
def health_check():
    return {"status": "ok", "service": "WhatsApp RAG Bot"}

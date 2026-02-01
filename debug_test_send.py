import os
import requests
from dotenv import load_dotenv
from urllib.parse import quote

load_dotenv()

url = os.getenv("EVOLUTION_API_URL").rstrip('/')
key = os.getenv("EVOLUTION_API_KEY")
instance = os.getenv("WHATSAPP_INSTANCE_NAME")

numero = "56974263408"
mensaje = "⚠️ Test de integración - Pitron Beña"

instance_encoded = quote(instance)
send_url = f"{url}/message/sendText/{instance_encoded}"

payload = {
    "number": numero,
    "options": {"delay": 1000, "presence": "composing"},
    "textMessage": {"text": mensaje},
    "text": mensaje
}

print(f"Sending test message to {numero}...")
try:
    resp = requests.post(send_url, json=payload, headers={"apikey": key, "Content-Type": "application/json"})
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"Error: {e}")

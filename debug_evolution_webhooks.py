import os
import requests
from dotenv import load_dotenv
from urllib.parse import quote

load_dotenv()

url = os.getenv("EVOLUTION_API_URL").rstrip('/')
key = os.getenv("EVOLUTION_API_KEY")
instance = os.getenv("WHATSAPP_INSTANCE_NAME")

instance_encoded = quote(instance)
webhook_url = f"{url}/webhook/find/{instance_encoded}"

print(f"Checking Webhooks for {instance}...")
try:
    resp = requests.get(webhook_url, headers={"apikey": key})
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"Error: {e}")

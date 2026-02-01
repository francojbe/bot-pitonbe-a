import os
import requests
import json
from dotenv import load_dotenv
from urllib.parse import quote

load_dotenv()

url = os.getenv("EVOLUTION_API_URL").rstrip('/')
key = os.getenv("EVOLUTION_API_KEY")
instance = os.getenv("WHATSAPP_INSTANCE_NAME")

instance_encoded = quote(instance)
# Endpoint to get instance info
info_url = f"{url}/instance/fetchInstances?instanceName={instance_encoded}"

print(f"Fetching Instance info for {instance}...")
try:
    resp = requests.get(info_url, headers={"apikey": key})
    print(f"Status Code: {resp.status_code}")
    data = resp.json()
    print(json.dumps(data, indent=2))
except Exception as e:
    print(f"Error: {e}")

import os
import requests
from dotenv import load_dotenv
from urllib.parse import quote

load_dotenv()

url = os.getenv("EVOLUTION_API_URL").rstrip('/')
key = os.getenv("EVOLUTION_API_KEY")
instance = os.getenv("WHATSAPP_INSTANCE_NAME")

print(f"Testing Evolution API...")
print(f"URL: {url}")
print(f"Instance: {instance}")

instance_encoded = quote(instance)
check_url = f"{url}/instance/connectionState/{instance_encoded}"

try:
    resp = requests.get(check_url, headers={"apikey": key})
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"Error: {e}")

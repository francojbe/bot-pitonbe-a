import requests
import json

url = "https://recuperadora-agente-pb.nojauc.easypanel.host/notify_update"
# Using an existing order ID from the database
order_id = "f907d9d9-e7c6-49c8-b5ea-89ff08fe3cba" # Flyers 5000

print(f"Testing notify_update for order {order_id}...")
payload = {
    "order_id": order_id,
    "new_status": "PRODUCCIÓN" # Changing to something else
}

try:
    resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"Error: {e}")

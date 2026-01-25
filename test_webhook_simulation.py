import requests
import json
import time

# Este script simula el envío de un webhook de imagen como el que manda Evolution API
payload = {
    "event": "messages.upsert",
    "instance": "test-instance",
    "data": {
        "key": {
            "remoteJid": "56974263408@s.whatsapp.net",
            "fromMe": False,
            "id": "TEST_ID_" + str(int(time.time()))
        },
        "message": {
            "imageMessage": {
                "url": "https://mmg.whatsapp.net/v/t62.7118-24/...",
                "mimetype": "image/jpeg",
                "caption": "Test de imagen desde script local",
                "fileLength": "12345",
                "height": 100,
                "width": 100
            }
        },
        "mediaUrl": "https://ia-odontologia-minio.nojauc.easypanel.host/evolution/media/test_image.jpg", # Una URL que "funcione" o simule
        "base64": "vVvVvVvVvVvVvVvVvVvV" # Basura para ver si falla
    }
}

# Intentar pegarle al webhook local
url = "http://localhost:8000/webhook/whatsapp"
try:
    print(f"Enviando payload a {url}...")
    # Usamos try-except por si el server no está arriba
    response = requests.post(url, json=payload, timeout=5)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}. (Es normal si el servidor no está corriendo localmente)")

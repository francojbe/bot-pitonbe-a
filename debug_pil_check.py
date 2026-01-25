import os
import requests
from PIL import Image
from io import BytesIO
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

def validate_last_image():
    print("--- VALIDANDO ÚLTIMA IMAGEN REGISTRADA ---")
    # Buscar mensaje de usuario que diga [IMAGEN RECIBIDA:
    res = supabase.table("message_logs").select("content").like("content", "%[IMAGEN RECIBIDA:%").order("created_at", desc=True).limit(1).execute()
    
    if not res.data:
        print("No se encontraron mensajes con imagen.")
        return

    content = res.data[0]['content']
    import re
    match = re.search(r'\[IMAGEN RECIBIDA: (https?://[^\]]+)\]', content)
    if not match:
        print(f"No se pudo extraer URL del contenido: {content}")
        return
    
    img_url = match.group(1).split(" ")[0].strip() # Limpiamos por si hay algo después
    print(f"URL detectada: {img_url}")

    try:
        resp = requests.get(img_url)
        if resp.status_code != 200:
            print(f"Error al descargar: {resp.status_code}")
            return
        
        data = resp.content
        print(f"Tamaño: {len(data)} bytes")
        print(f"Primeros 10 bytes (hex): {data[:10].hex(' ')}")
        
        try:
            img = Image.open(BytesIO(data))
            print(f"Formato detectado por PIL: {img.format}")
            print(f"Tamaño: {img.size}")
            print("✅ PIL pudo abrir la imagen correctamente.")
        except Exception as e:
            print(f"❌ PIL fallback error: {e}")
            print("Esto sugiere que el archivo está corrupto o no es una imagen válida.")
            
    except Exception as e:
        print(f"Error general: {e}")

if __name__ == "__main__":
    validate_last_image()

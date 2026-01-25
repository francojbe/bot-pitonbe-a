
import os
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def validate_latest_jpg():
    print("--- VALIDANDO ÚLTIMO JPG EN STORAGE ---")
    res = supabase.storage.from_("chat-media").list("inbox", {"limit": 10, "sortBy": {"column": "name", "order": "desc"}})
    if not res:
        print("No hay archivos.")
        return

    # Buscar el primer archivo que NO sea de test
    file_info = None
    for f in res:
        if "@s.whatsapp.net" in f['name']:
            file_info = f
            break
            
    if not file_info:
        print("No se encontraron imágenes de usuarios reales.")
        return

    name = file_info['name']
    url = supabase.storage.from_("chat-media").get_public_url(f"inbox/{name}")
    
    print(f"Archivo: {name}")
    print(f"URL: {url}")
    
    resp = requests.get(url)
    if resp.status_code == 200:
        content = resp.content
        print(f"Tamaño descargado: {len(content)} bytes")
        # Magic bytes para JPEG: FF D8 FF
        if content.startswith(b'\xff\xd8\xff'):
            print("✅ ES UN JPEG VÁLIDO (Magic bytes OK)")
        else:
            print(f"❌ NO ES UN JPEG VÁLIDO. Primeros 20 bytes: {content[:20].hex(' ')}")
            # Ver si es texto
            try:
                print(f"Contenido como texto (inicio): {content[:50].decode('utf-8')}")
            except:
                pass
    else:
        print(f"Error descargando: {resp.status_code}")

if __name__ == "__main__":
    validate_latest_jpg()

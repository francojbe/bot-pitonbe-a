
import os
import base64
import requests
import time
from supabase import create_client, Client
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERROR: Faltan credenciales de Supabase en .env")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Ruta de la imagen de prueba (usaremos la que acabo de generar)
# NOTA: Ajustaré la ruta dinámicamente o usaré una imagen dummy en memoria si no tengo la ruta exacta a mano,
# pero mejor creo una pequeña imagen base64 dummy aquí mismo para ser autónomo.

# Pequeña imagen GIF transparente de 1x1 pixel en Base64
DUMMY_BASE64_IMAGE = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

def save_media_to_supabase(b64_data, phone, ext="png"):
    print(f"🔄 Intentando subir imagen para {phone}...")
    try:
        if not b64_data:
            print("❌ No hay datos base64")
            return None

        file_bytes = base64.b64decode(b64_data)
        
        path = f"inbox/{phone}_{int(time.time()*1000)}.{ext}"
        bucket = "chat-media"
        
        print(f"📤 Subiendo a {bucket}/{path} ...")
        
        # Subir a Supabase Storage
        res = supabase.storage.from_(bucket).upload(
            path=path,
            file=file_bytes,
            file_options={"content-type": f"image/{ext}"}
        )
        
        # Obtener URL Pública
        public_url = supabase.storage.from_(bucket).get_public_url(path)
        print(f"✅ ÉXITO! URL Pública: {public_url}")
        return public_url

    except Exception as e:
        print(f"❌ ERROR CRÍTICO al subir: {e}")
        return None

# Ruta de la imagen real generada
REAL_IMAGE_PATH = r"C:/Users/franc/.gemini/antigravity/brain/424452b6-7112-471e-af90-12e5e6a2fa71/test_flyer_pitron_1769132355058.png"

if __name__ == "__main__":
    print("--- INICIANDO PRUEBA DE SUBIDA REAL (FLYER PNG) ---")
    
    try:
        with open(REAL_IMAGE_PATH, "rb") as image_file:
            # Leer binario y convertir a Base64 string
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            
        print(f"📄 Imagen leída: {REAL_IMAGE_PATH}")
        
        url = save_media_to_supabase(encoded_string, "569TEST_FLYER", "png")
        
        if url:
            print(f"\n🎉 PRUEBA COMPLETADA. Revisa tu Supabase:\n{url}")
        else:
            print("\n💀 PRUEBA FALLIDA.")
            
    except Exception as e:
        print(f"❌ Error al leer archivo local: {e}")

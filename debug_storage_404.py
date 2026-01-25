import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

def deep_inspect_storage():
    bucket_id = "chat-media"
    exact_name = "56974263408@s.whatsapp.net_1769136083.jpg"
    print(f"--- BUSCANDO ARCHIVO EXACTO: {exact_name} ---")
    
    try:
        files = supabase.storage.from_(bucket_id).list("inbox")
        found = False
        for f in files:
            if f['name'] == exact_name:
                print(f"✅ ¡ENCONTRADO! Tamaño: {f.get('metadata', {}).get('size')} bytes")
                found = True
                break
        
        if not found:
            print(f"❌ No se encontró el archivo exacto. Mostrando los últimos 10:")
            # Sort manually
            sorted_files = sorted(files, key=lambda x: x.get('created_at', '0'), reverse=True)
            for f in sorted_files[:10]:
                print(f" - {f['name']} ({f.get('created_at')})")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    deep_inspect_storage()

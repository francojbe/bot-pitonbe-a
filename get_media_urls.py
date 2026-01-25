import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

s = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY'))
r = s.table('message_logs').select('content, created_at').eq('role', 'user').like('content', '%RECIBIDA%').order('created_at', desc=True).limit(5).execute()

print("--- ANÁLISIS DE FUENTES DE IMÁGENES ---")
for m in r.data:
    content = m['content']
    import re
    match = re.search(r'\[IMAGEN RECIBIDA: (https?://[^\] ]+)', content)
    if match:
        url = match.group(1)
        domain = url.split("/")[2]
        print(f"[{m['created_at']}] Fuente: {domain}")
        if "supabase" not in domain:
            print(f"   URL: {url}")
    else:
        print(f"[{m['created_at']}] No se encontró URL en: {content[:50]}...")
    print("-" * 50)


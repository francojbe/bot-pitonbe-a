
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_latest_media_url():
    response = supabase.table("message_logs") \
        .select("content") \
        .ilike("content", "%RECIBID%") \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()
    
    if response.data:
        print(response.data[0]['content'])
    else:
        print("No media found")

if __name__ == "__main__":
    get_latest_media_url()

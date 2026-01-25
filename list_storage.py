
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def list_files():
    res = supabase.storage.from_("chat-media").list("inbox", {"limit": 5, "sortBy": {"column": "name", "order": "desc"}})
    for f in res:
        print(f"Name: {f['name']}, Size: {f['metadata']['size']}, Type: {f['metadata']['mimetype']}")
        url = supabase.storage.from_("chat-media").get_public_url(f"inbox/{f['name']}")
        print(f"URL: {url}")
        print("-" * 10)

if __name__ == "__main__":
    list_files()

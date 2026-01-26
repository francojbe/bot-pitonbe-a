import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

print(f"URL: {url}")
# Don't print the full key for security, just the first few chars
print(f"Key: {key[:10]}...") 

supabase = create_client(url, key)

try:
    print("Fetching orders...")
    response = supabase.table("orders").select("*").execute()
    print(f"Orders found: {len(response.data)}")
    if len(response.data) > 0:
        print("First order sample:", response.data[0])
    else:
        print("No orders in DB.")
        
    print("\nFetching leads...")
    response_leads = supabase.table("leads").select("*").execute()
    print(f"Leads found: {len(response_leads.data)}")

except Exception as e:
    print(f"Error: {e}")

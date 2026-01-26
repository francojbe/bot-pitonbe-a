from supabase import create_client

url = "https://nncjrgfeoynznmmpcuni.supabase.co"
# Anon Key from dashboard/.env
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uY2pyZ2Zlb3luem5tbXBjdW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjQ4NTksImV4cCI6MjA4NDI0MDg1OX0.PqwQJtwL_pk7k58hUm2hiDRWo_9Z45UUwknsp64u9Dw"

supabase = create_client(url, key)

print("--- Testing Dashboard Access (Anon Key) ---")
try:
    print("Fetching orders...")
    response = supabase.table("orders").select("*, leads(name, phone_number)").execute()
    print(f"✅ Success! Orders found: {len(response.data)}")
    if len(response.data) > 0:
        print("Sample:", response.data[0])
except Exception as e:
    print(f"❌ Error fetching orders: {e}")

try:
    print("\nFetching leads...")
    response_leads = supabase.table("leads").select("*").execute()
    print(f"✅ Success! Leads found: {len(response_leads.data)}")
except Exception as e:
    print(f"❌ Error fetching leads: {e}")

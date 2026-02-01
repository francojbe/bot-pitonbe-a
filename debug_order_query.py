import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase = create_client(url, key)

order_id = "f907d9d9-e7c6-49c8-b5ea-89ff08fe3cba" # One of the orders I saw

print(f"Testing find order {order_id}...")
res = supabase.table("orders").select("*, leads(name, phone_number)").eq("id", order_id).execute()

if res.data:
    order = res.data[0]
    print(f"Order found: {order['id']}")
    print(f"Leads data: {order.get('leads')}")
    lead = order.get('leads')
    if lead:
        print(f"Phone: {lead.get('phone_number')}")
        print(f"Name: {lead.get('name')}")
else:
    print("Order not found or leads join failed")

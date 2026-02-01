import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
s = create_client(os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_KEY'))
leads = s.table('leads').select('id,name,phone_number').execute().data
for l in leads:
    print(f"ID: {l['id']} | Name: {l['name']} | Phone: {l['phone_number']}")

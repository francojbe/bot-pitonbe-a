import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("❌ Error: Credenciales de Supabase no encontradas.")
    exit(1)

supabase = create_client(url, key)

print("🚀 Iniciando migración de base de datos...")

# Leer archivo SQL
try:
    with open("migration_orders.sql", "r", encoding="utf-8") as f:
        sql_commands = f.read()

    # Ejecutar SQL usando la función RPC 'exec_sql' si existe, o directo si la librería lo permite.
    # Como la librería python de supabase no tiene "exec_sql" directo sin un RPC configurado,
    # vamos a intentar usar la REST API para ejecutar o avisar al usuario.
    # NOTA: Supabase-py no ejecuta DDL arbitrario directamente por seguridad a menos que haya un RPC.
    
    print("⚠️  IMPORTANTE: Las librerías cliente de Supabase no permiten ejecutar DDL (CREATE table, ALTER column) directamente por seguridad sin una función RPC específica.")
    print("📝 Por favor, COPIA el contenido de 'migration_orders.sql' y EJECUTALO manualmenente en el Editor SQL de tu Dashboard de Supabase.")
    print("\n--- CONTENIDO DEL SQL ---")
    print(sql_commands)
    print("-------------------------\n")
    
except Exception as e:
    print(f"❌ Error leyendo archivo: {e}")

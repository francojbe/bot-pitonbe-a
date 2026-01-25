import asyncio
import os
# Mockear variables de entorno ANTES de importar server
os.environ["WHATSAPP_INSTANCE_NAME"] = "TestBot"
from dotenv import load_dotenv
load_dotenv()

# Importamos las funciones del cerebro
from server import procesar_y_responder, supabase, save_message_pro

# Mock de enviar_whatsapp para interceptar la respuesta en lugar de enviarla
response_log = []
async def mock_enviar_whatsapp(phone, texto):
    print(f"\n🤖 [BOT RESPONDE]:\n{texto}\n" + "-"*30)
    response_log.append(texto)

# Parcheamos la función en el módulo server
import server
server.enviar_whatsapp = lambda num, txt: None # Deshabilitar envío real
# Pero necesitamos capturar el texto, así que usaremos nuestra lista
# server.procesar_y_responder llama a save_message_pro y luego enviar_whatsapp
# Lo mejor es interceptar save_message_pro con role='assistant'

original_save = server.save_message_pro
def intercept_save(lead_id, phone, role, content, intent=None):
    original_save(lead_id, phone, role, content, intent)
    if role == 'assistant':
        response_log.append(content)
        print(f"\n🤖 [BOT]: {content}\n")

server.save_message_pro = intercept_save
server.enviar_whatsapp = lambda num, txt: None # Silenciar envío real

async def run_scenario(name, phone, messages):
    print(f"\n🎬 ESCENARIO: {name}\n" + "="*50)
    for msg in messages:
        print(f"👤 [{name}]: {msg}")
        await server.procesar_y_responder(phone, [msg], name)
        await asyncio.sleep(1.5) # Pausa para simular lectura

async def run_test():
    # 1. LA PRISA
    await run_scenario("URGENTE", "56911111111", [
        "Necesito flyers URGENTE para mañana",
        "Son 1000, los tienes listos a tiempo?",
        "Ya, dame los datos transfiero al tiro"
    ])

    # 2. EL REGATEADOR
    await run_scenario("REGATEADOR", "56922222222", [
        "Hola cotizame 5000 tarjetas visita",
        "Uff muy caro, mi sobrino me cobra la mitad. Me haces un descuento?",
        "Bueno, y si pago en efectivo?"
    ])

    # 3. LA ABUELITA
    await run_scenario("ABUELITA", "56933333333", [
        "Aló joven buenas tardes",
        "Mire quiero imprimir unas fotos de mis nietos que tengo en el wsp",
        "No entiendo mucho de diseños, usted me ayuda?"
    ])

    # 4. EL TÉCNICO
    await run_scenario("TÉCNICO", "56944444444", [
        "Hola",
        "Specsheet del papel couché para flyers por favor",
        "Gramaje y acabado?"
    ])

    # 5. EL CAOS (Información Cruzada)
    await run_scenario("CAOS", "56955555555", [
        "precio pendon",
        "ah no, mejor tarjetas",
        "cuanto salen 100?",
        "ya grax chau"
    ])

    print("\n✅ BATERÍA DE PRUEBAS FINALIZADA. REVISAR LOGS.")

if __name__ == "__main__":
    asyncio.run(run_test())

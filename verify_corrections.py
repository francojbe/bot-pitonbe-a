"""
Análisis de la Lógica del Prompt de Richard
Verifica que las correcciones estén implementadas correctamente
"""

print("=" * 100)
print("ANÁLISIS DE CORRECCIONES IMPLEMENTADAS EN SERVER.PY")
print("=" * 100)

# Leer el archivo server.py
with open('server.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Verificaciones
checks = []

# 1. Verificar que existe la regla de diseño contratado
if "REGLA DE DISEÑO CONTRATADO" in content:
    checks.append(("✅", "Regla de diseño contratado agregada"))
    
    # Verificar contenido específico
    if "NO pidas archivo PDF" in content and "contrató diseño" in content.lower():
        checks.append(("✅", "Instrucción de NO pedir PDF cuando hay diseño"))
    else:
        checks.append(("❌", "Falta instrucción clara de NO pedir PDF con diseño"))
    
    if "equipo de diseño trabajará" in content.lower():
        checks.append(("✅", "Mensaje de confirmación de equipo de diseño"))
    else:
        checks.append(("❌", "Falta mensaje de confirmación de equipo"))
else:
    checks.append(("❌", "NO se encontró la regla de diseño contratado"))

# 2. Verificar flujo de trabajo actualizado
if "Si NO contrató diseño: Pedir archivo PDF" in content:
    checks.append(("✅", "Flujo condicional de PDF implementado"))
else:
    checks.append(("❌", "Falta flujo condicional de PDF"))

if "Si SÍ contrató diseño: Confirmar que el equipo trabajará" in content:
    checks.append(("✅", "Flujo de confirmación de diseño implementado"))
else:
    checks.append(("❌", "Falta flujo de confirmación de diseño"))

# 3. Verificar excepción en regla de archivos
if "EXCEPCIÓN" in content and "contrató diseño, NO pidas PDF" in content:
    checks.append(("✅", "Excepción en regla de archivos agregada"))
else:
    checks.append(("❌", "Falta excepción en regla de archivos"))

# 4. Verificar que se menciona UNA SOLA VEZ
if "UNA SOLA VEZ" in content or "una sola vez" in content.lower():
    checks.append(("✅", "Énfasis en crear orden una sola vez"))
else:
    checks.append(("⚠️", "Podría reforzarse el mensaje de orden única"))

# 5. Verificar detección de intención de diseño
if "hazme" in content and "necesito que diseñes" in content:
    checks.append(("✅", "Palabras clave de detección de diseño"))
else:
    checks.append(("❌", "Faltan palabras clave de detección"))

# Mostrar resultados
print("\n📋 VERIFICACIONES DEL CÓDIGO:\n")
for status, message in checks:
    print(f"{status} {message}")

# Resumen
passed = sum(1 for s, _ in checks if s == "✅")
total = len(checks)
warnings = sum(1 for s, _ in checks if s == "⚠️")

print(f"\n{'=' * 100}")
print(f"RESUMEN: {passed}/{total} verificaciones pasadas")
if warnings > 0:
    print(f"⚠️  {warnings} advertencia(s)")
print(f"{'=' * 100}")

# Análisis de escenarios
print("\n\n" + "=" * 100)
print("ANÁLISIS DE ESCENARIOS ESPERADOS")
print("=" * 100)

scenarios = [
    {
        "name": "Cliente dice: 'Hazme unas tarjetas'",
        "expected": [
            "Richard debe detectar que necesita diseño",
            "Debe incluir costo de diseño en cotización",
            "NO debe pedir PDF después de 'APROBADO'",
            "Debe decir: 'equipo de diseño trabajará en tu proyecto'"
        ]
    },
    {
        "name": "Cliente dice: 'Quiero imprimir, ya tengo el diseño'",
        "expected": [
            "Richard NO debe incluir diseño en cotización",
            "SÍ debe pedir archivo PDF",
            "Debe esperar el PDF antes de crear orden"
        ]
    },
    {
        "name": "Cliente aprueba cotización CON diseño",
        "expected": [
            "Richard NO debe pedir PDF",
            "Debe crear orden inmediatamente",
            "Debe confirmar que equipo trabajará en diseño",
            "Debe dar datos bancarios"
        ]
    }
]

for idx, scenario in enumerate(scenarios, 1):
    print(f"\n{'─' * 100}")
    print(f"ESCENARIO {idx}: {scenario['name']}")
    print(f"{'─' * 100}")
    print("Comportamiento esperado:")
    for exp in scenario['expected']:
        print(f"  • {exp}")

print("\n\n" + "=" * 100)
print("RECOMENDACIONES PARA PRUEBAS MANUALES")
print("=" * 100)
print("""
Para validar que las correcciones funcionan correctamente:

1. 🧪 PRUEBA CON DISEÑO:
   - Envía: "Hola, necesito que me hagas unas tarjetas"
   - Proporciona datos fiscales
   - Especifica cantidad y acabado
   - Escribe "APROBADO"
   - ✅ Verifica que NO pida PDF
   - ✅ Verifica que mencione "equipo de diseño"

2. 🧪 PRUEBA SIN DISEÑO:
   - Envía: "Quiero imprimir tarjetas, ya tengo el diseño"
   - Proporciona datos fiscales
   - Escribe "APROBADO"
   - ✅ Verifica que SÍ pida PDF
   - ✅ Verifica que espere el archivo

3. 🧪 PRUEBA DE DUPLICACIÓN:
   - Completa cualquier flujo hasta "APROBADO"
   - ✅ Verifica que solo se cree UNA orden
   - ✅ Revisa en la base de datos que no haya duplicados

4. 📊 ANÁLISIS POST-PRUEBA:
   - Ejecuta: python generate_conversation_report.py
   - Revisa el reporte generado
   - Valida que el comportamiento coincida con lo esperado
""")

if passed == total:
    print("\n🎉 ¡TODAS LAS CORRECCIONES ESTÁN IMPLEMENTADAS CORRECTAMENTE!")
    print("   Procede con pruebas manuales para validar el comportamiento real.")
else:
    print(f"\n⚠️  {total - passed} corrección(es) faltante(s).")
    print("   Revisa el código antes de realizar pruebas.")

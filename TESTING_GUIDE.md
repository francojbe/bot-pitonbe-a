# Guía de Pruebas: Aprendizaje Dinámico (RAG)

He insertado una regla de prueba en tu base de datos para verificar que todo el sistema funciona. Sigue estos pasos:

## Paso 1: Verificar en Dashboard
1.  Abre tu **Dashboard** y ve a la sección **"Centro de Mejoras"** (o "Learnings").
2.  Deberías ver una nueva regla pendiente que dice:
    > *Si el usuario escribe la palabra clave "PRUEBA_RAG", responde textualmente: "¡El sistema de aprendizaje dinámico funciona correctamente!"*
3.  Haz clic en el botón **✅ Aprobar**.
    *   *Esto activará el servidor para convertir esa regla en un vector matemático y guardarla.*

## Paso 2: Probar el Chat (WhatsApp)
1.  Espera unos segundos después de aprobar.
2.  Envía un mensaje a tu bot por WhatsApp con el texto:
    > `Esta es una PRUEBA_RAG`
3.  **Resultado Esperado:**
    *   El bot debería responder algo similar a: *"¡El sistema de aprendizaje dinámico funciona correctamente!"*
    *   (Puede agregar saludos o emojis, pero la frase clave debe estar ahí).

## ¿Qué hacer si no funciona?
- **Si no ves la regla en el Dashboard:** Es posible que el despliegue aún no haya terminado. Espera 2 minutos y recarga.
- **Si al aprobar da error:** Contactame y revisaremos los logs juntos.
- **Si el bot no responde la frase exacta:** Significa que la búsqueda vectorial no encontró la regla (quizás el umbral de similitud es muy alto o el texto es muy corto). Prueba escribiendo una frase más larga que incluya la palabra clave.

# 🧠 Plan de Implementación: Sistema de Mejora Continua (Reflexion)

Este documento detalla la estrategia para dotar al agente "Richard" de capacidad de auto-mejora basada en el análisis de sus propias conversaciones.

## 🗺️ Hoja de Ruta Gradual

### 🟢 PASO 1: El "Juez Silencioso" (FASE ACTUAL)
**Objetivo:** Crear infraestructura de datos y análisis sin intervenir en la operación real.

1.  **Infraestructura de Datos:**
    *   Crear tabla `agent_learnings` en Supabase.
    *   Campos: `id`, `conversation_reference`, `error_detected`, `proposed_rule`, `status` (pending/approved/rejected), `created_at`.
2.  **Script de Auditoría (`audit_now.py`):**
    *   Script manual que analiza las últimas conversaciones (usando GPT-4o).
    *   Detecta errores de lógica, tono o procedimiento.
    *   Genera "Propuestas de Reglas" en formato texto o JSON.
    *   **NO** modifica el comportamiento del agente todavía.

### 🟡 PASO 2: Conexión Cerebral (FASE SIGUIENTE)
**Objetivo:** Permitir que el agente lea y aplique las reglas aprendidas.

1.  **Inyección de Contexto en `server.py`:**
    *   Modificar el `system_prompt` para incluir una sección dinámica: `🧠 LECCIONES APRENDIDAS`.
    *   Esta sección cargará solo las reglas con estado `approved` desde `agent_learnings`.
2.  **Dashboard de Aprobación:**
    *   Interfaz simple (o script) para que el humano revise las propuestas del Auditor y las marque como `approved` o `rejected`.

### 🔴 PASO 3: Automatización Supervisada (FUTURO)
**Objetivo:** Cerrar el ciclo de aprendizaje con mínima intervención.

1.  **Auditoría Automática (Cron Job):**
    *   Ejecutar el análisis automáticamente cada noche sobre los chats cerrados.
2.  **Auto-Aprobación (con umbral de confianza):**
    *   Si el error es crítico y claro, aprobación automática (opcional).
    *   Alertas por WhatsApp/Email al administrador sobre nuevas reglas generadas.

---

## 🛠️ Especificaciones Técnicas (Paso 1)

### Tabla `agent_learnings`
```sql
CREATE TABLE agent_learnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source_conversation_id TEXT, -- ID del lead o phone
    error_description TEXT, -- Qué hizo mal
    proposed_rule TEXT, -- La regla que evitaría esto en el futuro
    status TEXT DEFAULT 'pending', -- pending, approved, rejected, active
    confidence_score FLOAT -- 0.0 a 1.0 (qué tan seguro está el auditor)
);
```

### Script `audit_now.py`
*   **Input:** Últimos N mensajes de `message_logs`.
*   **Modelo:** GPT-4o (o modelo superior de razonamiento).
*   **Prompt del Auditor:** "Analiza esta conversación. ¿El agente siguió sus reglas? ¿Hubo alucinaciones? ¿El cliente se confundió? Si hubo error, redacta una regla correctiva concisa."

-- Tabla para el Centro de Mejoras (Agent Learnings)
-- Esta tabla almacena los errores detectados por el auditor y las reglas propuestas
CREATE TABLE IF NOT EXISTS agent_learnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- ID único
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Fecha de detección
    source_phone TEXT, -- Teléfono del cliente
    error_description TEXT, -- Descripción del error
    proposed_rule TEXT, -- Regla correctiva propuesta
    status TEXT DEFAULT 'pending', -- 'pending' (pendiente), 'approved' (aprobado), 'rejected' (rechazado)
    confidence_score FLOAT, -- Nivel de confianza de la IA (0.0 a 1.0)
    applied_at TIMESTAMP WITH TIME ZONE -- Fecha en que se aprobó/aplicó la regla
);

-- Habilitar seguridad a nivel de fila (RLS)
ALTER TABLE agent_learnings ENABLE ROW LEVEL SECURITY;

-- Políticas de Acceso (Dashboard Público/Anonimo puede leer y editar)
-- En producción con autenticación, cambiar TRUE por auth.role() = 'authenticated'

-- 1. Permitir lectura (Para ver la lista en el dashboard)
CREATE POLICY "Enable read access for all users" ON agent_learnings FOR SELECT USING (true);

-- 2. Permitir inserción (Para que el script audit_now.py pueda guardar)
CREATE POLICY "Enable insert access for all users" ON agent_learnings FOR INSERT WITH CHECK (true);

-- 3. Permitir actualización (Para aprobar/rechazar desde el dashboard)
CREATE POLICY "Enable update access for all users" ON agent_learnings FOR UPDATE USING (true);

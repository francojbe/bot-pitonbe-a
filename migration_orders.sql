
-- 1. Añadir columnas a tabla 'leads' (si no existen)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS rut TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS business_name TEXT;

-- 2. Crear tabla 'orders' si no existe
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  description TEXT,
  status TEXT DEFAULT 'NUEVO', -- NUEVO, DISEÑO, PRODUCCIÓN, LISTO, ENTREGADO
  total_amount NUMERIC,
  files_url TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Habilitar RLS (Seguridad) para 'orders'
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Política: Permitir lectura pública (para el dashboard libre) o restringida
-- Por ahora abierta para facilitar el dashboard interno
CREATE POLICY "Enable read/write for all" ON orders FOR ALL USING (true) WITH CHECK (true);

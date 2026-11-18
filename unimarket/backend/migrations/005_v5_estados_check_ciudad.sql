-- 005_v5_estados_check_ciudad.sql

-- 1. Empresa estado_verificacion
ALTER TABLE empresa DROP CONSTRAINT IF EXISTS empresa_estado_verificacion_check;
ALTER TABLE empresa ADD CONSTRAINT empresa_estado_verificacion_check
  CHECK (estado_verificacion IN ('pendiente', 'verificado', 'verificada', 'observado', 'observada', 'rechazado', 'rechazada'));

-- 2. Verificacion estado
ALTER TABLE verificacion DROP CONSTRAINT IF EXISTS verificacion_estado_check;
ALTER TABLE verificacion ADD CONSTRAINT verificacion_estado_check
  CHECK (estado IN ('pendiente', 'aprobado', 'verificado', 'verificada', 'observado', 'observada', 'rechazado', 'rechazada'));

-- 3. Suscripcion estado
ALTER TABLE suscripcion DROP CONSTRAINT IF EXISTS suscripcion_estado_check;
ALTER TABLE suscripcion ADD CONSTRAINT suscripcion_estado_check
  CHECK (estado IN ('pendiente_pago', 'en_revision', 'activa', 'vencida', 'suspendida'));

-- 4. Pago estado
ALTER TABLE pago DROP CONSTRAINT IF EXISTS pago_estado_check;
ALTER TABLE pago ADD CONSTRAINT pago_estado_check
  CHECK (estado IN ('pendiente', 'en_revision', 'confirmado', 'rechazado'));

-- 5. Ciudad en empresa
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS ciudad VARCHAR(80) DEFAULT 'La Paz';

-- 008_v8_recuperar_pass_comprobante_pedidos.sql

-- 1. Soporte para recuperación de contraseñas
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(120);
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS reset_password_expira TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_usuario_reset_token ON usuario(reset_password_token) WHERE reset_password_token IS NOT NULL;

-- 2. Soporte para token público de comprobantes de venta
ALTER TABLE venta ADD COLUMN IF NOT EXISTS token_publico VARCHAR(64) UNIQUE;
ALTER TABLE venta ADD COLUMN IF NOT EXISTS token_expira TIMESTAMP;
ALTER TABLE venta ADD COLUMN IF NOT EXISTS cliente_correo VARCHAR(120);

-- Actualizar ventas existentes con tokens aleatorios únicos
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id_venta FROM venta WHERE token_publico IS NULL LOOP
    UPDATE venta 
       SET token_publico = md5(random()::text || clock_timestamp()::text || r.id_venta::text),
           token_expira = NOW() + INTERVAL '90 days'
     WHERE id_venta = r.id_venta;
  END LOOP;
END $$;

-- 3. Soporte para tracking de pedidos nuevos en empresa
ALTER TABLE pedido_whatsapp ADD COLUMN IF NOT EXISTS visto BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pedido_whatsapp ADD COLUMN IF NOT EXISTS notas_empresa TEXT;
CREATE INDEX IF NOT EXISTS idx_pedido_empresa_visto ON pedido_whatsapp(id_empresa, visto);

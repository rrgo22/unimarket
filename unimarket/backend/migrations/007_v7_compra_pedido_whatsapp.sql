-- 007_v7_compra_pedido_whatsapp.sql

-- 1. Ampliación de campos en producto para presentación y compra
ALTER TABLE producto ADD COLUMN IF NOT EXISTS unidad_venta VARCHAR(30) NOT NULL DEFAULT 'unidad';
ALTER TABLE producto ADD COLUMN IF NOT EXISTS unidades_por_paquete INT NOT NULL DEFAULT 1;
ALTER TABLE producto ADD COLUMN IF NOT EXISTS cantidad_minima INT NOT NULL DEFAULT 1;
ALTER TABLE producto ADD COLUMN IF NOT EXISTS color_unico VARCHAR(80) NULL;

-- Restricción de unidad_venta
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'producto_unidad_venta_check') THEN
    ALTER TABLE producto DROP CONSTRAINT producto_unidad_venta_check;
  END IF;
  ALTER TABLE producto ADD CONSTRAINT producto_unidad_venta_check
    CHECK (unidad_venta IN ('unidad', 'docena', 'caja', 'par', 'paquete'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Tabla producto_color
CREATE TABLE IF NOT EXISTS producto_color (
  id          SERIAL PRIMARY KEY,
  id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  nombre      VARCHAR(80) NOT NULL,
  codigo_hex  VARCHAR(20) NULL,
  stock       INT NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_prod_color_prod ON producto_color(id_producto);

-- 3. Tabla producto_precio_escala
CREATE TABLE IF NOT EXISTS producto_precio_escala (
  id              SERIAL PRIMARY KEY,
  id_producto     INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  desde_unidades  INT NOT NULL CHECK (desde_unidades >= 1),
  precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  etiqueta        VARCHAR(80) NULL,
  CONSTRAINT uq_prod_escala UNIQUE (id_producto, desde_unidades)
);
CREATE INDEX IF NOT EXISTS idx_prod_escala_prod ON producto_precio_escala(id_producto);

-- 4. Secuencia para correlativo de pedidos por empresa
CREATE SEQUENCE IF NOT EXISTS seq_pedido_whatsapp START WITH 1;

-- 5. Tabla pedido_whatsapp
CREATE TABLE IF NOT EXISTS pedido_whatsapp (
  id             SERIAL PRIMARY KEY,
  id_empresa     INT NOT NULL REFERENCES empresa(id_empresa) ON DELETE CASCADE,
  codigo         VARCHAR(30) NOT NULL,
  nombre_cliente VARCHAR(150) NULL,
  ciudad         VARCHAR(100) NULL,
  total_estimado NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_estimado >= 0),
  estado         VARCHAR(30) NOT NULL DEFAULT 'enviado'
                 CHECK (estado IN ('enviado', 'atendido', 'convertido_en_venta', 'cancelado')),
  id_venta       INT REFERENCES venta(id_venta) ON DELETE SET NULL,
  creado_en      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pedido_empresa_codigo UNIQUE (id_empresa, codigo)
);
CREATE INDEX IF NOT EXISTS idx_pedido_empresa ON pedido_whatsapp(id_empresa);
CREATE INDEX IF NOT EXISTS idx_pedido_fecha ON pedido_whatsapp(creado_en DESC);

-- 6. Tabla pedido_whatsapp_item
CREATE TABLE IF NOT EXISTS pedido_whatsapp_item (
  id_item          SERIAL PRIMARY KEY,
  id_pedido        INT NOT NULL REFERENCES pedido_whatsapp(id) ON DELETE CASCADE,
  id_producto      INT REFERENCES producto(id_producto) ON DELETE SET NULL,
  descripcion      VARCHAR(200) NOT NULL,
  sku              VARCHAR(60) NULL,
  cantidad_total   INT NOT NULL CHECK (cantidad_total >= 1),
  desglose_colores JSONB NOT NULL DEFAULT '[]'::jsonb,
  modo             VARCHAR(30) NULL,
  precio_unitario  NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal         NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0)
);
CREATE INDEX IF NOT EXISTS idx_pedido_item_pedido ON pedido_whatsapp_item(id_pedido);

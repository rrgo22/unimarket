-- 002_v2_empresas_papelera_stock_ventas.sql

ALTER TABLE empresa ADD COLUMN IF NOT EXISTS razon_social_norm VARCHAR(150);
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMP NULL;
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS eliminado_por INT REFERENCES usuario(id_usuario) ON DELETE SET NULL;
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS motivo_eliminacion TEXT;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

-- Índices parciales únicos (donde no esté eliminado)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresa_nit_key') THEN
    ALTER TABLE empresa DROP CONSTRAINT empresa_nit_key;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_nit_unique ON empresa(nit) WHERE eliminado_en IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_whatsapp_unique ON empresa(whatsapp) WHERE eliminado_en IS NULL;

-- Columnas de inventario en producto
ALTER TABLE producto ADD COLUMN IF NOT EXISTS sku VARCHAR(60);
ALTER TABLE producto ADD COLUMN IF NOT EXISTS numero_serie VARCHAR(100);
ALTER TABLE producto ADD COLUMN IF NOT EXISTS stock_actual INT NOT NULL DEFAULT 0;
ALTER TABLE producto ADD COLUMN IF NOT EXISTS stock_minimo INT NOT NULL DEFAULT 5;
ALTER TABLE producto ADD COLUMN IF NOT EXISTS unidad VARCHAR(30) NOT NULL DEFAULT 'unidad';
ALTER TABLE producto ADD COLUMN IF NOT EXISTS alerta_stock_enviada BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS movimiento_stock (
  id_movimiento    SERIAL PRIMARY KEY,
  id_empresa       INT NOT NULL REFERENCES empresa(id_empresa) ON DELETE CASCADE,
  id_producto      INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  tipo             VARCHAR(30) NOT NULL CHECK (tipo IN ('entrada', 'salida_venta', 'ajuste', 'anulacion')),
  cantidad         INT NOT NULL,
  stock_anterior   INT NOT NULL DEFAULT 0,
  stock_resultante INT NOT NULL CHECK (stock_resultante >= 0),
  referencia       VARCHAR(100),
  nota             TEXT,
  fecha            TIMESTAMP NOT NULL DEFAULT NOW(),
  id_usuario       INT REFERENCES usuario(id_usuario) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cliente (
  id_cliente   SERIAL PRIMARY KEY,
  id_empresa   INT NOT NULL REFERENCES empresa(id_empresa) ON DELETE CASCADE,
  nombre       VARCHAR(150) NOT NULL,
  nit_ci       VARCHAR(30) NOT NULL,
  telefono     VARCHAR(30),
  correo       VARCHAR(120),
  direccion    VARCHAR(200),
  creado_en    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venta (
  id_venta          SERIAL PRIMARY KEY,
  id_empresa        INT NOT NULL REFERENCES empresa(id_empresa) ON DELETE CASCADE,
  numero            INT NOT NULL,
  numero_formato    VARCHAR(20) NOT NULL,
  anio              INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  fecha             TIMESTAMP NOT NULL DEFAULT NOW(),
  id_cliente        INT REFERENCES cliente(id_cliente) ON DELETE SET NULL,
  nombre_cliente    VARCHAR(150) NOT NULL,
  nit_ci_cliente    VARCHAR(30) NOT NULL,
  metodo_pago       VARCHAR(30) NOT NULL CHECK (metodo_pago IN ('efectivo', 'qr', 'transferencia', 'tarjeta', 'otro')),
  subtotal          NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  descuento         NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (descuento >= 0),
  total             NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  total_literal     VARCHAR(250),
  observaciones     TEXT,
  estado            VARCHAR(20) NOT NULL DEFAULT 'emitida' CHECK (estado IN ('emitida', 'anulada')),
  anulada_en        TIMESTAMP,
  motivo_anulacion  TEXT,
  creado_por        INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
  creado_en         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venta_item (
  id_venta_item    SERIAL PRIMARY KEY,
  id_venta         INT NOT NULL REFERENCES venta(id_venta) ON DELETE CASCADE,
  id_producto      INT REFERENCES producto(id_producto) ON DELETE RESTRICT,
  descripcion      VARCHAR(200) NOT NULL,
  sku              VARCHAR(60),
  cantidad         INT NOT NULL CHECK (cantidad > 0),
  precio_unitario  NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  descuento_item   NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (descuento_item >= 0),
  subtotal         NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS auditoria (
  id_auditoria  SERIAL PRIMARY KEY,
  id_usuario    INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
  accion        VARCHAR(100) NOT NULL,
  entidad       VARCHAR(60) NOT NULL,
  id_entidad    INT,
  detalle       TEXT,
  fecha         TIMESTAMP NOT NULL DEFAULT NOW()
);

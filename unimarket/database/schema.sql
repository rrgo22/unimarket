-- UNIMARKET BO - Esquema PostgreSQL (3FN, aislamiento por id_empresa)

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario      SERIAL PRIMARY KEY,
  nombre          VARCHAR(120) NOT NULL,
  usuario         VARCHAR(50)  NOT NULL UNIQUE,
  correo          VARCHAR(120) NOT NULL UNIQUE,
  contrasena_hash VARCHAR(100) NOT NULL,
  rol             VARCHAR(20)  NOT NULL CHECK (rol IN ('administrador','empresa')),
  creado_en       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS empresa (
  id_empresa          SERIAL PRIMARY KEY,
  id_usuario          INT NOT NULL UNIQUE REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
  razon_social        VARCHAR(150) NOT NULL,
  slug                VARCHAR(80)  NOT NULL UNIQUE,
  nit                 VARCHAR(15)  NOT NULL UNIQUE,
  telefono            VARCHAR(20),
  whatsapp            VARCHAR(20),
  sitio_web           VARCHAR(200),
  descripcion         TEXT,
  logo                VARCHAR(200),
  portada             VARCHAR(200),
  direccion           VARCHAR(200),
  facebook            VARCHAR(200),
  instagram           VARCHAR(200),
  tiktok              VARCHAR(200),
  estado_verificacion VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                      CHECK (estado_verificacion IN ('pendiente','verificado','observado')),
  creado_en           TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Migraciones seguras para bases de datos existentes
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS slug VARCHAR(80);
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS logo VARCHAR(200);
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS portada VARCHAR(200);
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS direccion VARCHAR(200);
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS facebook VARCHAR(200);
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS instagram VARCHAR(200);
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS tiktok VARCHAR(200);
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_slug ON empresa(slug);

CREATE TABLE IF NOT EXISTS verificacion (
  id_verificacion SERIAL PRIMARY KEY,
  id_empresa      INT NOT NULL REFERENCES empresa(id_empresa) ON DELETE CASCADE,
  estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','aprobado','rechazado')),
  documento       VARCHAR(200),
  observacion     TEXT,
  fecha_solicitud TIMESTAMP NOT NULL DEFAULT NOW(),
  fecha_revision  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suscripcion (
  id_suscripcion    SERIAL PRIMARY KEY,
  id_empresa        INT NOT NULL UNIQUE REFERENCES empresa(id_empresa) ON DELETE CASCADE,
  estado            VARCHAR(20) NOT NULL DEFAULT 'pendiente_pago'
                    CHECK (estado IN ('pendiente_pago','en_revision','activa','vencida','suspendida')),
  fecha_inicio      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE NOT NULL DEFAULT (CURRENT_DATE + 30)
);

-- Migración segura para bases de datos existentes en suscripcion
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suscripcion_estado_check') THEN
    ALTER TABLE suscripcion DROP CONSTRAINT suscripcion_estado_check;
  END IF;
  ALTER TABLE suscripcion ADD CONSTRAINT suscripcion_estado_check
    CHECK (estado IN ('pendiente_pago','en_revision','activa','vencida','suspendida'));
  ALTER TABLE suscripcion ALTER COLUMN estado SET DEFAULT 'pendiente_pago';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS plan (
  id_plan     SERIAL PRIMARY KEY,
  nombre      VARCHAR(80) NOT NULL,
  precio      NUMERIC(12,2) NOT NULL DEFAULT 200.00 CHECK (precio >= 0),
  moneda      VARCHAR(10) NOT NULL DEFAULT 'Bs',
  periodo     VARCHAR(20) NOT NULL DEFAULT 'mes',
  descripcion TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  beneficios  JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS pago (
  id_pago            SERIAL PRIMARY KEY,
  id_empresa         INT NOT NULL REFERENCES empresa(id_empresa) ON DELETE CASCADE,
  monto              NUMERIC(12,2) NOT NULL DEFAULT 200.00 CHECK (monto >= 0),
  metodo             VARCHAR(20) NOT NULL CHECK (metodo IN ('qr','transferencia','efectivo')),
  referencia         VARCHAR(100),
  banco              VARCHAR(80),
  comprobante        VARCHAR(200),
  estado             VARCHAR(20) NOT NULL DEFAULT 'en_revision'
                     CHECK (estado IN ('pendiente','en_revision','confirmado','rechazado')),
  observacion        TEXT,
  meses              INT NOT NULL DEFAULT 1 CHECK (meses >= 1),
  fecha              TIMESTAMP NOT NULL DEFAULT NOW(),
  fecha_pago         TIMESTAMP DEFAULT NOW(),
  es_demo            BOOLEAN NOT NULL DEFAULT FALSE,
  confirmado_por     INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
  fecha_confirmacion TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notificacion_correo (
  id_notificacion SERIAL PRIMARY KEY,
  id_empresa      INT REFERENCES empresa(id_empresa) ON DELETE CASCADE,
  tipo            VARCHAR(50) NOT NULL,
  destino         VARCHAR(120) NOT NULL,
  asunto          VARCHAR(250),
  estado          VARCHAR(20) NOT NULL CHECK (estado IN ('enviado','fallido')),
  error           TEXT,
  intentos        INT NOT NULL DEFAULT 1,
  fecha           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categoria (
  id_categoria SERIAL PRIMARY KEY,
  nombre       VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS solicitud_categoria (
  id_solicitud SERIAL PRIMARY KEY,
  id_empresa   INT NOT NULL REFERENCES empresa(id_empresa) ON DELETE CASCADE,
  nombre       VARCHAR(80) NOT NULL,
  creado_en    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS producto (
  id_producto  SERIAL PRIMARY KEY,
  id_empresa   INT NOT NULL REFERENCES empresa(id_empresa) ON DELETE RESTRICT,
  id_categoria INT NOT NULL REFERENCES categoria(id_categoria) ON DELETE RESTRICT,
  nombre       VARCHAR(150) NOT NULL,
  marca        VARCHAR(80),
  modelo       VARCHAR(80),
  descripcion  TEXT,
  precio       NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
  disponible   BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Migración segura para columnas marca y modelo
DO $$
BEGIN
  ALTER TABLE producto ADD COLUMN IF NOT EXISTS marca VARCHAR(80);
  ALTER TABLE producto ADD COLUMN IF NOT EXISTS modelo VARCHAR(80);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Extensiones para búsqueda tolerante e insensible a tildes (si los permisos lo permiten)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS unaccent;
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS imagen_producto (
  id_imagen   SERIAL PRIMARY KEY,
  id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  ruta        VARCHAR(200) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_producto_empresa   ON producto(id_empresa);
CREATE INDEX IF NOT EXISTS idx_producto_categoria ON producto(id_categoria);
CREATE INDEX IF NOT EXISTS idx_producto_precio    ON producto(precio);
CREATE INDEX IF NOT EXISTS idx_producto_nombre    ON producto(LOWER(nombre));
CREATE INDEX IF NOT EXISTS idx_producto_marca     ON producto(LOWER(marca));
CREATE INDEX IF NOT EXISTS idx_producto_modelo    ON producto(LOWER(modelo));
CREATE INDEX IF NOT EXISTS idx_verificacion_emp   ON verificacion(id_empresa);
CREATE INDEX IF NOT EXISTS idx_pago_empresa       ON pago(id_empresa);
CREATE INDEX IF NOT EXISTS idx_pago_estado        ON pago(estado);
CREATE INDEX IF NOT EXISTS idx_notif_empresa      ON notificacion_correo(id_empresa);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE INDEX IF NOT EXISTS idx_producto_nombre_trgm ON producto USING gin (nombre gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_producto_marca_trgm  ON producto USING gin (marca gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_producto_modelo_trgm ON producto USING gin (modelo gin_trgm_ops);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- MIGRACIONES V2 (Auditoría, Papelera, Stock, Facturación)
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE empresa ADD COLUMN IF NOT EXISTS razon_social_norm VARCHAR(150);
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMP NULL;
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS eliminado_por INT REFERENCES usuario(id_usuario) ON DELETE SET NULL;
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS motivo_eliminacion TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresa_nit_key') THEN
    ALTER TABLE empresa DROP CONSTRAINT empresa_nit_key;
  END IF;
END $$;

ALTER TABLE empresa ADD COLUMN IF NOT EXISTS correo VARCHAR(120);
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_nit_unique ON empresa(nit) WHERE eliminado_en IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_razon_social_norm_unique ON empresa(razon_social_norm) WHERE eliminado_en IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_whatsapp_unique ON empresa(whatsapp) WHERE eliminado_en IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_telefono_unique ON empresa(telefono) WHERE eliminado_en IS NULL AND telefono IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_correo_unique ON empresa(correo) WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_empresa_eliminado_en ON empresa(eliminado_en);

CREATE TABLE IF NOT EXISTS auditoria (
  id_auditoria SERIAL PRIMARY KEY,
  id_usuario   INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
  accion       VARCHAR(80) NOT NULL,
  entidad      VARCHAR(50) NOT NULL,
  id_entidad   INT,
  detalle      TEXT,
  fecha        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria(entidad, id_entidad);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha DESC);

ALTER TABLE solicitud_categoria ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'pendiente';
ALTER TABLE solicitud_categoria ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;
ALTER TABLE solicitud_categoria ADD COLUMN IF NOT EXISTS revisado_por INT REFERENCES usuario(id_usuario) ON DELETE SET NULL;
ALTER TABLE solicitud_categoria ADD COLUMN IF NOT EXISTS fecha_revision TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'solicitud_categoria_estado_check') THEN
    ALTER TABLE solicitud_categoria DROP CONSTRAINT solicitud_categoria_estado_check;
  END IF;
  ALTER TABLE solicitud_categoria ADD CONSTRAINT solicitud_categoria_estado_check
    CHECK (estado IN ('pendiente','aprobada','rechazada'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE producto ADD COLUMN IF NOT EXISTS sku VARCHAR(60);
ALTER TABLE producto ADD COLUMN IF NOT EXISTS numero_serie VARCHAR(100);
ALTER TABLE producto ADD COLUMN IF NOT EXISTS stock_actual INT NOT NULL DEFAULT 0;
ALTER TABLE producto ADD COLUMN IF NOT EXISTS stock_minimo INT NOT NULL DEFAULT 20;
ALTER TABLE producto ADD COLUMN IF NOT EXISTS unidad VARCHAR(30) NOT NULL DEFAULT 'unidad';
ALTER TABLE producto ADD COLUMN IF NOT EXISTS alerta_stock_enviada BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'producto_stock_actual_check') THEN
    ALTER TABLE producto DROP CONSTRAINT producto_stock_actual_check;
  END IF;
  ALTER TABLE producto ADD CONSTRAINT producto_stock_actual_check CHECK (stock_actual >= 0);

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'producto_stock_minimo_check') THEN
    ALTER TABLE producto DROP CONSTRAINT producto_stock_minimo_check;
  END IF;
  ALTER TABLE producto ADD CONSTRAINT producto_stock_minimo_check CHECK (stock_minimo >= 0);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_producto_sku_empresa
  ON producto(id_empresa, LOWER(sku))
  WHERE sku IS NOT NULL;

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
CREATE INDEX IF NOT EXISTS idx_mov_stock_empresa ON movimiento_stock(id_empresa);
CREATE INDEX IF NOT EXISTS idx_mov_stock_producto ON movimiento_stock(id_producto);
CREATE INDEX IF NOT EXISTS idx_mov_stock_fecha ON movimiento_stock(fecha DESC);

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
CREATE INDEX IF NOT EXISTS idx_cliente_empresa ON cliente(id_empresa);
CREATE INDEX IF NOT EXISTS idx_cliente_nit_ci ON cliente(id_empresa, nit_ci);

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
CREATE UNIQUE INDEX IF NOT EXISTS idx_venta_empresa_numero_anio ON venta (id_empresa, anio, numero);
CREATE INDEX IF NOT EXISTS idx_venta_empresa_fecha ON venta(id_empresa, fecha DESC);

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
CREATE INDEX IF NOT EXISTS idx_venta_item_venta ON venta_item(id_venta);

-- ============================================================
-- PARTE 6: Carrito y Pedido por WhatsApp
-- ============================================================

-- Columnas extendidas de producto para compra
ALTER TABLE producto ADD COLUMN IF NOT EXISTS cantidad_minima     INT         NOT NULL DEFAULT 1 CHECK (cantidad_minima >= 1);
ALTER TABLE producto ADD COLUMN IF NOT EXISTS unidad_venta        VARCHAR(40) NOT NULL DEFAULT 'unidad';
ALTER TABLE producto ADD COLUMN IF NOT EXISTS unidades_por_paquete INT;
ALTER TABLE producto ADD COLUMN IF NOT EXISTS color_unico         VARCHAR(60);
ALTER TABLE producto ADD COLUMN IF NOT EXISTS colores_disponibles JSONB       NOT NULL DEFAULT '[]'::jsonb;

-- Tabla de colores disponibles por producto
CREATE TABLE IF NOT EXISTS producto_color (
  id          SERIAL PRIMARY KEY,
  id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  id_empresa  INT NOT NULL REFERENCES empresa(id_empresa) ON DELETE CASCADE,
  nombre      VARCHAR(60) NOT NULL,
  codigo_hex  VARCHAR(10),
  stock       INT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_producto_color_prod ON producto_color(id_producto);


-- Tabla de precios por volumen (escala)
CREATE TABLE IF NOT EXISTS producto_precio_escala (
  id_escala       SERIAL PRIMARY KEY,
  id_producto     INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  id_empresa      INT NOT NULL REFERENCES empresa(id_empresa)  ON DELETE CASCADE,
  desde_unidades  INT NOT NULL CHECK (desde_unidades >= 1),
  precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  etiqueta        VARCHAR(80),
  UNIQUE (id_producto, desde_unidades)
);
CREATE INDEX IF NOT EXISTS idx_precio_escala_producto ON producto_precio_escala(id_producto);

-- Secuencia de correlativo de pedidos
CREATE SEQUENCE IF NOT EXISTS seq_pedido_whatsapp START 1;

-- Tabla de pedidos por WhatsApp (registro trazable)
CREATE TABLE IF NOT EXISTS pedido_whatsapp (
  id             SERIAL PRIMARY KEY,
  id_empresa     INT NOT NULL REFERENCES empresa(id_empresa) ON DELETE CASCADE,
  codigo         VARCHAR(20) NOT NULL UNIQUE,
  nombre_cliente VARCHAR(150),
  ciudad         VARCHAR(100),
  total_estimado NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_estimado >= 0),
  estado         VARCHAR(20) NOT NULL DEFAULT 'enviado'
                 CHECK (estado IN ('enviado','visto','confirmado','cancelado')),
  creado_en      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pedido_wa_empresa ON pedido_whatsapp(id_empresa);
CREATE INDEX IF NOT EXISTS idx_pedido_wa_creado  ON pedido_whatsapp(creado_en DESC);

-- Ítems del pedido WhatsApp
CREATE TABLE IF NOT EXISTS pedido_whatsapp_item (
  id_item          SERIAL PRIMARY KEY,
  id_pedido        INT NOT NULL REFERENCES pedido_whatsapp(id) ON DELETE CASCADE,
  id_producto      INT REFERENCES producto(id_producto) ON DELETE SET NULL,
  descripcion      VARCHAR(200) NOT NULL,
  sku              VARCHAR(60),
  cantidad_total   INT NOT NULL CHECK (cantidad_total >= 1),
  desglose_colores JSONB NOT NULL DEFAULT '[]'::jsonb,
  modo             VARCHAR(30) NOT NULL DEFAULT 'unidad',
  precio_unitario  NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal         NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0)
);
CREATE INDEX IF NOT EXISTS idx_pedido_wa_item_pedido ON pedido_whatsapp_item(id_pedido);

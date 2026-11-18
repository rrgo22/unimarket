-- 001_inicial.sql
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
  slug                VARCHAR(80)  UNIQUE,
  nit                 VARCHAR(15),
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
  estado_verificacion VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  creado_en           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verificacion (
  id_verificacion SERIAL PRIMARY KEY,
  id_empresa      INT NOT NULL REFERENCES empresa(id_empresa) ON DELETE CASCADE,
  estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  documento       VARCHAR(200),
  observacion     TEXT,
  fecha_solicitud TIMESTAMP NOT NULL DEFAULT NOW(),
  fecha_revision  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suscripcion (
  id_suscripcion    SERIAL PRIMARY KEY,
  id_empresa        INT NOT NULL UNIQUE REFERENCES empresa(id_empresa) ON DELETE CASCADE,
  estado            VARCHAR(20) NOT NULL DEFAULT 'pendiente_pago',
  fecha_inicio      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE NOT NULL DEFAULT (CURRENT_DATE + 30)
);

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
  metodo             VARCHAR(20) NOT NULL,
  referencia         VARCHAR(100),
  banco              VARCHAR(80),
  comprobante        VARCHAR(200),
  estado             VARCHAR(20) NOT NULL DEFAULT 'en_revision',
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
  estado          VARCHAR(20) NOT NULL,
  error           TEXT,
  intentos        INT NOT NULL DEFAULT 1,
  fecha           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categoria (
  id_categoria SERIAL PRIMARY KEY,
  nombre       VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS producto (
  id_producto  SERIAL PRIMARY KEY,
  id_empresa   INT NOT NULL REFERENCES empresa(id_empresa) ON DELETE CASCADE,
  id_categoria INT NOT NULL REFERENCES categoria(id_categoria) ON DELETE RESTRICT,
  nombre       VARCHAR(150) NOT NULL,
  descripcion  TEXT,
  precio       NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
  disponible   BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en    TIMESTAMP NOT NULL DEFAULT NOW(),
  marca        VARCHAR(80),
  modelo       VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS imagen_producto (
  id_imagen   SERIAL PRIMARY KEY,
  id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  ruta        VARCHAR(200) NOT NULL,
  orden       INT NOT NULL DEFAULT 0
);

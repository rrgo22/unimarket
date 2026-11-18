-- 009_v9_reportes_marcas_prohibidas.sql
-- Sistema de Marcas Prohibidas y Reportes de Usuarios (Círculo de Confianza)

CREATE TABLE IF NOT EXISTS marca_prohibida (
  id_marca_prohibida SERIAL PRIMARY KEY,
  nombre             VARCHAR(80) NOT NULL UNIQUE,
  motivo             TEXT,
  creado_en          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marca_prohibida_nombre ON marca_prohibida(LOWER(nombre));

CREATE TABLE IF NOT EXISTS reporte (
  id_reporte           SERIAL PRIMARY KEY,
  id_empresa           INT NOT NULL REFERENCES empresa(id_empresa) ON DELETE CASCADE,
  id_producto          INT REFERENCES producto(id_producto) ON DELETE SET NULL,
  motivos              JSONB NOT NULL DEFAULT '[]'::jsonb,
  descripcion          TEXT NOT NULL,
  nombre_denunciante   VARCHAR(120),
  contacto_denunciante VARCHAR(120),
  estado               VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_revision', 'sancionado', 'desestimado', 'resuelto')),
  notas_admin          TEXT,
  creado_en            TIMESTAMP NOT NULL DEFAULT NOW(),
  resuelto_en          TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reporte_empresa ON reporte(id_empresa);
CREATE INDEX IF NOT EXISTS idx_reporte_estado ON reporte(estado);

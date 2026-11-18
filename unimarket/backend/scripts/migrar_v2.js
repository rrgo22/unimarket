/**
 * Migración v2 - UNIMARKET BO
 * Aplica cambios de esquema para:
 * - Unicidad y normalización de razón social (Parte 1)
 * - Papelera y auditoría (Parte 2)
 * - Solicitudes de categoría con estado y motivo (Parte 3)
 * - Control de stock, inventario y movimientos (Parte 4)
 * - Facturación, clientes y ventas con correlativo (Parte 5)
 */

require('dotenv').config();
const { Pool } = require('pg');
const { normalizarRazonSocialParaBusqueda } = require('../src/utils/normalizar');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/unimarket',
});

async function migrar() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('[INFO] Iniciando migración v2...');

    // 1. Columnas en empresa para papelera y normalización
    await client.query(`
      ALTER TABLE empresa ADD COLUMN IF NOT EXISTS razon_social_norm VARCHAR(150);
      ALTER TABLE empresa ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMP NULL;
      ALTER TABLE empresa ADD COLUMN IF NOT EXISTS eliminado_por INT REFERENCES usuario(id_usuario) ON DELETE SET NULL;
      ALTER TABLE empresa ADD COLUMN IF NOT EXISTS motivo_eliminacion TEXT;
    `);

    // 2. Columna activo en usuario
    await client.query(`
      ALTER TABLE usuario ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
    `);

    // 3. Poblar razon_social_norm en empresas existentes
    const { rows: emps } = await client.query('SELECT id_empresa, razon_social FROM empresa');
    for (const emp of emps) {
      const norm = normalizarRazonSocialParaBusqueda(emp.razon_social);
      await client.query('UPDATE empresa SET razon_social_norm = $1 WHERE id_empresa = $2', [norm, emp.id_empresa]);
    }
    await client.query('ALTER TABLE empresa ALTER COLUMN razon_social_norm SET NOT NULL');

    // 4. Índices únicos parciales en empresa (WHERE eliminado_en IS NULL)
    // Primero eliminar constraints únicas antiguas de nit si existen para reemplazarlas por parciales
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empresa_nit_key') THEN
          ALTER TABLE empresa DROP CONSTRAINT empresa_nit_key;
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_nit_unique ON empresa(nit) WHERE eliminado_en IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_razon_social_norm_unique ON empresa(razon_social_norm) WHERE eliminado_en IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_whatsapp_unique ON empresa(whatsapp) WHERE eliminado_en IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_telefono_unique ON empresa(telefono) WHERE eliminado_en IS NULL AND telefono IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_empresa_eliminado_en ON empresa(eliminado_en);
    `);

    // 5. Tabla de auditoría
    await client.query(`
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
    `);

    // 6. Columnas en solicitud_categoria
    await client.query(`
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
    `);

    // 7. Columnas en producto para inventario y stock
    await client.query(`
      ALTER TABLE producto ADD COLUMN IF NOT EXISTS sku VARCHAR(60);
      ALTER TABLE producto ADD COLUMN IF NOT EXISTS numero_serie VARCHAR(100);
      ALTER TABLE producto ADD COLUMN IF NOT EXISTS stock_actual INT NOT NULL DEFAULT 50;
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
    `);

    // Asegurar SKUs únicos para los 5 productos existentes de Tecno Andina si no tienen
    const { rows: prods } = await client.query('SELECT id_producto, nombre, sku FROM producto WHERE sku IS NULL ORDER BY id_producto');
    for (let i = 0; i < prods.length; i++) {
      const p = prods[i];
      const skuDefault = `TEC-${String(p.id_producto).padStart(4, '0')}`;
      await client.query('UPDATE producto SET sku = $1, stock_actual = 45, stock_minimo = 15 WHERE id_producto = $2', [skuDefault, p.id_producto]);
    }

    // 8. Tabla movimiento_stock
    await client.query(`
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
    `);

    // 9. Tabla cliente
    await client.query(`
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
    `);

    // 10. Tabla venta y venta_item
    await client.query(`
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
    `);

    await client.query('COMMIT');
    console.log('[OK] Migración v2 aplicada exitosamente en la base de datos.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[ERROR] Error aplicando migración v2:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrar().catch(() => process.exit(1));

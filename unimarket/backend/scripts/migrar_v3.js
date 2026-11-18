require('dotenv').config();
const pool = require('../src/db');

async function migrarV3() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Iniciando migración v3 (códigos de pago, pagos, notificaciones)...');

    // 1. Secuencia y columna codigo_pago en empresa
    await client.query(`CREATE SEQUENCE IF NOT EXISTS seq_codigo_pago START WITH 1`);
    await client.query(`ALTER TABLE empresa ADD COLUMN IF NOT EXISTS codigo_pago VARCHAR(20) UNIQUE`);

    // Asignar código de pago a empresas existentes que no lo tengan
    const sinCodigo = await client.query(`SELECT id_empresa FROM empresa WHERE codigo_pago IS NULL ORDER BY id_empresa ASC`);
    for (const row of sinCodigo.rows) {
      const { rows: seqRow } = await client.query(`SELECT nextval('seq_codigo_pago') AS num`);
      const cod = 'UM-' + String(seqRow[0].num).padStart(4, '0');
      await client.query(`UPDATE empresa SET codigo_pago = $1 WHERE id_empresa = $2`, [cod, row.id_empresa]);
      console.log(`Asignado código ${cod} a empresa ID ${row.id_empresa}`);
    }

    // 2. Columna correo en empresa e índice único
    await client.query(`ALTER TABLE empresa ADD COLUMN IF NOT EXISTS correo VARCHAR(120)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_correo_unique ON empresa(correo) WHERE eliminado_en IS NULL`);

    // Sincronizar correo de empresa desde usuario si estuviera nulo
    await client.query(`
      UPDATE empresa e
         SET correo = u.correo
        FROM usuario u
       WHERE u.id_usuario = e.id_usuario
         AND (e.correo IS NULL OR e.correo = '')
    `);

    // 3. Tabla pago - columnas adicionales y validaciones
    await client.query(`ALTER TABLE pago ADD COLUMN IF NOT EXISTS banco VARCHAR(80)`);
    await client.query(`ALTER TABLE pago ADD COLUMN IF NOT EXISTS fecha_pago TIMESTAMP DEFAULT NOW()`);
    await client.query(`ALTER TABLE pago ADD COLUMN IF NOT EXISTS es_demo BOOLEAN NOT NULL DEFAULT FALSE`);
    
    // Quitar restricción vieja de estado en pago y permitir 'en_revision'
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pago_estado_check') THEN
          ALTER TABLE pago DROP CONSTRAINT pago_estado_check;
        END IF;
        ALTER TABLE pago ADD CONSTRAINT pago_estado_check
          CHECK (estado IN ('pendiente', 'en_revision', 'confirmado', 'rechazado'));
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    // Índice único para evitar comprobante duplicado por empresa + banco + referencia
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pago_unico_ref
        ON pago (id_empresa, LOWER(banco), LOWER(referencia))
        WHERE referencia IS NOT NULL AND referencia != '' AND estado != 'rechazado'
    `);

    // 4. Tabla notificacion_correo
    await client.query(`ALTER TABLE notificacion_correo ALTER COLUMN id_empresa DROP NOT NULL`);
    await client.query(`ALTER TABLE notificacion_correo ADD COLUMN IF NOT EXISTS asunto VARCHAR(250)`);
    await client.query(`ALTER TABLE notificacion_correo ADD COLUMN IF NOT EXISTS intentos INT NOT NULL DEFAULT 1`);

    // Relajar restricción de tipo para permitir todas las plantillas del sistema
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notificacion_correo_tipo_check') THEN
          ALTER TABLE notificacion_correo DROP CONSTRAINT notificacion_correo_tipo_check;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    // 5. Restricción de estado en verificación
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verificacion_estado_check') THEN
          ALTER TABLE verificacion DROP CONSTRAINT verificacion_estado_check;
        END IF;
        ALTER TABLE verificacion ADD CONSTRAINT verificacion_estado_check
          CHECK (estado IN ('pendiente', 'aprobado', 'verificado', 'observado', 'rechazado'));
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    // 6. Restricción de estado en suscripción
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suscripcion_estado_check') THEN
          ALTER TABLE suscripcion DROP CONSTRAINT suscripcion_estado_check;
        END IF;
        ALTER TABLE suscripcion ADD CONSTRAINT suscripcion_estado_check
          CHECK (estado IN ('pendiente_pago', 'en_revision', 'activa', 'vencida', 'suspendida'));
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    await client.query('COMMIT');
    console.log('Migración v3 completada exitosamente.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error en migración v3:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrarV3();

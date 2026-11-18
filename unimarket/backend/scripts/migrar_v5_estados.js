const pool = require('../src/db');

async function migrar() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Empresa estado_verificacion
    await client.query(`ALTER TABLE empresa DROP CONSTRAINT IF EXISTS empresa_estado_verificacion_check`);
    await client.query(`
      ALTER TABLE empresa ADD CONSTRAINT empresa_estado_verificacion_check
      CHECK (estado_verificacion IN ('pendiente', 'verificado', 'verificada', 'observado', 'observada', 'rechazado', 'rechazada'))
    `);

    // 2. Verificacion estado
    await client.query(`ALTER TABLE verificacion DROP CONSTRAINT IF EXISTS verificacion_estado_check`);
    await client.query(`
      ALTER TABLE verificacion ADD CONSTRAINT verificacion_estado_check
      CHECK (estado IN ('pendiente', 'aprobado', 'verificado', 'verificada', 'observado', 'observada', 'rechazado', 'rechazada'))
    `);

    // 3. Suscripcion estado
    await client.query(`ALTER TABLE suscripcion DROP CONSTRAINT IF EXISTS suscripcion_estado_check`);
    await client.query(`
      ALTER TABLE suscripcion ADD CONSTRAINT suscripcion_estado_check
      CHECK (estado IN ('pendiente_pago', 'en_revision', 'activa', 'vencida', 'suspendida'))
    `);

    // 4. Pago estado
    await client.query(`ALTER TABLE pago DROP CONSTRAINT IF EXISTS pago_estado_check`);
    await client.query(`
      ALTER TABLE pago ADD CONSTRAINT pago_estado_check
      CHECK (estado IN ('pendiente', 'en_revision', 'confirmado', 'rechazado'))
    `);

    // 5. Add ciudad column to empresa if not exists
    await client.query(`ALTER TABLE empresa ADD COLUMN IF NOT EXISTS ciudad VARCHAR(80) DEFAULT 'La Paz'`);

    await client.query('COMMIT');
    console.log('Migración v5 aplicada con éxito.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error migración v5:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrar();

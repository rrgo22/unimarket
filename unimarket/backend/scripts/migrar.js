/**
 * Ejecutor Centralizado e Idempotente de Migraciones - UNIMARKET BO
 * Uso: npm run migrar
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

async function migrar() {
  const client = await pool.connect();
  try {
    console.log('==================================================');
    console.log(' INICIANDO EJECUTOR DE MIGRACIONES (UNIMARKET BO)');
    console.log('==================================================\n');

    // 1. Crear tabla schema_migrations si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(80) UNIQUE NOT NULL,
        nombre VARCHAR(150) NOT NULL,
        aplicado_en TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // 2. Obtener migraciones ya aplicadas
    const { rows: aplicadas } = await client.query('SELECT version FROM schema_migrations');
    const aplicadasSet = new Set(aplicadas.map((r) => r.version));

    // 3. Leer archivos de backend/migrations/
    const dirMigraciones = path.join(__dirname, '..', 'migrations');
    if (!fs.existsSync(dirMigraciones)) {
      console.log('No se encontró el directorio de migraciones:', dirMigraciones);
      return;
    }

    const archivos = fs
      .readdirSync(dirMigraciones)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`Encontrados ${archivos.length} archivos de migración.`);

    let nuevasAplicadas = 0;

    for (const archivo of archivos) {
      const version = path.basename(archivo, '.sql');
      if (aplicadasSet.has(version)) {
        console.log(`[YA APLICADA] ${archivo}`);
        continue;
      }

      console.log(`[APLICANDO] ${archivo}...`);
      const contenidoSql = fs.readFileSync(path.join(dirMigraciones, archivo), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(contenidoSql);
        await client.query(
          'INSERT INTO schema_migrations (version, nombre) VALUES ($1, $2)',
          [version, archivo]
        );
        await client.query('COMMIT');
        console.log(`✓ [ÉXITO] ${archivo} aplicada.`);
        nuevasAplicadas++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`✗ [ERROR] Falló migración ${archivo}:`, err.message);
        throw err;
      }
    }

    console.log(`\n==================================================`);
    console.log(`RESUMEN: ${nuevasAplicadas} migraciones nuevas aplicadas.`);
    console.log('Todas las migraciones se encuentran al día y consistentes.');
    console.log(`==================================================\n`);
  } catch (e) {
    console.error('Error fatal durante la migración:', e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrar();

const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

async function ejecutar() {
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, '..', 'migrations', '008_v8_recuperar_pass_comprobante_pedidos.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Aplicando migración 008...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migración 008 aplicada con éxito!');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error al aplicar migración 008:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

ejecutar();

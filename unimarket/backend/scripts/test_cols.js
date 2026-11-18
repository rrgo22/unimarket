require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Columnas reales de cliente
  const { rows: c } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='cliente' ORDER BY ordinal_position`
  );
  console.log('cliente cols:', c.map(x => x.column_name).join(', '));

  // Probar la query del PDF corregida (nit -> nit_ci)
  try {
    const { rows } = await pool.query(
      `SELECT v.*, c.nombre AS cliente_nombre, c.nit_ci AS cliente_nit,
              c.telefono AS cliente_telefono, c.direccion AS cliente_direccion
         FROM venta v
         LEFT JOIN cliente c ON c.id_cliente = v.id_cliente
        WHERE v.id_empresa = 1 LIMIT 1`
    );
    console.log('PDF query FIXED OK. correlativo:', rows[0]?.correlativo, 'numero_formato:', rows[0]?.numero_formato);
  } catch(e) {
    console.error('PDF FIXED query ERROR:', e.message);
  }

  // Probar query de reportes
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(DISTINCT v.id_venta) AS total_ventas,
              COALESCE(SUM(vi.subtotal), 0) AS ingresos_totales,
              COALESCE(SUM(vi.cantidad), 0) AS total_unidades_vendidas
         FROM venta v
         JOIN venta_item vi ON vi.id_venta = v.id_venta
        WHERE v.id_empresa = 1 AND v.estado = 'emitida'`
    );
    console.log('Reportes query OK:', rows[0]);
  } catch(e) {
    console.error('Reportes query ERROR:', e.message);
  }
  
  await pool.end();
}
main().catch(e => { console.error('FATAL:', e.message); pool.end(); });

require('dotenv').config();
const pool = require('../src/db');

async function diagnosticar() {
  console.log('=== DIAGNÓSTICO DE VISIBILIDAD DE EMPRESAS Y ESTADÍSTICAS ===\n');

  // 1. Verificar registro directo de empresa y suscripción en BD
  const emp = await pool.query(`
    SELECT e.id_empresa, e.razon_social, e.slug, e.nit, e.estado_verificacion, e.eliminado_en,
           s.id_suscripcion, s.estado AS suscripcion_estado, s.fecha_vencimiento,
           CURRENT_DATE AS fecha_actual,
           (s.fecha_vencimiento >= CURRENT_DATE) AS vigente
      FROM empresa e
      LEFT JOIN suscripcion s ON s.id_empresa = e.id_empresa
  `);
  console.log('Registros en BD (empresa + suscripcion):');
  console.table(emp.rows);

  // 2. Probar condición VISIBLE
  const VISIBLE = `e.estado_verificacion = 'verificado'
                   AND s.estado = 'activa' AND s.fecha_vencimiento >= CURRENT_DATE
                   AND e.eliminado_en IS NULL`;

  const visibles = await pool.query(`
    SELECT e.id_empresa, e.razon_social, e.slug
      FROM empresa e
      JOIN suscripcion s ON s.id_empresa = e.id_empresa
     WHERE ${VISIBLE}
  `);
  console.log('\nEmpresas que cumplen VISIBLE:', visibles.rows);

  // 3. Probar productos
  const prods = await pool.query(`
    SELECT p.id_producto, p.nombre, p.disponible, p.stock_actual, p.id_empresa, p.id_categoria
      FROM producto p
  `);
  console.log(`\nTotal productos en BD: ${prods.rows.length}`);
  console.table(prods.rows);

  // 4. Probar endpoints HTTP usando fetch
  try {
    const statsRes = await fetch('http://localhost:4000/api/publico/estadisticas');
    const stats = await statsRes.json();
    console.log('\nGET /api/publico/estadisticas -> status:', statsRes.status, stats);

    const empRes = await fetch('http://localhost:4000/api/publico/empresas');
    const empresas = await empRes.json();
    console.log('\nGET /api/publico/empresas -> status:', empRes.status, empresas);

    const portalRes = await fetch('http://localhost:4000/api/publico/empresas/tecno-andina');
    const portal = await portalRes.json();
    console.log('\nGET /api/publico/empresas/tecno-andina -> status:', portalRes.status, portal);
  } catch (err) {
    console.error('Error conectando a servidor HTTP:', err.message);
  }

  await pool.end();
}

diagnosticar();

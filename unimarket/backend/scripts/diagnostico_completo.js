require('dotenv').config();
const pool = require('../src/db');

async function diagnostico() {
  console.log('====================================================');
  console.log(' DIAGNÓSTICO COMPLETO DE BASE DE DATOS Y VISIBILIDAD');
  console.log('====================================================\n');

  const fs = require('fs');
  // 1. Verificar schema_migrations
  const hasMigrations = await pool.query(`
    SELECT to_regclass('schema_migrations') AS exists
  `);
  console.log('¿Existe tabla schema_migrations?:', hasMigrations.rows[0].exists ? 'SÍ' : 'NO');
  let migsRows = [];
  if (hasMigrations.rows[0].exists) {
    const migs = await pool.query('SELECT * FROM schema_migrations ORDER BY id ASC');
    migsRows = migs.rows;
    console.table(migs.rows);
  }
  fs.writeFileSync('diagnostico_utf8.json', JSON.stringify({
    schema_migrations_exists: !!hasMigrations.rows[0].exists,
    migrations: migsRows
  }, null, 2), 'utf8');

  // 2. Verificar columnas de notificacion_correo
  const colsNotif = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'notificacion_correo'
    ORDER BY ordinal_position
  `);
  console.log('\nColumnas en notificacion_correo:');
  console.table(colsNotif.rows);

  // 3. Verificar columnas de empresa
  const colsEmp = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'empresa'
    ORDER BY ordinal_position
  `);
  console.log('\nColumnas en empresa:');
  console.table(colsEmp.rows);

  // 4. Detalle de empresas registradas
  const emps = await pool.query(`
    SELECT e.id_empresa, e.razon_social, e.slug, e.nit, e.estado_verificacion, e.eliminado_en, e.codigo_pago,
           s.id_suscripcion, s.estado AS suscripcion_estado, s.fecha_vencimiento,
           (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date AS hoy_bolivia,
           (s.fecha_vencimiento >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date) AS es_vigente
      FROM empresa e
      LEFT JOIN suscripcion s ON s.id_empresa = e.id_empresa
  `);
  console.log('\nDatos de Empresa y Suscripción:');
  console.table(emps.rows);

  // 5. Vista v_empresas_publicas
  const hasView = await pool.query(`
    SELECT to_regclass('v_empresas_publicas') AS exists
  `);
  console.log('\n¿Existe vista v_empresas_publicas?:', hasView.rows[0].exists ? 'SÍ' : 'NO');
  if (hasView.rows[0].exists) {
    const viewDef = await pool.query(`SELECT pg_get_viewdef('v_empresas_publicas'::regclass, true) AS def`);
    console.log('Definición de v_empresas_publicas:');
    console.log(viewDef.rows[0].def);

    const enVista = await pool.query('SELECT * FROM v_empresas_publicas');
    console.log('\nFilas devueltas por v_empresas_publicas:');
    console.table(enVista.rows);
  }

  // 6. Productos y stock
  const prods = await pool.query(`
    SELECT p.id_producto, p.nombre, p.disponible, p.stock_actual, p.id_empresa, c.nombre AS categoria
      FROM producto p
      JOIN categoria c ON c.id_categoria = p.id_categoria
  `);
  console.log('\nProductos en BD:');
  console.table(prods.rows);

  // 7. Categorías con productos visibles
  const cats = await pool.query(`
    SELECT c.id_categoria, c.nombre,
           COUNT(p.id_producto)::int AS total_prods,
           COUNT(CASE WHEN p.disponible = TRUE AND p.stock_actual > 0 AND v.id_empresa IS NOT NULL THEN 1 END)::int AS prods_visibles
      FROM categoria c
      LEFT JOIN producto p ON p.id_categoria = c.id_categoria
      LEFT JOIN v_empresas_publicas v ON v.id_empresa = p.id_empresa
     GROUP BY c.id_categoria, c.nombre
     ORDER BY c.id_categoria
  `);
  console.log('\nCategorías y conteos:');
  console.table(cats.rows);

  await pool.end();
}

diagnostico().catch(console.error);

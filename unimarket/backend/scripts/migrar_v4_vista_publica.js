require('dotenv').config();
const pool = require('../src/db');

function generarSlug(str) {
  if (!str) return 'empresa';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 75);
}

async function migrarV4() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Iniciando migración v4 (vista v_empresas_publicas y slugs)...');

    // 1. Rellenar slugs vacíos si existieran
    const sinSlug = await client.query('SELECT id_empresa, razon_social, slug FROM empresa WHERE slug IS NULL OR TRIM(slug) = \'\'');
    for (const r of sinSlug.rows) {
      let base = generarSlug(r.razon_social);
      let cand = base;
      let counter = 1;
      while (true) {
        const dup = await client.query('SELECT id_empresa FROM empresa WHERE slug = $1 AND id_empresa != $2', [cand, r.id_empresa]);
        if (!dup.rows.length) break;
        counter++;
        cand = `${base}-${counter}`;
      }
      await client.query('UPDATE empresa SET slug = $1 WHERE id_empresa = $2', [cand, r.id_empresa]);
      console.log(`Generado slug "${cand}" para empresa ID ${r.id_empresa} (${r.razon_social})`);
    }

    // 2. Crear o reemplazar vista SQL v_empresas_publicas
    await client.query(`
      CREATE OR REPLACE VIEW v_empresas_publicas AS
      SELECT e.id_empresa,
             e.id_usuario,
             e.razon_social,
             e.slug,
             e.nit,
             e.correo,
             e.telefono,
             e.whatsapp,
             e.sitio_web,
             e.descripcion,
             e.logo,
             e.portada,
             e.direccion,
             e.facebook,
             e.instagram,
             e.tiktok,
             e.estado_verificacion,
             e.codigo_pago,
             e.creado_en,
             s.id_suscripcion,
             s.estado AS suscripcion_estado,
             s.fecha_inicio AS suscripcion_inicio,
             s.fecha_vencimiento AS suscripcion_vencimiento
        FROM empresa e
        JOIN suscripcion s ON s.id_empresa = e.id_empresa
       WHERE e.estado_verificacion = 'verificado'
         AND e.eliminado_en IS NULL
         AND s.estado = 'activa'
         AND s.fecha_vencimiento >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date;
    `);

    await client.query('COMMIT');
    console.log('Vista v_empresas_publicas creada exitosamente.');

    // Probar vista
    const prueba = await client.query('SELECT id_empresa, razon_social, slug, suscripcion_vencimiento FROM v_empresas_publicas');
    console.log('Empresas en vista v_empresas_publicas:', prueba.rows);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error en migración v4:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrarV4();

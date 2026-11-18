require('dotenv').config();
const pool = require('../src/db');

async function test() {
  try {
    console.log('Probando query de /admin/verificaciones...');
    const q = `
      SELECT v.id_verificacion, v.id_empresa, v.estado, v.observacion, v.fecha_solicitud, v.fecha_revision, v.documento,
             e.razon_social, e.slug, e.nit, e.descripcion, e.direccion, COALESCE(e.ciudad, 'La Paz') AS ciudad,
             e.telefono, e.whatsapp, e.sitio_web, e.codigo_pago,
             u.usuario, COALESCE(e.correo, u.correo) AS correo,
             s.estado AS suscripcion_estado,
             (SELECT c.nombre
                FROM producto p
                JOIN categoria c ON c.id_categoria = p.id_categoria
               WHERE p.id_empresa = e.id_empresa
               ORDER BY p.id_producto DESC LIMIT 1) AS rubro,
             ROUND(EXTRACT(EPOCH FROM (NOW() - v.fecha_solicitud)) / 3600, 1) AS horas_espera,
             (SELECT n.estado FROM notificacion_correo n
               WHERE n.id_empresa = e.id_empresa
               ORDER BY n.id_notificacion DESC LIMIT 1) AS ultimo_correo_estado,
             (SELECT n.plantilla FROM notificacion_correo n
               WHERE n.id_empresa = e.id_empresa
               ORDER BY n.id_notificacion DESC LIMIT 1) AS ultimo_correo_tipo
        FROM verificacion v
        JOIN empresa e ON e.id_empresa = v.id_empresa
        JOIN usuario u ON u.id_usuario = e.id_usuario
        LEFT JOIN suscripcion s ON s.id_empresa = e.id_empresa
       ORDER BY v.fecha_solicitud ASC
    `;
    const res = await pool.query(q);
    console.log('Éxito! Filas encontradas:', res.rows.length);
    console.log(res.rows);
  } catch (err) {
    console.error('ERROR EN QUERY:', err.message);
    console.error('STACK:', err);
  } finally {
    await pool.end();
  }
}

test();

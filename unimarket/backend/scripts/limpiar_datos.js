/**
 * Script de Limpieza de Datos - UNIMARKET BO (PARTE 0)
 * 
 * Deja ÚNICAMENTE la empresa "Tecno Andina S.R.L." (NIT 1023456789, usuario empresa1) y el usuario admin.
 * Elimina todas las demás empresas (ej. "Farmacia Bolivia S.r.l.") con sus usuarios,
 * verificaciones, suscripciones, pagos, productos, imágenes (incluyendo archivos físicos) y notificaciones.
 * 
 * Uso:
 *   node scripts/limpiar_datos.js --confirmar
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/unimarket',
});

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

async function pedirConfirmacion() {
  if (process.argv.includes('--confirmar') || process.argv.includes('-y')) {
    return true;
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(
      '¿Está seguro de que desea limpiar la base de datos dejando SOLO a Tecno Andina S.R.L. y admin? (s/N): ',
      (respuesta) => {
        rl.close();
        resolve(respuesta.trim().toLowerCase() === 's');
      }
    );
  });
}

function eliminarArchivoSeguro(subdirectorio, nombreArchivo) {
  if (!nombreArchivo) return false;
  try {
    const ruta = path.join(UPLOADS_DIR, subdirectorio, path.basename(nombreArchivo));
    if (fs.existsSync(ruta)) {
      fs.unlinkSync(ruta);
      return true;
    }
  } catch (err) {
    console.warn(`[WARN] No se pudo eliminar archivo físico ${nombreArchivo}:`, err.message);
  }
  return false;
}

async function limpiar() {
  const confirmado = await pedirConfirmacion();
  if (!confirmado) {
    console.log('Operación cancelada por el usuario.');
    await pool.end();
    process.exit(0);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Identificar la empresa y usuarios oficiales a conservar
    const { rows: empsConservar } = await client.query(
      `SELECT id_empresa, id_usuario, razon_social, nit, slug
         FROM empresa
        WHERE nit = '1023456789' OR slug = 'tecno-andina'
        ORDER BY id_empresa ASC
        LIMIT 1`
    );

    let idEmpresaConservar = null;
    let idUsuarioEmpresaConservar = null;

    if (empsConservar.length > 0) {
      idEmpresaConservar = empsConservar[0].id_empresa;
      idUsuarioEmpresaConservar = empsConservar[0].id_usuario;
      console.log(`[INFO] Empresa a conservar: ${empsConservar[0].razon_social} (ID: ${idEmpresaConservar}, NIT: ${empsConservar[0].nit})`);
    } else {
      console.warn('[WARN] No se encontró "Tecno Andina S.R.L.". Buscando por usuario "empresa1"...');
      const { rows: uEmp } = await client.query("SELECT id_usuario FROM usuario WHERE usuario = 'empresa1'");
      if (uEmp.length > 0) {
        idUsuarioEmpresaConservar = uEmp[0].id_usuario;
        const { rows: empRow } = await client.query("SELECT id_empresa FROM empresa WHERE id_usuario = $1", [idUsuarioEmpresaConservar]);
        if (empRow.length > 0) idEmpresaConservar = empRow[0].id_empresa;
      }
    }

    // Identificar el usuario administrador
    const { rows: admins } = await client.query("SELECT id_usuario FROM usuario WHERE usuario = 'admin' OR rol = 'administrador'");
    const idsAdminsConservar = admins.map((a) => a.id_usuario);

    const idsUsuariosConservar = new Set([...idsAdminsConservar]);
    if (idUsuarioEmpresaConservar) idsUsuariosConservar.add(idUsuarioEmpresaConservar);

    // 2. Identificar empresas y usuarios a eliminar
    const { rows: empsBorrar } = await client.query(
      `SELECT id_empresa, id_usuario, razon_social, nit, logo, portada
         FROM empresa
        WHERE id_empresa != COALESCE($1, -1)`,
      [idEmpresaConservar]
    );

    const idsEmpsBorrar = empsBorrar.map((e) => e.id_empresa);

    if (idsEmpsBorrar.length === 0) {
      console.log('\n[OK] La base de datos ya está limpia. Solo existe Tecno Andina S.R.L. y los usuarios oficiales.');
      await client.query('COMMIT');
      return;
    }

    console.log(`\n[INFO] Se encontraron ${idsEmpsBorrar.length} empresa(s) a eliminar:`);
    empsBorrar.forEach((e) => console.log(`   - ID ${e.id_empresa}: "${e.razon_social}" (NIT: ${e.nit})`));

    // 3. Recopilar archivos físicos a eliminar
    let archivosBorrados = 0;

    // Documentos NIT en uploads/documentos
    const { rows: docsVerif } = await client.query(
      `SELECT documento FROM verificacion WHERE id_empresa = ANY($1) AND documento IS NOT NULL`,
      [idsEmpsBorrar]
    );
    for (const d of docsVerif) {
      if (eliminarArchivoSeguro('documentos', d.documento)) archivosBorrados++;
    }

    // Comprobantes de pago en uploads/comprobantes
    const { rows: compsPago } = await client.query(
      `SELECT comprobante FROM pago WHERE id_empresa = ANY($1) AND comprobante IS NOT NULL`,
      [idsEmpsBorrar]
    );
    for (const c of compsPago) {
      if (eliminarArchivoSeguro('comprobantes', c.comprobante)) archivosBorrados++;
    }

    // Logos y portadas de empresa en uploads/empresas
    for (const e of empsBorrar) {
      if (eliminarArchivoSeguro('empresas', e.logo)) archivosBorrados++;
      if (eliminarArchivoSeguro('empresas', e.portada)) archivosBorrados++;
    }

    // Imágenes de productos en uploads/productos
    const { rows: imgsProd } = await client.query(
      `SELECT ip.ruta
         FROM imagen_producto ip
         JOIN producto p ON ip.id_producto = p.id_producto
        WHERE p.id_empresa = ANY($1)`,
      [idsEmpsBorrar]
    );
    for (const img of imgsProd) {
      if (eliminarArchivoSeguro('productos', img.ruta)) archivosBorrados++;
    }

    // 4. Eliminación en cascada respetando restricciones de claves foráneas
    const rImg = await client.query(
      `DELETE FROM imagen_producto
        WHERE id_producto IN (SELECT id_producto FROM producto WHERE id_empresa = ANY($1))`,
      [idsEmpsBorrar]
    );

    const rProd = await client.query(
      `DELETE FROM producto WHERE id_empresa = ANY($1)`,
      [idsEmpsBorrar]
    );

    const rPago = await client.query(
      `DELETE FROM pago WHERE id_empresa = ANY($1)`,
      [idsEmpsBorrar]
    );

    const rVerif = await client.query(
      `DELETE FROM verificacion WHERE id_empresa = ANY($1)`,
      [idsEmpsBorrar]
    );

    const rSusc = await client.query(
      `DELETE FROM suscripcion WHERE id_empresa = ANY($1)`,
      [idsEmpsBorrar]
    );

    const rNotif = await client.query(
      `DELETE FROM notificacion_correo WHERE id_empresa = ANY($1)`,
      [idsEmpsBorrar]
    );

    const rSolCat = await client.query(
      `DELETE FROM solicitud_categoria WHERE id_empresa = ANY($1)`,
      [idsEmpsBorrar]
    );

    const rEmp = await client.query(
      `DELETE FROM empresa WHERE id_empresa = ANY($1)`,
      [idsEmpsBorrar]
    );

    // Eliminar usuarios asociados que no sean admin ni empresa1
    const { rows: usuariosBorrar } = await client.query(
      `SELECT id_usuario, usuario, correo
         FROM usuario
        WHERE NOT (id_usuario = ANY($1))`,
      [Array.from(idsUsuariosConservar)]
    );

    let rUsu = { rowCount: 0 };
    if (usuariosBorrar.length > 0) {
      const idsU = usuariosBorrar.map((u) => u.id_usuario);
      rUsu = await client.query(`DELETE FROM usuario WHERE id_usuario = ANY($1)`, [idsU]);
    }

    await client.query('COMMIT');

    // 5. Reportar resumen detallado
    console.log('\n======================================================');
    console.log('       RESUMEN DE LIMPIEZA DE DATOS (UNIMARKET BO)     ');
    console.log('======================================================');
    console.log(`Empresas eliminadas:              ${rEmp.rowCount}`);
    console.log(`Usuarios eliminados:              ${rUsu.rowCount}`);
    console.log(`Productos eliminados:             ${rProd.rowCount}`);
    console.log(`Imágenes de producto eliminadas:  ${rImg.rowCount}`);
    console.log(`Pagos eliminados:                 ${rPago.rowCount}`);
    console.log(`Verificaciones eliminadas:        ${rVerif.rowCount}`);
    console.log(`Suscripciones eliminadas:         ${rSusc.rowCount}`);
    console.log(`Notificaciones eliminadas:        ${rNotif.rowCount}`);
    console.log(`Solicitudes categoría eliminadas: ${rSolCat.rowCount}`);
    console.log(`Archivos físicos eliminados:      ${archivosBorrados}`);
    console.log('------------------------------------------------------');

    // Verificar lo que quedó
    const { rows: empsRest } = await client.query("SELECT id_empresa, razon_social, nit, slug FROM empresa");
    const { rows: ususRest } = await client.query("SELECT id_usuario, usuario, correo, rol FROM usuario");
    const { rows: prodsRest } = await client.query("SELECT id_producto, nombre, id_categoria FROM producto");
    const { rows: catsRest } = await client.query("SELECT COUNT(*) AS total FROM categoria");

    console.log('\nESTADO FINAL EN BASE DE DATOS:');
    console.log('Empresas activas:');
    empsRest.forEach((e) => console.log(`  - [ID ${e.id_empresa}] ${e.razon_social} (NIT: ${e.nit}, Slug: ${e.slug})`));
    console.log('Usuarios activos:');
    ususRest.forEach((u) => console.log(`  - [ID ${u.id_usuario}] ${u.usuario} (${u.correo}, rol: ${u.rol})`));
    console.log(`Productos en catálogo: ${prodsRest.length} productos de Tecno Andina S.R.L.`);
    prodsRest.forEach((p) => console.log(`  - [ID ${p.id_producto}] ${p.nombre}`));
    console.log(`Categorías oficiales preservadas: ${catsRest[0].total}`);
    console.log('======================================================\n');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[ERROR] Error durante la limpieza de datos:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

limpiar().catch((err) => {
  console.error('Fallo en la ejecución:', err.message);
  process.exit(1);
});

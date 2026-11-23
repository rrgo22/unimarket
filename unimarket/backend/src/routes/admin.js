const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { autenticar, permitir } = require('../middleware/auth');
const { DIR_DOCS, DIR_COMP, DIR_EMP, DIR_PROD, subirComprobante, erroresUpload } = require('../middleware/upload');
const { capitalizar, limpiar } = require('../utils/normalizar');
const {
  enviarCorreo,
  construirCorreoCuentaVerificada,
  construirCorreoObservacion,
  construirCorreoRechazo,
  construirCorreoSuscripcionActivada,
  construirCorreoSuscripcionSuspendida,
} = require('../servicios/correo');

const router = express.Router();
router.use(autenticar, permitir('administrador'));

// CU9: listado de empresas con estado de verificación y suscripción (solo no eliminadas)
router.get('/empresas', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.id_empresa, e.razon_social, e.slug, e.nit, e.telefono, e.whatsapp, e.estado_verificacion,
              u.correo, s.estado AS suscripcion, s.fecha_vencimiento,
              (SELECT COUNT(*)::int FROM producto p WHERE p.id_empresa = e.id_empresa) AS productos
         FROM empresa e
         JOIN usuario u ON u.id_usuario = e.id_usuario
         LEFT JOIN suscripcion s ON s.id_empresa = e.id_empresa
        WHERE e.eliminado_en IS NULL
        ORDER BY e.id_empresa DESC`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// PARTE 2: Eliminar empresa enviándola a la Papelera (Borrado lógico)
router.delete('/empresas/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    const motivo = limpiar(req.body.motivo);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador de empresa no válido' });
    }

    await client.query('BEGIN');
    const { rows: emps } = await client.query(
      'SELECT id_empresa, id_usuario, razon_social FROM empresa WHERE id_empresa = $1 AND eliminado_en IS NULL',
      [id]
    );

    if (!emps.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Empresa no encontrada o ya se encuentra en la papelera' });
    }
    const emp = emps[0];

    // Marcar como eliminada lógicamente en empresa
    await client.query(
      `UPDATE empresa
          SET eliminado_en = NOW(),
              eliminado_por = $1,
              motivo_eliminacion = $2
        WHERE id_empresa = $3`,
      [req.user.id_usuario, motivo || 'Eliminada por la administración', id]
    );

    // Suspender su suscripción
    await client.query(`UPDATE suscripcion SET estado = 'suspendida' WHERE id_empresa = $1`, [id]);

    // Desactivar el usuario para bloquear login
    await client.query(`UPDATE usuario SET activo = FALSE WHERE id_usuario = $1`, [emp.id_usuario]);

    // Registrar en tabla auditoria
    await client.query(
      `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, detalle)
       VALUES ($1, 'eliminar_empresa_papelera', 'empresa', $2, $3)`,
      [req.user.id_usuario, id, `Empresa "${emp.razon_social}" enviada a papelera. Motivo: ${motivo || 'Sin motivo especificado'}`]
    );

    await client.query('COMMIT');
    res.json({ mensaje: `Empresa "${emp.razon_social}" enviada a la papelera.` });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

// PARTE 2: Listar empresas en la Papelera
router.get('/papelera', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.id_empresa, e.razon_social, e.nit, e.slug, e.eliminado_en, e.motivo_eliminacion,
              u.usuario, u.correo,
              adminUser.nombre AS eliminado_por_nombre,
              (SELECT COUNT(*)::int FROM producto p WHERE p.id_empresa = e.id_empresa) AS productos
         FROM empresa e
         JOIN usuario u ON u.id_usuario = e.id_usuario
         LEFT JOIN usuario adminUser ON adminUser.id_usuario = e.eliminado_por
        WHERE e.eliminado_en IS NOT NULL
        ORDER BY e.eliminado_en DESC`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// PARTE 2: Restaurar empresa desde la Papelera
router.post('/papelera/:id/restaurar', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador no válido' });

    await client.query('BEGIN');
    const { rows: emps } = await client.query(
      'SELECT id_empresa, id_usuario, razon_social FROM empresa WHERE id_empresa = $1 AND eliminado_en IS NOT NULL',
      [id]
    );
    if (!emps.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Empresa no encontrada en la papelera' });
    }
    const emp = emps[0];

    // Restaurar empresa
    await client.query(
      `UPDATE empresa
          SET eliminado_en = NULL,
              eliminado_por = NULL,
              motivo_eliminacion = NULL
        WHERE id_empresa = $1`,
      [id]
    );

    // Reactivar usuario
    await client.query(`UPDATE usuario SET activo = TRUE WHERE id_usuario = $1`, [emp.id_usuario]);

    // Registrar en auditoría
    await client.query(
      `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, detalle)
       VALUES ($1, 'restaurar_empresa', 'empresa', $2, $3)`,
      [req.user.id_usuario, id, `Empresa "${emp.razon_social}" restaurada desde la papelera`]
    );

    await client.query('COMMIT');
    res.json({ mensaje: `Empresa "${emp.razon_social}" restaurada con éxito.` });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

// PARTE 2: Eliminar definitivamente una empresa (borra registros y archivos físicos)
router.delete('/papelera/:id/definitivo', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    const confirmacionNombre = limpiar(req.body.confirmacion_nombre);

    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador no válido' });

    await client.query('BEGIN');
    const { rows: emps } = await client.query(
      'SELECT id_empresa, id_usuario, razon_social, logo, portada FROM empresa WHERE id_empresa = $1 AND eliminado_en IS NOT NULL',
      [id]
    );
    if (!emps.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Empresa no encontrada en la papelera' });
    }
    const emp = emps[0];

    // Doble confirmación por nombre
    if (confirmacionNombre.toLowerCase() !== emp.razon_social.toLowerCase()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Para confirmar la eliminación definitiva, escriba exactamente "${emp.razon_social}"` });
    }

    // 1. Eliminar archivos físicos
    const borrarArchivo = (dir, nombre) => {
      if (!nombre) return;
      try {
        const ruta = path.join(dir, path.basename(nombre));
        if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
      } catch (_) {}
    };

    // Documentos NIT
    const { rows: docs } = await client.query('SELECT documento FROM verificacion WHERE id_empresa = $1 AND documento IS NOT NULL', [id]);
    docs.forEach((d) => borrarArchivo(DIR_DOCS, d.documento));

    // Comprobantes
    const { rows: comps } = await client.query('SELECT comprobante FROM pago WHERE id_empresa = $1 AND comprobante IS NOT NULL', [id]);
    comps.forEach((c) => borrarArchivo(DIR_COMP, c.comprobante));

    // Logos y portadas
    borrarArchivo(DIR_EMP, emp.logo);
    borrarArchivo(DIR_EMP, emp.portada);

    // Imágenes de productos
    const { rows: imgs } = await client.query(
      `SELECT ip.ruta FROM imagen_producto ip JOIN producto p ON ip.id_producto = p.id_producto WHERE p.id_empresa = $1`,
      [id]
    );
    imgs.forEach((img) => borrarArchivo(DIR_PROD, img.ruta));

    // 2. Eliminación en cascada de BD
    await client.query(`DELETE FROM imagen_producto WHERE id_producto IN (SELECT id_producto FROM producto WHERE id_empresa = $1)`, [id]);
    await client.query('DELETE FROM movimiento_stock WHERE id_empresa = $1', [id]);
    await client.query('DELETE FROM venta_item WHERE id_venta IN (SELECT id_venta FROM venta WHERE id_empresa = $1)', [id]);
    await client.query('DELETE FROM venta WHERE id_empresa = $1', [id]);
    await client.query('DELETE FROM cliente WHERE id_empresa = $1', [id]);
    await client.query('DELETE FROM producto WHERE id_empresa = $1', [id]);
    await client.query('DELETE FROM pago WHERE id_empresa = $1', [id]);
    await client.query('DELETE FROM verificacion WHERE id_empresa = $1', [id]);
    await client.query('DELETE FROM suscripcion WHERE id_empresa = $1', [id]);
    await client.query('DELETE FROM notificacion_correo WHERE id_empresa = $1', [id]);
    await client.query('DELETE FROM solicitud_categoria WHERE id_empresa = $1', [id]);
    await client.query('DELETE FROM empresa WHERE id_empresa = $1', [id]);
    await client.query('DELETE FROM usuario WHERE id_usuario = $1', [emp.id_usuario]);

    // Auditoría
    await client.query(
      `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, detalle)
       VALUES ($1, 'eliminar_empresa_definitiva', 'empresa', $2, $3)`,
      [req.user.id_usuario, id, `Empresa "${emp.razon_social}" eliminada definitivamente junto con todos sus datos y archivos`]
    );

    await client.query('COMMIT');
    res.json({ mensaje: `Empresa "${emp.razon_social}" y todos sus datos han sido eliminados definitivamente.` });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

// PARTE 2: Vaciar papelera (empresas con más de 30 días o todas si se solicita)
router.post('/papelera/vaciar', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const soloMayores30Dias = req.body.todas !== true;
    await client.query('BEGIN');

    const condTiempo = soloMayores30Dias ? `AND eliminado_en < NOW() - INTERVAL '30 days'` : '';
    const { rows: emps } = await client.query(`SELECT id_empresa, razon_social FROM empresa WHERE eliminado_en IS NOT NULL ${condTiempo}`);

    if (!emps.length) {
      await client.query('ROLLBACK');
      return res.json({ mensaje: 'No hay empresas en la papelera para purgar.', eliminadas: 0 });
    }

    const ids = emps.map((e) => e.id_empresa);

    await client.query(`DELETE FROM imagen_producto WHERE id_producto IN (SELECT id_producto FROM producto WHERE id_empresa = ANY($1))`, [ids]);
    await client.query('DELETE FROM movimiento_stock WHERE id_empresa = ANY($1)', [ids]);
    await client.query('DELETE FROM venta_item WHERE id_venta IN (SELECT id_venta FROM venta WHERE id_empresa = ANY($1))', [ids]);
    await client.query('DELETE FROM venta WHERE id_empresa = ANY($1)', [ids]);
    await client.query('DELETE FROM cliente WHERE id_empresa = ANY($1)', [ids]);
    await client.query('DELETE FROM producto WHERE id_empresa = ANY($1)', [ids]);
    await client.query('DELETE FROM pago WHERE id_empresa = ANY($1)', [ids]);
    await client.query('DELETE FROM verificacion WHERE id_empresa = ANY($1)', [ids]);
    await client.query('DELETE FROM suscripcion WHERE id_empresa = ANY($1)', [ids]);
    await client.query('DELETE FROM notificacion_correo WHERE id_empresa = ANY($1)', [ids]);
    await client.query('DELETE FROM solicitud_categoria WHERE id_empresa = ANY($1)', [ids]);
    await client.query(
      `DELETE FROM usuario WHERE id_usuario IN (SELECT id_usuario FROM empresa WHERE id_empresa = ANY($1))`,
      [ids]
    );
    await client.query('DELETE FROM empresa WHERE id_empresa = ANY($1)', [ids]);

    await client.query(
      `INSERT INTO auditoria (id_usuario, accion, entidad, detalle)
       VALUES ($1, 'vaciar_papelera', 'empresa', $2)`,
      [req.user.id_usuario, `Se purgaron definitivamente ${emps.length} empresas de la papelera.`]
    );

    await client.query('COMMIT');
    res.json({ mensaje: `Se purgaron ${emps.length} empresa(s) de la papelera con éxito.`, eliminadas: emps.length });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

// CU3: Solicitudes de verificación de NIT
// Filtros: pendiente | observada | verificada | rechazada | todas. Ordenadas por antigüedad.
router.get('/verificaciones', async (req, res, next) => {
  try {
    const estadoFiltro = String(req.query.estado || 'pendiente').toLowerCase();
    const where = [];
    const params = [];

    if (estadoFiltro === 'pendiente') {
      where.push(`v.estado = 'pendiente'`);
    } else if (estadoFiltro === 'observada' || estadoFiltro === 'observado') {
      where.push(`v.estado IN ('observada', 'observado')`);
    } else if (estadoFiltro === 'verificada' || estadoFiltro === 'verificado' || estadoFiltro === 'aprobado') {
      where.push(`v.estado IN ('verificada', 'verificado', 'aprobado')`);
    } else if (estadoFiltro === 'rechazada' || estadoFiltro === 'rechazado') {
      where.push(`v.estado IN ('rechazada', 'rechazado')`);
    }
    const slaFiltro = String(req.query.sla || '').toLowerCase();
    if (slaFiltro === 'normal') {
      where.push(`NOW() - v.fecha_solicitud < INTERVAL '24 hours'`);
    } else if (slaFiltro === 'alerta') {
      where.push(`NOW() - v.fecha_solicitud >= INTERVAL '24 hours' AND NOW() - v.fecha_solicitud < INTERVAL '48 hours'`);
    } else if (slaFiltro === 'critico') {
      where.push(`NOW() - v.fecha_solicitud >= INTERVAL '48 hours'`);
    }
    // Si es 'todas', no se agrega filtro de estado

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT v.id_verificacion, v.id_empresa, v.estado, v.observacion, v.fecha_solicitud, v.fecha_revision, v.documento,
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
              (SELECT COALESCE(n.tipo, n.plantilla) FROM notificacion_correo n
                WHERE n.id_empresa = e.id_empresa
                ORDER BY n.id_notificacion DESC LIMIT 1) AS ultimo_correo_tipo
         FROM verificacion v
         JOIN empresa e ON e.id_empresa = v.id_empresa
         JOIN usuario u ON u.id_usuario = e.id_usuario
         LEFT JOIN suscripcion s ON s.id_empresa = e.id_empresa
        ${whereClause}
        ORDER BY v.fecha_solicitud ASC`,
      params
    );

    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Documento de NIT incrustado o descargable: solo accesible para el administrador (inline PDF)
router.get(['/verificaciones/:id/pdf', '/verificaciones/:id/documento'], async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query('SELECT documento FROM verificacion WHERE id_verificacion = $1', [id]);
    if (!rows.length || !rows[0].documento) return res.status(404).json({ error: 'Documento no encontrado' });
    const archivo = path.join(DIR_DOCS, path.basename(rows[0].documento));
    if (!fs.existsSync(archivo)) return res.status(404).json({ error: 'El archivo ya no existe en el servidor' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="nit-${path.basename(rows[0].documento)}"`);
    res.sendFile(archivo);
  } catch (e) {
    next(e);
  }
});

// Revisión y decisión sobre verificación de NIT: aprobar, observar, rechazar o revertir a pendiente
router.put('/verificaciones/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    const accion = String(req.body.accion || '').toLowerCase();
    const observacion = limpiar(req.body.observacion);

    if (!['aprobar', 'observar', 'rechazar', 'revertir_pendiente'].includes(accion)) {
      return res.status(400).json({ error: 'Acción no válida' });
    }
    if ((accion === 'observar' || accion === 'rechazar') && observacion.length < 5) {
      return res.status(400).json({ error: 'El motivo es obligatorio (mínimo 5 caracteres)' });
    }

    await client.query('BEGIN');

    const vRes = await client.query(
      `SELECT v.id_verificacion, v.id_empresa, v.estado, e.razon_social, e.nit, e.codigo_pago,
              COALESCE(e.correo, u.correo) AS correo,
              u.usuario
         FROM verificacion v
         JOIN empresa e ON e.id_empresa = v.id_empresa
         JOIN usuario u ON u.id_usuario = e.id_usuario
        WHERE v.id_verificacion = $1`,
      [id]
    );

    if (!vRes.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Solicitud de verificación no encontrada' });
    }

    const sol = vRes.rows[0];
    const id_empresa = sol.id_empresa;
    let codigoPagoFinal = sol.codigo_pago;

    if (accion === 'aprobar') {
      // 1. Asignar código de pago único si no existe
      if (!codigoPagoFinal) {
        const seqRes = await client.query("SELECT nextval('seq_codigo_pago') AS seq");
        codigoPagoFinal = `UM-${String(seqRes.rows[0].seq).padStart(4, '0')}`;
        await client.query('UPDATE empresa SET codigo_pago = $1 WHERE id_empresa = $2', [codigoPagoFinal, id_empresa]);
      }

      // 2. Marcar verificación como verificada
      await client.query(
        `UPDATE verificacion
            SET estado = 'verificada',
                observacion = NULL,
                fecha_revision = NOW()
          WHERE id_verificacion = $1`,
        [id]
      );

      // 3. Empresa verificada pero con suscripción pendiente_pago (aún no pública)
      await client.query(
        `UPDATE empresa
            SET estado_verificacion = 'verificado',
                codigo_pago = $1
          WHERE id_empresa = $2`,
        [codigoPagoFinal, id_empresa]
      );

      await client.query(
        `UPDATE suscripcion
            SET estado = 'pendiente_pago'
          WHERE id_empresa = $1`,
        [id_empresa]
      );

      // 4. Registro en auditoría
      await client.query(
        `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, detalle)
         VALUES ($1, 'aprobar_verificacion', 'verificacion', $2, $3)`,
        [req.user.id_usuario, id, `Verificación aprobada para ${sol.razon_social}. Código de pago asignado: ${codigoPagoFinal}`]
      );
    } else if (accion === 'observar') {
      await client.query(
        `UPDATE verificacion
            SET estado = 'observada',
                observacion = $1,
                fecha_revision = NOW()
          WHERE id_verificacion = $2`,
        [observacion, id]
      );
      await client.query(`UPDATE empresa SET estado_verificacion = 'observado' WHERE id_empresa = $1`, [id_empresa]);
      await client.query(
        `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, detalle)
         VALUES ($1, 'observar_verificacion', 'verificacion', $2, $3)`,
        [req.user.id_usuario, id, `Verificación observada para ${sol.razon_social}. Motivo: ${observacion}`]
      );
    } else if (accion === 'rechazar') {
      await client.query(
        `UPDATE verificacion
            SET estado = 'rechazada',
                observacion = $1,
                fecha_revision = NOW()
          WHERE id_verificacion = $2`,
        [observacion, id]
      );
      await client.query(`UPDATE empresa SET estado_verificacion = 'rechazado' WHERE id_empresa = $1`, [id_empresa]);
      await client.query(
        `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, detalle)
         VALUES ($1, 'rechazar_verificacion', 'verificacion', $2, $3)`,
        [req.user.id_usuario, id, `Verificación rechazada para ${sol.razon_social}. Motivo: ${observacion}`]
      );
    } else if (accion === 'revertir_pendiente') {
      await client.query(
        `UPDATE verificacion
            SET estado = 'pendiente',
                observacion = $1,
                fecha_revision = NULL
          WHERE id_verificacion = $2`,
        [observacion || 'Revertido a pendiente por el administrador', id]
      );
      await client.query(`UPDATE empresa SET estado_verificacion = 'pendiente' WHERE id_empresa = $1`, [id_empresa]);
      await client.query(
        `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, detalle)
         VALUES ($1, 'revertir_verificacion', 'verificacion', $2, $3)`,
        [req.user.id_usuario, id, `Verificación revertida a pendiente para ${sol.razon_social}`]
      );
    }

    await client.query('COMMIT');

    // Envío del correo correspondiente (un fallo de correo no rompe la operación)
    let correoEnviado = false;
    if (sol.correo) {
      if (accion === 'aprobar') {
        const plantilla = construirCorreoCuentaVerificada({
          razonSocial: sol.razon_social,
          codigoPago: codigoPagoFinal,
          usuario: sol.usuario,
        });
        const resEnvio = await enviarCorreo({
          id_empresa,
          tipo: 'cuenta_verificada',
          para: sol.correo,
          asunto: plantilla.asunto,
          html: plantilla.html,
          texto: plantilla.texto,
          adjuntarQr: true,
        }).catch((err) => ({ exito: false, error: err.message }));
        correoEnviado = Boolean(resEnvio && resEnvio.exito);
      } else if (accion === 'observar') {
        const plantilla = construirCorreoObservacion({
          razonSocial: sol.razon_social,
          motivo: observacion,
        });
        const resEnvio = await enviarCorreo({
          id_empresa,
          tipo: 'observada',
          para: sol.correo,
          asunto: plantilla.asunto,
          html: plantilla.html,
          texto: plantilla.texto,
        }).catch((err) => ({ exito: false, error: err.message }));
        correoEnviado = Boolean(resEnvio && resEnvio.exito);
      } else if (accion === 'rechazar') {
        const plantilla = construirCorreoRechazo({
          razonSocial: sol.razon_social,
          motivo: observacion,
        });
        const resEnvio = await enviarCorreo({
          id_empresa,
          tipo: 'rechazada',
          para: sol.correo,
          asunto: plantilla.asunto,
          html: plantilla.html,
          texto: plantilla.texto,
        }).catch((err) => ({ exito: false, error: err.message }));
        correoEnviado = Boolean(resEnvio && resEnvio.exito);
      }
    }

    res.json({
      mensaje:
        accion === 'aprobar'
          ? 'Empresa verificada con éxito. Código de pago generado y correo enviado.'
          : accion === 'observar'
          ? 'Solicitud observada y empresa notificada.'
          : accion === 'rechazar'
          ? 'Solicitud rechazada y empresa notificada.'
          : 'Solicitud revertida a pendiente con éxito.',
      correo_enviado: correoEnviado,
      correo_destino: sol.correo,
      codigo_pago: codigoPagoFinal,
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

// Reenviar correo de verificación (con QR embebido o motivo)
router.post('/verificaciones/:id/reenviar-correo', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `SELECT v.estado, v.observacion, e.id_empresa, e.razon_social, e.nit, e.codigo_pago,
              COALESCE(e.correo, u.correo) AS correo
         FROM verificacion v
         JOIN empresa e ON e.id_empresa = v.id_empresa
         JOIN usuario u ON u.id_usuario = e.id_usuario
        WHERE v.id_verificacion = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Solicitud no encontrada' });
    const sol = rows[0];

    let resEnvio = null;
    if (['verificada', 'verificado', 'aprobado'].includes(sol.estado)) {
      resEnvio = await enviarCorreo({
        id_empresa: sol.id_empresa,
        tipo: 'cuenta_verificada',
        para: sol.correo,
        datos: {
          razonSocial: sol.razon_social,
          codigoPago: sol.codigo_pago || 'UM-0001',
          monto: 200,
          banco: process.env.PAGO_BANCO || 'Banco Unión S.A.',
          titular: process.env.PAGO_TITULAR || 'UNIMARKET BO',
          cuenta: process.env.PAGO_CUENTA || '10000034567890',
          appUrl: process.env.APP_URL || 'http://localhost:5173',
        },
      });
    } else if (['observada', 'observado'].includes(sol.estado)) {
      resEnvio = await enviarCorreo({
        id_empresa: sol.id_empresa,
        tipo: 'observada',
        para: sol.correo,
        datos: {
          razonSocial: sol.razon_social,
          observacion: sol.observacion || 'Se requiere documentación complementaria.',
          appUrl: process.env.APP_URL || 'http://localhost:5173',
        },
      });
    } else if (['rechazada', 'rechazado'].includes(sol.estado)) {
      resEnvio = await enviarCorreo({
        id_empresa: sol.id_empresa,
        tipo: 'rechazada',
        para: sol.correo,
        datos: {
          razonSocial: sol.razon_social,
          observacion: sol.observacion || 'La documentación no cumple los requisitos establecidos.',
        },
      });
    }

    if (resEnvio && resEnvio.exito) {
      res.json({ mensaje: `Correo reenviado exitosamente a ${sol.correo}`, correo_destino: sol.correo });
    } else {
      res.status(500).json({ error: `No se pudo enviar el correo a ${sol.correo}: ${resEnvio?.error || 'Error SMTP'}` });
    }
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------------------
// GESTIÓN DE PAGOS Y COMPROBANTES DE SUSCRIPCIÓN (PARTE 4)
// -------------------------------------------------------------------------

// Listado de pagos ordenados del más antiguo al más nuevo para revisión oportuna
router.get('/pagos', async (req, res, next) => {
  try {
    const estadoFiltro = String(req.query.estado || 'en_revision').toLowerCase();
    const where = [];
    const params = [];

    if (estadoFiltro === 'en_revision' || estadoFiltro === 'pendiente') {
      where.push(`p.estado IN ('en_revision', 'pendiente')`);
    } else if (estadoFiltro === 'confirmado') {
      where.push(`p.estado = 'confirmado'`);
    } else if (estadoFiltro === 'rechazado') {
      where.push(`p.estado = 'rechazado'`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT p.id_pago, p.id_empresa, p.monto, p.metodo, p.referencia, p.banco, p.fecha_pago, p.comprobante,
              p.estado, p.observacion, p.meses, p.fecha, p.confirmado_por, p.fecha_confirmacion, p.es_demo,
              e.razon_social, e.slug, e.nit, e.codigo_pago, COALESCE(e.correo, u.correo) AS correo,
              s.estado AS suscripcion_estado, s.fecha_vencimiento,
              ROUND(EXTRACT(EPOCH FROM (NOW() - p.fecha)) / 3600, 1) AS horas_espera
         FROM pago p
         JOIN empresa e ON e.id_empresa = p.id_empresa
         JOIN usuario u ON u.id_usuario = e.id_usuario
         LEFT JOIN suscripcion s ON s.id_empresa = e.id_empresa
        ${whereClause}
        ORDER BY p.fecha ASC`,
      params
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Descargar o visualizar comprobante de pago protegido por autenticación admin
router.get('/pagos/:id/comprobante', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query('SELECT comprobante FROM pago WHERE id_pago = $1', [id]);
    if (!rows.length || !rows[0].comprobante) return res.status(404).json({ error: 'Comprobante no encontrado' });
    const archivo = path.join(DIR_COMP, path.basename(rows[0].comprobante));
    if (!fs.existsSync(archivo)) return res.status(404).json({ error: 'El archivo ya no existe en el servidor' });

    const ext = path.extname(archivo).toLowerCase();
    const mime = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(rows[0].comprobante)}"`);
    res.sendFile(archivo);
  } catch (e) {
    next(e);
  }
});

// Confirmar o rechazar un comprobante de pago
router.put('/pagos/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    const accion = String(req.body.accion || '').toLowerCase(); // 'confirmar' | 'rechazar'
    const observacion = limpiar(req.body.observacion);

    if (!['confirmar', 'rechazar'].includes(accion)) {
      return res.status(400).json({ error: 'Acción no válida (debe ser confirmar o rechazar)' });
    }
    if (accion === 'rechazar' && observacion.length < 5) {
      return res.status(400).json({ error: 'Debe especificar el motivo del rechazo del comprobante (mínimo 5 caracteres)' });
    }

    await client.query('BEGIN');

    // Validar que el pago exista y no esté ya confirmado o rechazado
    const pagoRes = await client.query(
      `SELECT p.id_pago, p.id_empresa, p.monto, p.metodo, p.referencia, p.banco, p.meses, p.estado,
              e.razon_social, e.slug, e.nit, e.codigo_pago, COALESCE(e.correo, u.correo) AS correo,
              s.estado AS suscripcion_estado, s.fecha_vencimiento
         FROM pago p
         JOIN empresa e ON e.id_empresa = p.id_empresa
         JOIN usuario u ON u.id_usuario = e.id_usuario
         LEFT JOIN suscripcion s ON s.id_empresa = e.id_empresa
        WHERE p.id_pago = $1 AND p.estado IN ('en_revision', 'pendiente')
        FOR UPDATE OF p`,
      [id]
    );

    if (!pagoRes.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Comprobante de pago no encontrado o ya fue procesado anteriormente' });
    }

    const pago = pagoRes.rows[0];
    const meses = Math.max(parseInt(pago.meses, 10) || 1, 1);
    const diasAgregar = meses * 30;
    let nuevaFechaVencimiento = null;

    if (accion === 'confirmar') {
      await client.query(
        `UPDATE pago
            SET estado = 'confirmado',
                confirmado_por = $1,
                fecha_confirmacion = NOW(),
                observacion = COALESCE($2, observacion)
          WHERE id_pago = $3`,
        [req.user.id_usuario, observacion || null, id]
      );

      // Calcular vencimiento en America/La_Paz:
      // Si la suscripción actual está activa y vigente, sumar 30 días a su vencimiento actual.
      // De lo contrario, iniciar desde hoy + 30 días.
      const resSusc = await client.query(
        `UPDATE suscripcion
            SET estado = 'activa',
                fecha_inicio = CASE
                  WHEN estado = 'activa' AND fecha_vencimiento >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date THEN fecha_inicio
                  ELSE (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date
                END,
                fecha_vencimiento = CASE
                  WHEN estado = 'activa' AND fecha_vencimiento >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date THEN fecha_vencimiento + ($1 || ' days')::interval
                  ELSE (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date + ($1 || ' days')::interval
                END
          WHERE id_empresa = $2
          RETURNING fecha_vencimiento, fecha_inicio`,
        [diasAgregar, pago.id_empresa]
      );

      nuevaFechaVencimiento = resSusc.rows[0]?.fecha_vencimiento;
      const fechaInicio = resSusc.rows[0]?.fecha_inicio;

      // Auditoría
      await client.query(
        `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, detalle)
         VALUES ($1, 'confirmar_pago', 'pago', $2, $3)`,
        [req.user.id_usuario, id, `Pago de Bs ${pago.monto} confirmado para ${pago.razon_social}. Suscripción activa hasta ${nuevaFechaVencimiento}`]
      );

      await client.query('COMMIT');

      // Enviar correo de pago confirmado y activación de tienda
      if (pago.correo) {
        enviarCorreo({
          id_empresa: pago.id_empresa,
          tipo: 'pago_confirmado',
          para: pago.correo,
          datos: {
            razonSocial: pago.razon_social,
            plan: 'Plan Único Bs 200/mes',
            fechaInicio,
            fechaVencimiento: nuevaFechaVencimiento,
            monto: pago.monto,
            referencia: pago.referencia,
            slug: pago.slug,
            appUrl: process.env.APP_URL || 'http://localhost:5173',
          },
        }).catch((errMail) => console.error('[CORREO] Error enviando correo de pago confirmado:', errMail.message));
      }
    } else {
      // Rechazo de comprobante
      await client.query(
        `UPDATE pago
            SET estado = 'rechazado',
                confirmado_por = $1,
                fecha_confirmacion = NOW(),
                observacion = $2
          WHERE id_pago = $3`,
        [req.user.id_usuario, observacion, id]
      );

      // Revertir suscripción a pendiente_pago para que la empresa pueda subir otro comprobante
      await client.query(
        `UPDATE suscripcion
            SET estado = 'pendiente_pago'
          WHERE id_empresa = $1 AND estado = 'en_revision'`,
        [pago.id_empresa]
      );

      await client.query(
        `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, detalle)
         VALUES ($1, 'rechazar_pago', 'pago', $2, $3)`,
        [req.user.id_usuario, id, `Comprobante rechazado para ${pago.razon_social}. Motivo: ${observacion}`]
      );

      await client.query('COMMIT');

      // Notificar a la empresa
      if (pago.correo) {
        enviarCorreo({
          id_empresa: pago.id_empresa,
          tipo: 'comprobante_rechazado',
          para: pago.correo,
          datos: {
            razonSocial: pago.razon_social,
            observacion,
            appUrl: process.env.APP_URL || 'http://localhost:5173',
          },
        }).catch((errMail) => console.error('[CORREO] Error enviando rechazo de comprobante:', errMail.message));
      }
    }

    res.json({
      mensaje:
        accion === 'confirmar'
          ? `Pago confirmado con éxito. Portal activado y suscripción vigente hasta ${String(nuevaFechaVencimiento).slice(0, 10)}.`
          : 'Comprobante rechazado. Se notificó a la empresa para que pueda subir otro comprobante.',
      correo_destino: pago.correo,
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

// Registro manual de pago en nombre de una empresa (efectivo, transferencia verificada)
router.post('/pagos/manual', subirComprobante.single('comprobante'), erroresUpload, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id_empresa = parseInt(req.body.id_empresa, 10);
    const metodo = ['efectivo', 'transferencia', 'qr'].includes(req.body.metodo) ? req.body.metodo : 'transferencia';
    const banco = req.body.banco ? String(req.body.banco).trim().slice(0, 100) : 'Depósito Directo';
    const monto = req.body.monto ? Math.max(parseFloat(req.body.monto), 0) : 200.00;
    const referencia = limpiar(req.body.referencia) || `Pago manual registrado por administración (${metodo})`;
    const observacion = limpiar(req.body.observacion) || 'Registrado manualmente por la administración';

    if (!Number.isInteger(id_empresa)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Seleccione una empresa válida' });
    }

    await client.query('BEGIN');
    const empRes = await client.query(
      `SELECT e.id_empresa, e.razon_social, e.slug, COALESCE(e.correo, u.correo) AS correo
         FROM empresa e
         JOIN usuario u ON u.id_usuario = e.id_usuario
        WHERE e.id_empresa = $1`,
      [id_empresa]
    );
    if (!empRes.rowCount) {
      await client.query('ROLLBACK');
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }
    const emp = empRes.rows[0];
    const comprobanteFilename = req.file ? req.file.filename : null;

    const pagoInsert = await client.query(
      `INSERT INTO pago (id_empresa, monto, metodo, referencia, banco, comprobante, estado, observacion, meses, confirmado_por, fecha_confirmacion, fecha)
       VALUES ($1, $2, $3, $4, $5, $6, 'confirmado', $7, 1, $8, NOW(), NOW())
       RETURNING id_pago`,
      [id_empresa, monto, metodo, referencia, banco, comprobanteFilename, observacion, req.user.id_usuario]
    );

    const resSusc = await client.query(
      `UPDATE suscripcion
          SET estado = 'activa',
              fecha_inicio = CASE
                WHEN estado = 'activa' AND fecha_vencimiento >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date THEN fecha_inicio
                ELSE (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date
              END,
              fecha_vencimiento = CASE
                WHEN estado = 'activa' AND fecha_vencimiento >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date THEN fecha_vencimiento + INTERVAL '30 days'
                ELSE (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date + INTERVAL '30 days'
              END
        WHERE id_empresa = $1
        RETURNING fecha_vencimiento, fecha_inicio`,
      [id_empresa]
    );
    const nuevaFechaVencimiento = resSusc.rows[0]?.fecha_vencimiento;
    const fechaInicio = resSusc.rows[0]?.fecha_inicio;

    await client.query(
      `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, detalle)
       VALUES ($1, 'registrar_pago_manual', 'pago', $2, $3)`,
      [req.user.id_usuario, pagoInsert.rows[0].id_pago, `Pago manual de Bs ${monto} registrado para ${emp.razon_social}. Motivo: ${observacion}`]
    );

    await client.query('COMMIT');

    // Enviar correo de confirmación de pago
    if (emp.correo) {
      enviarCorreo({
        id_empresa,
        tipo: 'pago_confirmado',
        para: emp.correo,
        datos: {
          razonSocial: emp.razon_social,
          plan: 'Plan Único Bs 200/mes',
          fechaInicio,
          fechaVencimiento: nuevaFechaVencimiento,
          monto,
          referencia,
          slug: emp.slug,
          appUrl: process.env.APP_URL || 'http://localhost:5173',
        },
      }).catch((errMail) => console.error('[CORREO] Error enviando correo manual pago confirmado:', errMail.message));
    }

    res.status(201).json({
      mensaje: `Pago de Bs ${monto} registrado con éxito. Suscripción activada hasta ${String(nuevaFechaVencimiento).slice(0, 10)}.`,
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (req.file) fs.unlink(req.file.path, () => {});
    next(e);
  } finally {
    client.release();
  }
});

// Estado de MODO DEMO para el panel de administración
router.get('/config/demo-mode', (_req, res) => {
  res.json({ demo_mode: process.env.DEMO_MODE === 'true' });
});

// Endpoint exclusivo si DEMO_MODE=true
if (process.env.DEMO_MODE === 'true') {
  router.post('/pagos/simular-demo', async (req, res, next) => {
    const client = await pool.connect();
    try {
      const id_empresa = parseInt(req.body.id_empresa, 10);
      if (!Number.isInteger(id_empresa)) {
        return res.status(400).json({ error: 'Identificador de empresa no válido' });
      }
      await client.query('BEGIN');
      const empRes = await client.query('SELECT razon_social, slug FROM empresa WHERE id_empresa = $1', [id_empresa]);
      if (!empRes.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Empresa no encontrada' });
      }
      await client.query(
        `INSERT INTO pago (id_empresa, monto, metodo, referencia, banco, comprobante, estado, observacion, meses, confirmado_por, fecha_confirmacion, fecha, es_demo)
         VALUES ($1, 200, 'qr', 'DEMO-SIMULADO', 'Banco Demo', 'demo.png', 'confirmado', 'Simulación en MODO DEMO', 1, $2, NOW(), NOW(), TRUE)`,
        [id_empresa, req.user.id_usuario]
      );
      await client.query(
        `UPDATE suscripcion
            SET estado = 'activa',
                fecha_inicio = (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date,
                fecha_vencimiento = (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date + INTERVAL '30 days'
          WHERE id_empresa = $1`,
        [id_empresa]
      );
      await client.query('COMMIT');
      res.json({ mensaje: 'MODO DEMO: Pago simulado y suscripción activada por 30 días.' });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      next(e);
    } finally {
      client.release();
    }
  });
}

// CU9 (PARTE 2): gestionar suscripción manualmente con auditoría y correo
router.put('/empresas/:id/suscripcion', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    const { estado, fecha_vencimiento, motivo } = req.body;

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Identificador de empresa no válido' });
    }
    if (!['pendiente_pago', 'activa', 'vencida', 'suspendida'].includes(estado)) {
      return res.status(400).json({ error: 'Estado de suscripción no válido' });
    }
    if (estado === 'activa' && fecha_vencimiento && isNaN(Date.parse(fecha_vencimiento))) {
      return res.status(400).json({ error: 'Fecha de vencimiento no válida' });
    }
    if (estado === 'suspendida' && (!motivo || String(motivo).trim().length < 5)) {
      return res.status(400).json({ error: 'Debe especificar el motivo de la suspensión (mínimo 5 caracteres)' });
    }

    await client.query('BEGIN');

    // Obtener datos de empresa
    const empRes = await client.query(
      `SELECT e.id_empresa, e.razon_social, COALESCE(e.correo, u.correo) AS correo,
              s.estado AS estado_actual, s.fecha_vencimiento AS vencimiento_actual
         FROM empresa e
         JOIN usuario u ON u.id_usuario = e.id_usuario
         LEFT JOIN suscripcion s ON s.id_empresa = e.id_empresa
        WHERE e.id_empresa = $1 AND e.eliminado_en IS NULL`,
      [id]
    );
    if (!empRes.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }
    const emp = empRes.rows[0];

    // Calcular fecha de vencimiento para activación
    let nuevaFechaVenc = null;
    if (estado === 'activa') {
      if (fecha_vencimiento) {
        nuevaFechaVenc = fecha_vencimiento;
      } else {
        // Por defecto 30 días desde hoy
        const d = new Date();
        d.setDate(d.getDate() + 30);
        nuevaFechaVenc = d.toISOString().slice(0, 10);
      }
    }

    // Actualizar suscripción
    const r = await client.query(
      `UPDATE suscripcion
          SET estado = $1,
              fecha_vencimiento = CASE WHEN $2::date IS NOT NULL THEN $2::date ELSE fecha_vencimiento END
        WHERE id_empresa = $3
        RETURNING estado, fecha_vencimiento`,
      [estado, nuevaFechaVenc || null, id]
    );
    if (!r.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Registro de suscripción no encontrado' });
    }
    const suscActualizada = r.rows[0];

    // Auditoría
    const motivoTexto = motivo ? String(motivo).trim() : 'Sin motivo especificado';
    await client.query(
      `INSERT INTO auditoria (id_usuario, accion, entidad, id_entidad, detalle)
       VALUES ($1, $2, 'suscripcion', $3, $4)`,
      [
        req.user.id_usuario,
        `suscripcion_${estado}`,
        id,
        `Suscripción de "${emp.razon_social}" marcada como ${estado}. Motivo: ${motivoTexto}${suscActualizada.fecha_vencimiento ? `. Vencimiento: ${String(suscActualizada.fecha_vencimiento).slice(0, 10)}` : ''}`,
      ]
    );

    await client.query('COMMIT');

    // Correo fuera de la transacción (no bloqueante)
    if (emp.correo) {
      if (estado === 'activa') {
        const plantilla = construirCorreoSuscripcionActivada({
          razonSocial: emp.razon_social,
          fechaVencimiento: suscActualizada.fecha_vencimiento,
          motivo: motivoTexto,
        });
        enviarCorreo({
          id_empresa: id,
          tipo: 'suscripcion_activada',
          para: emp.correo,
          asunto: plantilla.asunto,
          html: plantilla.html,
          texto: plantilla.texto,
        }).catch((err) => console.error('[CORREO] Error enviando correo suscripción activada:', err.message));
      } else if (estado === 'suspendida') {
        const plantilla = construirCorreoSuscripcionSuspendida({
          razonSocial: emp.razon_social,
          motivo: motivoTexto,
        });
        enviarCorreo({
          id_empresa: id,
          tipo: 'suscripcion_suspendida',
          para: emp.correo,
          asunto: plantilla.asunto,
          html: plantilla.html,
          texto: plantilla.texto,
        }).catch((err) => console.error('[CORREO] Error enviando correo suscripción suspendida:', err.message));
      }
    }

    res.json({
      mensaje: `Suscripción de "${emp.razon_social}" cambiada a ${estado} con éxito.`,
      suscripcion: suscActualizada.estado,
      fecha_vencimiento: suscActualizada.fecha_vencimiento,
      correo_destino: emp.correo,
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});


// Categorías y solicitudes de nuevas categorías (Parte 3)
router.get('/categorias', async (_req, res, next) => {
  try {
    const cats = await pool.query(
      `SELECT c.id_categoria, c.nombre, (SELECT COUNT(*)::int FROM producto p WHERE p.id_categoria = c.id_categoria) AS productos
         FROM categoria c ORDER BY c.nombre`
    );
    const sol = await pool.query(
      `SELECT s.id_solicitud, s.id_empresa, s.nombre, s.estado, s.motivo_rechazo, s.fecha_revision, e.razon_social, s.creado_en
         FROM solicitud_categoria s
         JOIN empresa e ON e.id_empresa = s.id_empresa
        ORDER BY s.id_solicitud DESC`
    );
    res.json({ categorias: cats.rows, solicitudes: sol.rows });
  } catch (e) {
    next(e);
  }
});

router.post('/categorias', async (req, res, next) => {
  try {
    const nombre = capitalizar(req.body.nombre);
    if (nombre.length < 3 || nombre.length > 80) return res.status(400).json({ error: 'Nombre de categoría no válido' });
    await pool.query('INSERT INTO categoria (nombre) VALUES ($1)', [nombre]);
    if (req.body.id_solicitud) {
      await pool.query(
        `UPDATE solicitud_categoria
            SET estado = 'aprobada', revisado_por = $1, fecha_revision = NOW()
          WHERE id_solicitud = $2`,
        [req.user.id_usuario, parseInt(req.body.id_solicitud, 10)]
      );
    }
    res.status(201).json({ mensaje: 'Categoría creada con éxito.' });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Esa categoría ya existe' });
    next(e);
  }
});

// PARTE 3: Editar nombre de categoría
router.put('/categorias/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const nombre = capitalizar(req.body.nombre);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador no válido' });
    if (nombre.length < 3 || nombre.length > 80) return res.status(400).json({ error: 'Nombre de categoría debe tener entre 3 y 80 caracteres' });

    const r = await pool.query('UPDATE categoria SET nombre = $1 WHERE id_categoria = $2', [nombre, id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ mensaje: 'Categoría actualizada con éxito.' });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
    next(e);
  }
});

// PARTE 3: Eliminar categoría (con reasignación si tiene productos asociados)
router.delete('/categorias/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    const nuevaCatId = req.body.nueva_categoria_id ? parseInt(req.body.nueva_categoria_id, 10) : null;

    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador no válido' });

    await client.query('BEGIN');
    const { rows: prods } = await client.query('SELECT COUNT(*)::int AS total FROM producto WHERE id_categoria = $1', [id]);
    const total = prods[0]?.total || 0;

    if (total > 0 && !nuevaCatId) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Esta categoría tiene ${total} producto(s) asignado(s). Debe reasignarlos a otra categoría antes de eliminarla.`,
        totalProductos: total,
        requiereReasignacion: true,
      });
    }

    if (total > 0 && nuevaCatId) {
      if (nuevaCatId === id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No puede reasignar los productos a la misma categoría que desea eliminar.' });
      }
      const { rowCount: existeNueva } = await client.query('SELECT 1 FROM categoria WHERE id_categoria = $1', [nuevaCatId]);
      if (!existeNueva) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'La categoría destino para reasignar no existe.' });
      }
      await client.query('UPDATE producto SET id_categoria = $1 WHERE id_categoria = $2', [nuevaCatId, id]);
    }

    const del = await client.query('DELETE FROM categoria WHERE id_categoria = $1', [id]);
    if (!del.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    await client.query('COMMIT');
    res.json({ mensaje: `Categoría eliminada con éxito${total > 0 ? ` y ${total} producto(s) reasignado(s).` : '.'}` });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

// PARTE 3: Aprobar sugerencia de categoría
router.post('/solicitudes-categoria/:id/aprobar', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    const nombreAjustado = req.body.nombre ? capitalizar(req.body.nombre) : null;

    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador no válido' });

    await client.query('BEGIN');
    const { rows: sols } = await client.query(
      `SELECT s.id_solicitud, s.id_empresa, s.nombre, e.razon_social, u.correo
         FROM solicitud_categoria s
         JOIN empresa e ON e.id_empresa = s.id_empresa
         JOIN usuario u ON u.id_usuario = e.id_usuario
        WHERE s.id_solicitud = $1`,
      [id]
    );

    if (!sols.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    const sol = sols[0];
    const catNombre = nombreAjustado || capitalizar(sol.nombre);

    // Crear la categoría (o reusar si ya existe)
    await client.query('INSERT INTO categoria (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING', [catNombre]);

    // Marcar solicitud como aprobada
    await client.query(
      `UPDATE solicitud_categoria
          SET estado = 'aprobada',
              revisado_por = $1,
              fecha_revision = NOW()
        WHERE id_solicitud = $2`,
      [req.user.id_usuario, id]
    );

    await client.query('COMMIT');

    // Notificar por correo a la empresa
    try {
      const emailData = construirCorreoCategoriaAprobada({
        razonSocial: sol.razon_social,
        categoriaNombre: catNombre,
      });
      enviarCorreo({
        id_empresa: sol.id_empresa,
        tipo: 'categoria_aprobada',
        para: sol.correo,
        asunto: `Categoría "${catNombre}" aprobada en UNIMARKET BO`,
        html: emailData.html,
        texto: emailData.texto,
      }).catch((err) => console.error('Error enviando correo de categoría aprobada:', err.message));
    } catch (errMail) {
      console.error('Error preparando plantilla de categoría aprobada:', errMail.message);
    }

    res.json({ mensaje: `Categoría "${catNombre}" aprobada e incorporada.` });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

// PARTE 3: Rechazar sugerencia de categoría
router.post('/solicitudes-categoria/:id/rechazar', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const motivo = limpiar(req.body.motivo);

    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador no válido' });

    const r = await pool.query(
      `UPDATE solicitud_categoria
          SET estado = 'rechazada',
              motivo_rechazo = $1,
              revisado_por = $2,
              fecha_revision = NOW()
        WHERE id_solicitud = $3`,
      [motivo || 'No se ajusta a las categorías estándar de la plataforma', req.user.id_usuario, id]
    );

    if (!r.rowCount) return res.status(404).json({ error: 'Solicitud no encontrada' });
    res.json({ mensaje: 'Solicitud de categoría rechazada.' });
  } catch (e) {
    next(e);
  }
});

router.delete('/solicitudes-categoria/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM solicitud_categoria WHERE id_solicitud = $1', [parseInt(req.params.id, 10)]);
    res.json({ mensaje: 'Solicitud eliminada' });
  } catch (e) {
    next(e);
  }
});

/* ==========================================================================
   GESTIÓN DE MARCAS Y CONTROL DE MARCAS PROHIBIDAS (ADMIN)
   ========================================================================== */

router.get('/marcas', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `WITH prods AS (
         SELECT TRIM(p.marca) AS marca,
                COUNT(*)::int AS total_productos,
                COUNT(DISTINCT p.id_empresa)::int AS total_empresas,
                json_agg(DISTINCT jsonb_build_object('id_empresa', e.id_empresa, 'razon_social', e.razon_social)) AS empresas
           FROM producto p
           JOIN empresa e ON e.id_empresa = p.id_empresa
          WHERE p.marca IS NOT NULL AND TRIM(p.marca) != ''
          GROUP BY TRIM(p.marca)
       )
       SELECT COALESCE(p.marca, mp.nombre) AS marca,
              COALESCE(p.total_productos, 0)::int AS total_productos,
              COALESCE(p.total_empresas, 0)::int AS total_empresas,
              COALESCE(p.empresas, '[]'::json) AS empresas,
              (mp.id_marca_prohibida IS NOT NULL) AS prohibida,
              mp.motivo AS motivo_prohibicion,
              mp.creado_en AS fecha_prohibicion
         FROM prods p
         FULL OUTER JOIN marca_prohibida mp ON LOWER(TRIM(p.marca)) = LOWER(TRIM(mp.nombre))
        ORDER BY (mp.id_marca_prohibida IS NOT NULL) DESC, total_productos DESC, marca ASC`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/marcas/prohibir', async (req, res, next) => {
  try {
    const marca = String(req.body.marca || '').trim();
    const motivo = String(req.body.motivo || '').trim();
    if (!marca) return res.status(400).json({ error: 'El nombre de la marca es obligatorio' });

    await pool.query(
      `INSERT INTO marca_prohibida (nombre, motivo)
       VALUES ($1, $2)
       ON CONFLICT (nombre) DO UPDATE SET motivo = EXCLUDED.motivo`,
      [marca, motivo || 'Marca no autorizada o restringida por políticas de la plataforma']
    );

    res.json({ ok: true, mensaje: `La marca "${marca}" ha sido prohibida en la plataforma.` });
  } catch (e) {
    next(e);
  }
});

router.delete('/marcas/prohibir/:nombre', async (req, res, next) => {
  try {
    const nombre = String(req.params.nombre || '').trim();
    if (!nombre) return res.status(400).json({ error: 'Nombre de marca no especificado' });

    await pool.query(
      'DELETE FROM marca_prohibida WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1))',
      [nombre]
    );

    res.json({ ok: true, mensaje: `La marca "${nombre}" ahora está permitida.` });
  } catch (e) {
    next(e);
  }
});

/* ==========================================================================
   BANDEJA DE REPORTES DE USUARIOS (CÍRCULO DE CONFIANZA)
   ========================================================================== */

router.get('/reportes', async (req, res, next) => {
  try {
    const { estado } = req.query;
    const where = [];
    const params = [];
    if (estado && estado !== 'todos') {
      params.push(estado);
      where.push(`r.estado = $${params.length}`);
    }

    const { rows } = await pool.query(
      `SELECT r.id_reporte, r.id_empresa, r.id_producto, r.motivos, r.descripcion,
              r.nombre_denunciante, r.contacto_denunciante, r.estado, r.notas_admin,
              r.creado_en, r.resuelto_en,
              e.razon_social AS empresa_nombre, e.slug AS empresa_slug, e.nit AS empresa_nit,
              e.telefono AS empresa_telefono, e.whatsapp AS empresa_whatsapp,
              e.estado_verificacion AS empresa_verificacion,
              s.estado AS suscripcion_estado,
              p.nombre AS producto_nombre, p.precio AS producto_precio
         FROM reporte r
         JOIN empresa e ON e.id_empresa = r.id_empresa
         LEFT JOIN suscripcion s ON s.id_empresa = e.id_empresa
         LEFT JOIN producto p ON p.id_producto = r.id_producto
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY r.creado_en DESC`,
      params
    );

    const { rows: statsRows } = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes,
         COUNT(*) FILTER (WHERE estado = 'en_revision')::int AS en_revision,
         COUNT(*) FILTER (WHERE estado = 'sancionado')::int AS sancionados,
         COUNT(*) FILTER (WHERE estado = 'resuelto')::int AS resueltos,
         COUNT(*) FILTER (WHERE estado = 'desestimado')::int AS desestimados
       FROM reporte`
    );

    res.json({ reportes: rows, stats: statsRows[0] || {} });
  } catch (e) {
    next(e);
  }
});

router.put('/reportes/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { estado, notas_admin } = req.body;
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID de reporte inválido' });

    const estadosValidos = ['pendiente', 'en_revision', 'sancionado', 'desestimado', 'resuelto'];
    if (estado && !estadosValidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado de reporte inválido' });
    }

    const esFinal = ['sancionado', 'desestimado', 'resuelto'].includes(estado);

    const r = await pool.query(
      `UPDATE reporte
          SET estado = COALESCE($1, estado),
              notas_admin = COALESCE($2, notas_admin),
              resuelto_en = ${esFinal ? 'NOW()' : 'NULL'}
        WHERE id_reporte = $3
        RETURNING *`,
      [estado || null, notas_admin !== undefined ? notas_admin : null, id]
    );

    if (!r.rowCount) return res.status(404).json({ error: 'Reporte no encontrado' });
    res.json({ ok: true, reporte: r.rows[0] });
  } catch (e) {
    next(e);
  }
});

router.post('/reportes/:id/suspender-empresa', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    const { motivo } = req.body;
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID de reporte inválido' });

    await client.query('BEGIN');

    const { rows: repRows } = await client.query(
      `SELECT r.id_reporte, r.id_empresa, e.razon_social, u.correo
         FROM reporte r
         JOIN empresa e ON e.id_empresa = r.id_empresa
         JOIN usuario u ON u.id_usuario = e.id_usuario
        WHERE r.id_reporte = $1`,
      [id]
    );

    if (!repRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    const rep = repRows[0];

    // Suspender suscripción de la empresa para desactivarla del catálogo y vista pública inmediatamente
    await client.query(
      `UPDATE suscripcion SET estado = 'suspendida' WHERE id_empresa = $1`,
      [rep.id_empresa]
    );

    const nota = motivo
      ? `Empresa suspendida por administración tras reporte. Motivo: ${motivo}`
      : 'Empresa suspendida por administración tras verificar denuncia de usuario.';

    await client.query(
      `UPDATE reporte
          SET estado = 'sancionado',
              notas_admin = $1,
              resuelto_en = NOW()
        WHERE id_reporte = $2`,
      [nota, id]
    );

    // Intentar enviar correo formal de suspensión
    try {
      const plantilla = construirCorreoSuscripcionSuspendida({
        razonSocial: rep.razon_social,
        motivo: motivo || 'Incumplimiento de políticas y reporte verificado de usuarios.',
        fechaSuspension: new Date().toISOString(),
        tipo: 'suscripcion_suspendida',
      });
      await enviarCorreo({
        destinatario: rep.correo,
        asunto: plantilla.asunto,
        html: plantilla.html,
        tipo: 'suscripcion_suspendida',
        idEmpresa: rep.id_empresa,
      });
    } catch (errEmail) {
      console.warn('Aviso: No se pudo enviar correo de suspensión:', errEmail.message);
    }

    await client.query('COMMIT');
    res.json({ ok: true, mensaje: `Empresa ${rep.razon_social} suspendida con éxito.` });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

module.exports = router;

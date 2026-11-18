const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const { autenticar, permitir, exigirVerificada } = require('../middleware/auth');
const {
  subirImagenes,
  subirDocumento,
  subirComprobante,
  subirPerfilEmpresa,
  erroresUpload,
  DIR_PROD,
  DIR_EMP,
  DIR_COMP,
} = require('../middleware/upload');
const {
  validarProducto,
  limpiar,
  capitalizar,
  normalizarTelefono,
  normalizarWhatsapp,
  esUrlValida,
  numeroALiteral,
} = require('../utils/normalizar');
const {
  enviarCorreo,
  construirCorreoStockBajo,
  construirCorreoComprobanteVenta,
  getMailConfig,
} = require('../utils/correo');
const { generarPdfVenta, generarPdfReporte } = require('../utils/pdf');
const crypto = require('crypto');

const router = express.Router();
const QR_PATH = path.join(__dirname, '..', '..', 'assets', 'qr-pago.png');

// Ruta pública: imagen QR del sistema (no contiene datos privados, es la misma para todos)
router.get('/qr-pago', (_req, res) => {
  if (!fs.existsSync(QR_PATH)) return res.status(404).json({ error: 'QR de pago no disponible' });
  res.type('image/png').sendFile(QR_PATH);
});

// Capa 4 y 5: todo lo de esta ruta exige rol empresa; el id_empresa SIEMPRE sale del token
router.use(autenticar, permitir('empresa'));

const borrarArchivos = (files = []) => files.forEach((f) => fs.unlink(f.path, () => {}));

// Perfil + estado de verificación (REQ03) + suscripción + datos del portal público
router.get('/perfil', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.id_empresa, e.razon_social, e.slug, e.nit, e.telefono, e.whatsapp,
              e.sitio_web, e.descripcion, e.logo, e.portada, e.direccion,
              e.facebook, e.instagram, e.tiktok, e.estado_verificacion,
              e.codigo_pago,
              u.correo,
              s.estado AS suscripcion, s.fecha_vencimiento,
              (SELECT observacion FROM verificacion v WHERE v.id_empresa = e.id_empresa ORDER BY id_verificacion DESC LIMIT 1) AS observacion
         FROM empresa e
         JOIN usuario u ON u.id_usuario = e.id_usuario
         LEFT JOIN suscripcion s ON s.id_empresa = e.id_empresa
        WHERE e.id_empresa = $1`,
      [req.user.id_empresa]
    );
    if (!rows.length) return res.status(404).json({ error: 'Empresa no encontrada' });

    const perfil = {
      ...rows[0],
      pago_info: {
        banco: process.env.PAGO_BANCO || 'Banco Unión S.A.',
        titular: process.env.PAGO_TITULAR || 'UNIMARKET BO',
        cuenta: process.env.PAGO_CUENTA || '10000034567890',
        tipo_cuenta: process.env.PAGO_TIPO_CUENTA || 'Caja de Ahorros en Bs',
        monto_mensual: Number(process.env.PAGO_MONTO) || 200,
        qr_disponible: fs.existsSync(QR_PATH),
      },
    };
    res.json(perfil);
  } catch (e) {
    next(e);
  }
});

// (La ruta /qr-pago fue movida antes del middleware de autenticación para acceso público)

// Historial de comprobantes de pago de la empresa
router.get('/pagos', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id_pago, monto, metodo, referencia, comprobante, estado, observacion, meses, fecha, fecha_confirmacion
         FROM pago WHERE id_empresa = $1 ORDER BY id_pago DESC`,
      [req.user.id_empresa]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Enviar nuevo comprobante de pago
router.post('/pagos', subirComprobante.single('comprobante'), erroresUpload, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Adjunte el comprobante de pago en formato JPG, PNG, WEBP o PDF' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Validar que no tenga ya un comprobante en revisión
      const { rows: enRev } = await client.query(
        `SELECT id_pago FROM pago WHERE id_empresa = $1 AND estado IN ('en_revision', 'pendiente')`,
        [req.user.id_empresa]
      );
      if (enRev.length > 0) {
        await client.query('ROLLBACK');
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({
          error: 'Ya tiene un comprobante en revisión. Espere a que el administrador confirme o revise su pago anterior.',
        });
      }

      const metodo = String(req.body.metodo || 'qr').trim().toLowerCase();
      const banco = req.body.banco ? String(req.body.banco).trim().slice(0, 100) : 'Depósito Bancario / QR';
      const fechaPago = req.body.fecha_pago ? String(req.body.fecha_pago).slice(0, 10) : new Date().toISOString().slice(0, 10);
      const monto = Number(req.body.monto) > 0 ? Math.round(Number(req.body.monto) * 100) / 100 : 200.00;
      const observacion = req.body.nota || req.body.observacion ? String(req.body.nota || req.body.observacion).trim().slice(0, 300) : null;

      // Si no se envía referencia manual, generar identificador único de comprobante
      const tieneRefManual = req.body.referencia && String(req.body.referencia).trim() && String(req.body.referencia).trim() !== 'N/A';
      const referencia = tieneRefManual
        ? String(req.body.referencia).trim().slice(0, 100)
        : `DEP-${Date.now().toString(36).toUpperCase()}`;

      // Validar duplicado únicamente si el usuario proveyó una referencia manual específica
      if (tieneRefManual) {
        const { rows: dup } = await client.query(
          `SELECT id_pago FROM pago WHERE id_empresa = $1 AND LOWER(referencia) = LOWER($2) AND LOWER(COALESCE(banco, '')) = LOWER($3) AND estado != 'rechazado'`,
          [req.user.id_empresa, referencia, banco]
        );
        if (dup.length > 0) {
          await client.query('ROLLBACK');
          if (req.file) fs.unlink(req.file.path, () => {});
          return res.status(400).json({ error: 'Ya registró un comprobante con este mismo número de referencia y banco' });
        }
      }

      // 3. Insertar pago en estado 'en_revision'
      await client.query(
        `INSERT INTO pago (id_empresa, monto, metodo, referencia, banco, fecha_pago, observacion, comprobante, estado, meses, fecha)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'en_revision', 1, NOW())`,
        [req.user.id_empresa, monto, metodo, referencia, banco, fechaPago, observacion, req.file.filename]
      );

      // 4. Actualizar estado de la suscripción a 'en_revision'
      await client.query(
        `UPDATE suscripcion SET estado = 'en_revision' WHERE id_empresa = $1`,
        [req.user.id_empresa]
      );

      // Obtener datos de la empresa para notificaciones por correo
      const { rows: empRows } = await client.query(
        `SELECT e.razon_social, e.codigo_pago, COALESCE(e.correo, u.correo) AS correo
           FROM empresa e
           JOIN usuario u ON u.id_usuario = e.id_usuario
          WHERE e.id_empresa = $1`,
        [req.user.id_empresa]
      );
      const empData = empRows[0] || {};

      await client.query('COMMIT');

      // 5. Notificar a la empresa de la recepción de su comprobante
      if (empData.correo) {
        enviarCorreo({
          id_empresa: req.user.id_empresa,
          tipo: 'comprobante_recibido',
          para: empData.correo,
          datos: {
            razonSocial: empData.razon_social,
            codigoPago: empData.codigo_pago || 'UM-0001',
            monto,
            referencia,
          },
        }).catch((err) => console.error('[CORREO] Error al enviar comprobante_recibido:', err.message));
      }

      // 6. Notificar de inmediato al administrador
      const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || 'unimarketbo@gmail.com';
      enviarCorreo({
        id_empresa: req.user.id_empresa,
        tipo: 'aviso_admin_comprobante',
        para: adminEmail,
        datos: {
          razonSocial: empData.razon_social,
          codigoPago: empData.codigo_pago || 'UM-0001',
          monto,
          referencia,
          banco,
        },
      }).catch((err) => console.error('[CORREO] Error al notificar al admin sobre nuevo comprobante:', err.message));

      res.status(201).json({
        mensaje: 'Comprobante recibido correctamente. Su pago está en revisión por la administración (revisión habitual dentro de 24 horas).',
      });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    if (req.file) fs.unlink(req.file.path, () => {});
    next(e);
  }
});

// Visualizar comprobante propio de pago
router.get('/pagos/:id/comprobante', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      'SELECT comprobante FROM pago WHERE id_pago = $1 AND id_empresa = $2',
      [id, req.user.id_empresa]
    );
    if (!rows.length || !rows[0].comprobante) return res.status(404).json({ error: 'Comprobante no encontrado' });
    const archivo = path.join(DIR_COMP, path.basename(rows[0].comprobante));
    if (!fs.existsSync(archivo)) return res.status(404).json({ error: 'El archivo ya no existe en el servidor' });
    const ext = path.extname(archivo).toLowerCase();
    const mime = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    res.type(mime).sendFile(archivo);
  } catch (e) {
    next(e);
  }
});


// Edición del perfil del portal público (multipart: datos y archivos logo/portada)
router.put('/perfil', subirPerfilEmpresa, erroresUpload, async (req, res, next) => {
  try {
    const errores = {};
    const descripcion = limpiar(req.body.descripcion) || null;
    const direccion = limpiar(req.body.direccion) || null;
    const tel = normalizarTelefono(req.body.telefono, 'teléfono', true);
    const wa = normalizarWhatsapp(req.body.whatsapp);
    const sitio = req.body.sitio_web ? String(req.body.sitio_web).trim() : null;
    const fb = req.body.facebook ? String(req.body.facebook).trim() : null;
    const ig = req.body.instagram ? String(req.body.instagram).trim() : null;
    const tk = req.body.tiktok ? String(req.body.tiktok).trim() : null;

    if (tel.error) errores.telefono = tel.error;
    if (wa.error) errores.whatsapp = wa.error;
    if (sitio && !esUrlValida(sitio)) errores.sitio_web = 'Ingrese una URL válida (ej. https://miempresa.com)';
    if (fb && !esUrlValida(fb)) errores.facebook = 'Ingrese una URL válida de Facebook (ej. https://facebook.com/...)';
    if (ig && !esUrlValida(ig)) errores.instagram = 'Ingrese una URL válida de Instagram (ej. https://instagram.com/...)';
    if (tk && !esUrlValida(tk)) errores.tiktok = 'Ingrese una URL válida de TikTok (ej. https://tiktok.com/@...)';

    if (Object.keys(errores).length) {
      if (req.files?.logo) fs.unlink(req.files.logo[0].path, () => {});
      if (req.files?.portada) fs.unlink(req.files.portada[0].path, () => {});
      return res.status(400).json({ error: 'Corrija los campos marcados', errores });
    }

    // Obtener logo y portada actuales para eliminar archivos antiguos si se reemplazan
    const { rows: act } = await pool.query('SELECT logo, portada FROM empresa WHERE id_empresa = $1', [req.user.id_empresa]);
    const actual = act[0] || {};

    const nuevoLogo = req.files?.logo ? req.files.logo[0].filename : null;
    const nuevaPortada = req.files?.portada ? req.files.portada[0].filename : null;

    await pool.query(
      `UPDATE empresa
          SET descripcion = $1,
              telefono = $2,
              whatsapp = $3,
              sitio_web = $4,
              direccion = $5,
              facebook = $6,
              instagram = $7,
              tiktok = $8,
              logo = COALESCE($9, logo),
              portada = COALESCE($10, portada)
        WHERE id_empresa = $11`,
      [descripcion, tel.valor, wa.valor, sitio, direccion, fb, ig, tk, nuevoLogo, nuevaPortada, req.user.id_empresa]
    );

    if (nuevoLogo && actual.logo) {
      fs.unlink(path.join(DIR_EMP, actual.logo), () => {});
    }
    if (nuevaPortada && actual.portada) {
      fs.unlink(path.join(DIR_EMP, actual.portada), () => {});
    }

    res.json({ mensaje: 'Perfil del portal público actualizado correctamente' });
  } catch (e) {
    if (req.files?.logo) fs.unlink(req.files.logo[0].path, () => {});
    if (req.files?.portada) fs.unlink(req.files.portada[0].path, () => {});
    next(e);
  }
});

// Reenviar documento cuando la verificación fue observada
router.post('/verificacion', subirDocumento.single('documento'), erroresUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Adjunte el documento de NIT en PDF' });
    const emp = await pool.query('SELECT estado_verificacion FROM empresa WHERE id_empresa = $1', [req.user.id_empresa]);
    if (emp.rows[0].estado_verificacion !== 'observado') {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Solo puede reenviar el documento si su verificación fue observada' });
    }
    await pool.query('INSERT INTO verificacion (id_empresa, documento) VALUES ($1,$2)', [req.user.id_empresa, req.file.filename]);
    await pool.query("UPDATE empresa SET estado_verificacion = 'pendiente' WHERE id_empresa = $1", [req.user.id_empresa]);
    res.status(201).json({ mensaje: 'Documento reenviado. Quedó pendiente de revisión.' });
  } catch (e) {
    next(e);
  }
});

router.get('/categorias', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id_categoria, nombre FROM categoria ORDER BY nombre');
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// CU5 flujo alterno / sugerencia de categoría
router.post(['/categorias/reportar', '/solicitud-categoria'], async (req, res, next) => {
  try {
    const nombre = capitalizar(req.body.nombre);
    if (!nombre || nombre.length < 3 || nombre.length > 80) {
      return res.status(400).json({ error: 'El nombre de la categoría debe tener entre 3 y 80 caracteres' });
    }

    // Verificar si la categoría ya existe oficialmente
    const { rows: yaExiste } = await pool.query(
      'SELECT id_categoria, nombre FROM categoria WHERE LOWER(nombre) = LOWER($1)',
      [nombre]
    );
    if (yaExiste.length) {
      return res.status(400).json({ error: `La categoría "${yaExiste[0].nombre}" ya existe en la plataforma` });
    }

    // Verificar si ya tiene una solicitud pendiente con el mismo nombre
    const { rows: yaPendiente } = await pool.query(
      `SELECT id_solicitud FROM solicitud_categoria WHERE id_empresa = $1 AND LOWER(nombre) = LOWER($2) AND estado = 'pendiente'`,
      [req.user.id_empresa, nombre]
    );
    if (yaPendiente.length) {
      return res.status(400).json({ error: 'Ya tiene una solicitud pendiente para esta categoría' });
    }

    await pool.query(
      'INSERT INTO solicitud_categoria (id_empresa, nombre) VALUES ($1, $2)',
      [req.user.id_empresa, nombre]
    );
    res.status(201).json({ mensaje: 'Sugerencia de categoría enviada al administrador para su revisión' });
  } catch (e) {
    next(e);
  }
});

// A partir de aquí: solo empresas verificadas (CU4)
router.use(exigirVerificada);

// -------------------------------------------------------------
// PRODUCTOS Y CATÁLOGO PROPIO
// -------------------------------------------------------------
router.get('/productos', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id_producto, p.nombre, p.marca, p.modelo, p.descripcion, p.precio, p.disponible,
              p.id_categoria, c.nombre AS categoria,
              p.sku, p.numero_serie, p.stock_actual, p.stock_minimo, p.unidad, p.alerta_stock_enviada,
              COALESCE(json_agg(json_build_object('id_imagen', i.id_imagen, 'ruta', i.ruta) ORDER BY i.id_imagen)
                       FILTER (WHERE i.id_imagen IS NOT NULL), '[]') AS imagenes
         FROM producto p
         JOIN categoria c ON c.id_categoria = p.id_categoria
         LEFT JOIN imagen_producto i ON i.id_producto = p.id_producto
        WHERE p.id_empresa = $1
        GROUP BY p.id_producto, c.nombre
        ORDER BY p.id_producto DESC`,
      [req.user.id_empresa]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/productos', subirImagenes.array('imagenes', 4), erroresUpload, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { errores, datos } = validarProducto(req.body);
    if (Object.keys(errores).length) {
      borrarArchivos(req.files);
      return res.status(400).json({ error: Object.values(errores)[0], errores });
    }

    if (datos.marca) {
      const { rows: banRows } = await pool.query(
        'SELECT nombre, motivo FROM marca_prohibida WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1))',
        [datos.marca]
      );
      if (banRows.length > 0) {
        borrarArchivos(req.files);
        const ban = banRows[0];
        return res.status(400).json({
          error: `La marca "${datos.marca}" está prohibida en la plataforma por la administración${ban.motivo ? ` (Motivo: ${ban.motivo})` : ''}.`,
          errores: { marca: `Marca prohibida${ban.motivo ? `: ${ban.motivo}` : ''}` },
        });
      }
    }

    await client.query('BEGIN');

    // Generar SKU automático si no fue provisto
    let skuFinal = datos.sku;
    if (!skuFinal) {
      const { rows: countRows } = await client.query(
        'SELECT COUNT(*) AS total FROM producto WHERE id_empresa = $1',
        [req.user.id_empresa]
      );
      const correlativoProd = parseInt(countRows[0].total, 10) + 1;
      skuFinal = `PROD-${String(correlativoProd).padStart(4, '0')}`;
    }

    const p = await client.query(
      `INSERT INTO producto (id_empresa, id_categoria, nombre, marca, modelo, descripcion, precio, disponible,
                             sku, numero_serie, stock_actual, stock_minimo, unidad)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id_producto`,
      [
        req.user.id_empresa,
        datos.id_categoria,
        datos.nombre,
        datos.marca,
        datos.modelo,
        datos.descripcion,
        datos.precio,
        datos.disponible,
        skuFinal,
        datos.numero_serie,
        datos.stock_actual,
        datos.stock_minimo,
        datos.unidad,
      ]
    );

    const idProducto = p.rows[0].id_producto;

    // Registrar imágenes
    for (const f of req.files || []) {
      await client.query('INSERT INTO imagen_producto (id_producto, ruta) VALUES ($1,$2)', [idProducto, f.filename]);
    }

    // Registrar movimiento de stock inicial si stock > 0
    if (datos.stock_actual > 0) {
      await client.query(
        `INSERT INTO movimiento_stock (id_producto, id_empresa, tipo, cantidad, stock_anterior, stock_posterior, motivo, registrado_por)
         VALUES ($1, $2, 'entrada', $3, 0, $3, 'Stock inicial de registro', 'empresa')`,
        [idProducto, req.user.id_empresa, datos.stock_actual]
      );
    }

    // Verificar si el stock inicial ya está bajo o en alerta
    let alertaEnviada = false;
    if (datos.stock_actual <= datos.stock_minimo) {
      alertaEnviada = true;
      await client.query('UPDATE producto SET alerta_stock_enviada = TRUE WHERE id_producto = $1', [idProducto]);
    }

    await client.query('COMMIT');

    // Disparar correo de alerta de forma asíncrona si amerita
    if (alertaEnviada) {
      (async () => {
        try {
          const emp = await pool.query(
            `SELECT e.razon_social, u.correo FROM empresa e JOIN usuario u ON u.id_usuario = e.id_usuario WHERE e.id_empresa = $1`,
            [req.user.id_empresa]
          );
          if (emp.rows.length) {
            const { html, texto } = construirCorreoStockBajo({
              razonSocial: emp.rows[0].razon_social,
              productos: [
                {
                  nombre: datos.nombre,
                  sku: skuFinal,
                  stock_actual: datos.stock_actual,
                  stock_minimo: datos.stock_minimo,
                  unidad: datos.unidad,
                },
              ],
            });
            await enviarCorreo({
              id_empresa: req.user.id_empresa,
              tipo: 'stock_bajo',
              para: emp.rows[0].correo,
              asunto: 'Alerta de stock bajo en UNIMARKET BO',
              html,
              texto,
            });
          }
        } catch (err) {
          console.error('[ALERTA_STOCK] Error enviando correo de stock bajo:', err.message);
        }
      })();
    }

    res.status(201).json({ id_producto: idProducto, sku: skuFinal, mensaje: 'Producto creado correctamente' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    borrarArchivos(req.files);
    if (e.code === '23505') {
      return res.status(409).json({ error: 'El código SKU ya está en uso en otro de sus productos', campo: 'sku' });
    }
    if (e.code === '23503') return res.status(400).json({ error: 'La categoría seleccionada no existe' });
    next(e);
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// COLORES POR PRODUCTO (opcionales) — deben ir ANTES de PUT /:id
// para que Express no confunda '/colores' con el parámetro :id
// -------------------------------------------------------------
router.get('/productos/:id/colores', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const check = await pool.query(
      'SELECT 1 FROM producto WHERE id_producto = $1 AND id_empresa = $2',
      [id, req.user.id_empresa]
    );
    if (!check.rowCount) return res.status(404).json({ error: 'Producto no encontrado' });
    const { rows } = await pool.query(
      'SELECT id, nombre, codigo_hex, activo FROM producto_color WHERE id_producto = $1 ORDER BY id ASC',
      [id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.put('/productos/:id/colores', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    const check = await client.query(
      'SELECT 1 FROM producto WHERE id_producto = $1 AND id_empresa = $2',
      [id, req.user.id_empresa]
    );
    if (!check.rowCount) return res.status(404).json({ error: 'Producto no encontrado' });

    const colores = Array.isArray(req.body.colores) ? req.body.colores : [];
    for (const c of colores) {
      if (!c.nombre || String(c.nombre).trim().length < 1)
        return res.status(400).json({ error: 'Cada color debe tener un nombre' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM producto_color WHERE id_producto = $1', [id]);
    const listaInsertados = [];
    for (const c of colores) {
      const resIns = await client.query(
        `INSERT INTO producto_color (id_producto, id_empresa, nombre, codigo_hex, activo)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id, nombre, codigo_hex, activo`,
        [id, req.user.id_empresa, String(c.nombre).trim().slice(0, 60), c.codigo_hex ? String(c.codigo_hex).trim().slice(0, 10) : null]
      );
      if (resIns.rows[0]) listaInsertados.push(resIns.rows[0]);
    }
    await client.query(
      `UPDATE producto SET colores_disponibles = $1::jsonb WHERE id_producto = $2`,
      [JSON.stringify(listaInsertados), id]
    );
    await client.query('COMMIT');
    const { rows } = await client.query(
      'SELECT id, nombre, codigo_hex, activo FROM producto_color WHERE id_producto = $1 ORDER BY id ASC',
      [id]
    );
    res.json({ ok: true, colores: rows });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
});

router.put('/productos/:id', subirImagenes.array('imagenes', 4), erroresUpload, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    const { errores, datos } = validarProducto(req.body);
    if (Object.keys(errores).length) {
      borrarArchivos(req.files);
      return res.status(400).json({ error: Object.values(errores)[0], errores });
    }

    if (datos.marca) {
      const { rows: banRows } = await pool.query(
        'SELECT nombre, motivo FROM marca_prohibida WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1))',
        [datos.marca]
      );
      if (banRows.length > 0) {
        borrarArchivos(req.files);
        const ban = banRows[0];
        return res.status(400).json({
          error: `La marca "${datos.marca}" está prohibida en la plataforma por la administración${ban.motivo ? ` (Motivo: ${ban.motivo})` : ''}.`,
          errores: { marca: `Marca prohibida${ban.motivo ? `: ${ban.motivo}` : ''}` },
        });
      }
    }

    await client.query('BEGIN');

    const actual = await client.query(
      `SELECT stock_actual, stock_minimo, sku, alerta_stock_enviada FROM producto WHERE id_producto = $1 AND id_empresa = $2`,
      [id, req.user.id_empresa]
    );
    if (!actual.rowCount) {
      await client.query('ROLLBACK');
      borrarArchivos(req.files);
      return res.status(404).json({ error: 'Producto no encontrado o no le pertenece' });
    }

    const prodActual = actual.rows[0];
    const skuFinal = datos.sku || prodActual.sku;

    // Si hubo ajuste directo de stock en el formulario de edición
    let nuevoStock = prodActual.stock_actual;
    if (datos.stock_actual !== undefined && datos.stock_actual !== prodActual.stock_actual) {
      nuevoStock = datos.stock_actual;
      const diferencia = nuevoStock - prodActual.stock_actual;
      await client.query(
        `INSERT INTO movimiento_stock (id_producto, id_empresa, tipo, cantidad, stock_anterior, stock_posterior, motivo, registrado_por)
         VALUES ($1, $2, 'ajuste', $3, $4, $5, 'Ajuste directo en edición de producto', 'empresa')`,
        [id, req.user.id_empresa, Math.abs(diferencia), prodActual.stock_actual, nuevoStock]
      );
    }

    // Regla de alerta
    let debeAlertar = false;
    let nuevaAlertaEnviada = prodActual.alerta_stock_enviada;
    if (nuevoStock <= datos.stock_minimo && !prodActual.alerta_stock_enviada) {
      debeAlertar = true;
      nuevaAlertaEnviada = true;
    } else if (nuevoStock > datos.stock_minimo) {
      nuevaAlertaEnviada = false;
    }

    const disponibleFinal = nuevoStock === 0 ? false : datos.disponible;

    await client.query(
      `UPDATE producto
          SET nombre = $1, marca = $2, modelo = $3, descripcion = $4, precio = $5,
              id_categoria = $6, disponible = $7, sku = $8, numero_serie = $9,
              stock_actual = $10, stock_minimo = $11, unidad = $12, alerta_stock_enviada = $13
        WHERE id_producto = $14 AND id_empresa = $15`,
      [
        datos.nombre,
        datos.marca,
        datos.modelo,
        datos.descripcion,
        datos.precio,
        datos.id_categoria,
        disponibleFinal,
        skuFinal,
        datos.numero_serie,
        nuevoStock,
        datos.stock_minimo,
        datos.unidad,
        nuevaAlertaEnviada,
        id,
        req.user.id_empresa,
      ]
    );

    // Eliminar imágenes marcadas
    const quitar = [].concat(req.body.quitar_imagenes || []).map((n) => parseInt(n, 10)).filter(Number.isInteger);
    if (quitar.length) {
      const del = await client.query(
        'DELETE FROM imagen_producto WHERE id_producto=$1 AND id_imagen = ANY($2::int[]) RETURNING ruta',
        [id, quitar]
      );
      del.rows.forEach((x) => fs.unlink(path.join(DIR_PROD, x.ruta), () => {}));
    }

    // Agregar nuevas imágenes
    for (const f of req.files || []) {
      await client.query('INSERT INTO imagen_producto (id_producto, ruta) VALUES ($1,$2)', [id, f.filename]);
    }

    await client.query('COMMIT');

    if (debeAlertar) {
      (async () => {
        try {
          const emp = await pool.query(
            `SELECT e.razon_social, u.correo FROM empresa e JOIN usuario u ON u.id_usuario = e.id_usuario WHERE e.id_empresa = $1`,
            [req.user.id_empresa]
          );
          if (emp.rows.length) {
            const { html, texto } = construirCorreoStockBajo({
              razonSocial: emp.rows[0].razon_social,
              productos: [
                {
                  nombre: datos.nombre,
                  sku: skuFinal,
                  stock_actual: nuevoStock,
                  stock_minimo: datos.stock_minimo,
                  unidad: datos.unidad,
                },
              ],
            });
            await enviarCorreo({
              id_empresa: req.user.id_empresa,
              tipo: 'stock_bajo',
              para: emp.rows[0].correo,
              asunto: 'Alerta de stock bajo en UNIMARKET BO',
              html,
              texto,
            });
          }
        } catch (err) {
          console.error('[ALERTA_STOCK] Error enviando correo:', err.message);
        }
      })();
    }

    res.json({ mensaje: 'Producto actualizado correctamente' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    borrarArchivos(req.files);
    if (e.code === '23505') {
      return res.status(409).json({ error: 'El código SKU ya está en uso en otro producto', campo: 'sku' });
    }
    next(e);
  } finally {
    client.release();
  }
});

router.delete('/productos/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const imgs = await pool.query(
      `SELECT i.ruta FROM imagen_producto i JOIN producto p ON p.id_producto = i.id_producto
        WHERE p.id_producto=$1 AND p.id_empresa=$2`,
      [id, req.user.id_empresa]
    );

    // Intentar borrar (si tiene ventas asociadas, PG lanzará 23503 por ON DELETE RESTRICT)
    const r = await pool.query('DELETE FROM producto WHERE id_producto=$1 AND id_empresa=$2', [id, req.user.id_empresa]);
    if (!r.rowCount) return res.status(404).json({ error: 'Producto no encontrado o no le pertenece' });
    imgs.rows.forEach((x) => fs.unlink(path.join(DIR_PROD, x.ruta), () => {}));
    res.json({ mensaje: 'Producto eliminado' });
  } catch (e) {
    if (e.code === '23503') {
      return res.status(400).json({
        error: 'No se puede eliminar este producto porque ya tiene ventas o movimientos registrados. Puede cambiar su stock a 0 o marcarlo como no disponible.',
      });
    }
    next(e);
  }
});


// -------------------------------------------------------------
// CONTROL DE INVENTARIO Y STOCK (PARTE 4)
// -------------------------------------------------------------
router.get('/inventario', async (req, res, next) => {

  try {
    const { rows: productos } = await pool.query(
      `SELECT p.id_producto, p.nombre, p.marca, p.modelo, p.sku, p.numero_serie,
              p.stock_actual, p.stock_minimo, p.unidad, p.precio, p.disponible,
              p.alerta_stock_enviada, c.nombre AS categoria,
              (SELECT ruta FROM imagen_producto ip WHERE ip.id_producto = p.id_producto ORDER BY id_imagen ASC LIMIT 1) AS imagen
         FROM producto p
         JOIN categoria c ON c.id_categoria = p.id_categoria
        WHERE p.id_empresa = $1
        ORDER BY
          CASE WHEN p.stock_actual = 0 THEN 0 WHEN p.stock_actual <= p.stock_minimo THEN 1 ELSE 2 END ASC,
          p.stock_actual ASC,
          p.nombre ASC`,
      [req.user.id_empresa]
    );

    // KPIs consolidados de inventario
    const totalProductos = productos.length;
    let totalUnidades = 0;
    let stockBajoCount = 0;
    let agotadosCount = 0;
    let valorInventario = 0;

    productos.forEach((p) => {
      const stock = parseInt(p.stock_actual, 10) || 0;
      const min = parseInt(p.stock_minimo, 10) || 0;
      const precio = parseFloat(p.precio) || 0;

      totalUnidades += stock;
      valorInventario += stock * precio;
      if (stock === 0) {
        agotadosCount++;
      } else if (stock <= min) {
        stockBajoCount++;
      }
    });

    res.json({
      productos,
      kpis: {
        total_productos: totalProductos,
        total_unidades: totalUnidades,
        stock_bajo_count: stockBajoCount,
        agotados_count: agotadosCount,
        valor_inventario: Math.round(valorInventario * 100) / 100,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.post('/inventario/ajuste', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const idProducto = parseInt(req.body.id_producto, 10);
    const tipo = String(req.body.tipo || '').trim().toLowerCase();
    const cantidad = parseInt(req.body.cantidad, 10);
    const motivo = req.body.motivo ? String(req.body.motivo).trim().slice(0, 200) : 'Ajuste manual de inventario';

    if (!Number.isInteger(idProducto)) return res.status(400).json({ error: 'Producto no válido' });
    if (!['entrada', 'salida', 'ajuste'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de ajuste no válido (debe ser entrada, salida o ajuste)' });
    }
    if (!Number.isInteger(cantidad) || cantidad < 0) {
      return res.status(400).json({ error: 'La cantidad debe ser un número entero mayor o igual a 0' });
    }
    if (['entrada', 'salida'].includes(tipo) && cantidad <= 0) {
      return res.status(400).json({ error: 'Para entrada o salida, la cantidad debe ser mayor a 0' });
    }

    await client.query('BEGIN');

    const { rows: prodRows } = await client.query(
      `SELECT stock_actual, stock_minimo, alerta_stock_enviada, nombre, sku, unidad
         FROM producto
        WHERE id_producto = $1 AND id_empresa = $2
        FOR UPDATE`,
      [idProducto, req.user.id_empresa]
    );

    if (!prodRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Producto no encontrado o no le pertenece' });
    }

    const prod = prodRows[0];
    const anterior = prod.stock_actual;
    let posterior = 0;
    let cantidadMovimiento = cantidad;

    if (tipo === 'entrada') {
      posterior = anterior + cantidad;
    } else if (tipo === 'salida') {
      if (anterior < cantidad) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Stock insuficiente. El stock actual es ${anterior} ${prod.unidad} y no se pueden descontar ${cantidad}.`,
        });
      }
      posterior = anterior - cantidad;
    } else if (tipo === 'ajuste') {
      posterior = cantidad;
      cantidadMovimiento = Math.abs(posterior - anterior);
    }

    // Regla de disponibilidad automática si stock = 0
    const disponible = posterior > 0;

    let debeAlertar = false;
    let alertaEnviada = prod.alerta_stock_enviada;
    if (posterior <= prod.stock_minimo && !prod.alerta_stock_enviada) {
      debeAlertar = true;
      alertaEnviada = true;
    } else if (posterior > prod.stock_minimo) {
      alertaEnviada = false;
    }

    await client.query(
      `UPDATE producto
          SET stock_actual = $1, disponible = $2, alerta_stock_enviada = $3
        WHERE id_producto = $4`,
      [posterior, disponible, alertaEnviada, idProducto]
    );

    const tipoDb = tipo === 'entrada' ? 'entrada' : 'ajuste';
    await client.query(
      `INSERT INTO movimiento_stock (id_producto, id_empresa, tipo, cantidad, stock_anterior, stock_resultante, referencia, nota, id_usuario)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [idProducto, req.user.id_empresa, tipoDb, cantidadMovimiento, anterior, posterior, 'Ajuste manual', motivo, req.user.id_usuario || null]
    );

    await client.query('COMMIT');

    if (debeAlertar) {
      (async () => {
        try {
          const emp = await pool.query(
            `SELECT e.razon_social, u.correo FROM empresa e JOIN usuario u ON u.id_usuario = e.id_usuario WHERE e.id_empresa = $1`,
            [req.user.id_empresa]
          );
          if (emp.rows.length) {
            const { html, texto } = construirCorreoStockBajo({
              razonSocial: emp.rows[0].razon_social,
              productos: [
                {
                  nombre: prod.nombre,
                  sku: prod.sku,
                  stock_actual: posterior,
                  stock_minimo: prod.stock_minimo,
                  unidad: prod.unidad,
                },
              ],
            });
            await enviarCorreo({
              id_empresa: req.user.id_empresa,
              tipo: 'stock_bajo',
              para: emp.rows[0].correo,
              asunto: 'Alerta de stock bajo en UNIMARKET BO',
              html,
              texto,
            });
          }
        } catch (err) {
          console.error('[ALERTA_STOCK] Error enviando correo:', err.message);
        }
      })();
    }

    res.json({
      mensaje: 'Stock actualizado correctamente',
      stock_anterior: anterior,
      stock_actual: posterior,
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

router.get('/inventario/:id/movimientos', async (req, res, next) => {
  try {
    const idProducto = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `SELECT m.id_movimiento, m.tipo, m.cantidad, m.stock_anterior, m.stock_resultante AS stock_posterior,
              m.nota AS motivo, m.referencia, m.fecha, u.nombre AS registrado_por, u.usuario
         FROM movimiento_stock m
         LEFT JOIN usuario u ON u.id_usuario = m.id_usuario
        WHERE m.id_producto = $1 AND m.id_empresa = $2
        ORDER BY m.id_movimiento DESC
        LIMIT 100`,
      [idProducto, req.user.id_empresa]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------
// CLIENTES (DIRECTORIO PARA FACTURACIÓN / VENTAS)
// -------------------------------------------------------------
router.get('/clientes', async (req, res, next) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : '';
    let query = `SELECT id_cliente, nombre, nit_ci, nit_ci AS nit, telefono, correo, direccion, creado_en FROM cliente WHERE id_empresa = $1`;
    const params = [req.user.id_empresa];

    if (q) {
      query += ` AND (nombre ILIKE $2 OR nit_ci ILIKE $2 OR telefono ILIKE $2)`;
      params.push(`%${q}%`);
    }

    query += ` ORDER BY nombre ASC LIMIT 50`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/clientes', async (req, res, next) => {
  try {
    const nombre = capitalizar(req.body.nombre);
    const nit = req.body.nit || req.body.nit_ci ? String(req.body.nit || req.body.nit_ci).trim().slice(0, 30) : '0';
    const telefono = req.body.telefono ? String(req.body.telefono).trim().slice(0, 30) : null;
    const correo = req.body.correo ? String(req.body.correo).trim().toLowerCase().slice(0, 150) : null;
    const direccion = req.body.direccion ? String(req.body.direccion).trim().slice(0, 200) : null;

    if (!nombre || nombre.length < 2) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio' });
    }

    const { rows } = await pool.query(
      `INSERT INTO cliente (id_empresa, nombre, nit_ci, telefono, correo, direccion)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_cliente, nombre, nit_ci, nit_ci AS nit, telefono, correo, direccion`,
      [req.user.id_empresa, nombre, nit, telefono, correo, direccion]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------
// VENTAS POR WHATSAPP Y FACTURACIÓN INTERNA (PARTE 5)
// -------------------------------------------------------------
router.get('/ventas', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT v.id_venta, v.numero, v.numero_formato, ('VTA-' || v.anio || '-' || v.numero_formato) AS correlativo,
              v.fecha, v.subtotal, v.descuento, v.total, v.total_literal, v.estado,
              v.metodo_pago, v.canal, v.motivo_anulacion, v.anulada_en AS anulado_en, v.observaciones,
              v.id_cliente, v.nombre_cliente AS cliente_nombre, v.nit_ci_cliente AS cliente_nit,
              v.token_publico, v.token_expira,
              COALESCE(v.cliente_correo, c.correo) AS cliente_correo,
              c.telefono AS cliente_telefono,
              (SELECT COUNT(*) FROM venta_item vi WHERE vi.id_venta = v.id_venta) AS items_count
         FROM venta v
         LEFT JOIN cliente c ON c.id_cliente = v.id_cliente
        WHERE v.id_empresa = $1
        ORDER BY v.id_venta DESC
        LIMIT 100`,
      [req.user.id_empresa]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/ventas/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows: ventas } = await pool.query(
      `SELECT v.*, ('VTA-' || v.anio || '-' || v.numero_formato) AS correlativo,
              v.nombre_cliente AS cliente_nombre, v.nit_ci_cliente AS cliente_nit,
              c.telefono AS cliente_telefono, c.correo AS cliente_correo, c.direccion AS cliente_direccion
         FROM venta v
         LEFT JOIN cliente c ON c.id_cliente = v.id_cliente
        WHERE v.id_venta = $1 AND v.id_empresa = $2`,
      [id, req.user.id_empresa]
    );
    if (!ventas.length) return res.status(404).json({ error: 'Venta no encontrada' });

    const venta = ventas[0];
    const { rows: items } = await pool.query(
      `SELECT vi.id_venta_item AS id_item, vi.id_producto, vi.descripcion AS nombre,
              vi.sku, vi.cantidad, vi.precio_unitario, vi.descuento_item AS descuento, vi.subtotal,
              p.unidad
         FROM venta_item vi
         LEFT JOIN producto p ON p.id_producto = vi.id_producto
        WHERE vi.id_venta = $1
        ORDER BY vi.id_venta_item ASC`,
      [id]
    );
    venta.items = items;
    res.json(venta);
  } catch (e) {
    next(e);
  }
});

router.post('/ventas', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { cliente, items, metodo_pago, canal, notas, observaciones } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Debe incluir al menos un producto en la venta' });
    }

    const metodoPagoValido = ['efectivo', 'qr', 'transferencia', 'tarjeta'].includes(metodo_pago)
      ? metodo_pago
      : 'efectivo';
    const canalValido = ['whatsapp', 'mostrador', 'telefono', 'redes_sociales'].includes(canal) ? canal : 'whatsapp';

    await client.query('BEGIN');

    // Gestión del cliente
    let idClienteFinal = null;
    let nombreClienteFinal = 'Cliente General';
    let nitClienteFinal = '0';
    let correoClienteFinal = null;

    if (cliente) {
      if (cliente.id_cliente) {
        idClienteFinal = parseInt(cliente.id_cliente, 10);
        const { rows: cliRow } = await client.query('SELECT nombre, nit_ci, correo FROM cliente WHERE id_cliente = $1', [idClienteFinal]);
        if (cliRow.length) {
          nombreClienteFinal = cliRow[0].nombre;
          nitClienteFinal = cliRow[0].nit_ci;
          correoClienteFinal = cliente.correo ? String(cliente.correo).trim().toLowerCase().slice(0, 120) : cliRow[0].correo;
        }
      } else if (cliente.nombre && String(cliente.nombre).trim()) {
        nombreClienteFinal = capitalizar(cliente.nombre);
        nitClienteFinal = cliente.nit || cliente.nit_ci ? String(cliente.nit || cliente.nit_ci).trim().slice(0, 30) : '0';
        const tel = cliente.telefono ? String(cliente.telefono).trim().slice(0, 30) : null;
        const dir = cliente.direccion ? String(cliente.direccion).trim().slice(0, 200) : null;
        correoClienteFinal = cliente.correo ? String(cliente.correo).trim().toLowerCase().slice(0, 120) : null;

        const { rows: nuevoCli } = await client.query(
          `INSERT INTO cliente (id_empresa, nombre, nit_ci, telefono, correo, direccion)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_cliente`,
          [req.user.id_empresa, nombreClienteFinal, nitClienteFinal, tel, correoClienteFinal, dir]
        );
        idClienteFinal = nuevoCli[0].id_cliente;
      }
    }

    // Bloquear y validar productos y stock
    let subtotalCalculado = 0;
    let descuentoTotal = 0;
    const itemsValidados = [];
    const productosParaAlertar = [];

    for (const item of items) {
      const idProducto = parseInt(item.id_producto, 10);
      const cantidad = parseInt(item.cantidad, 10);
      if (!Number.isInteger(idProducto) || !Number.isInteger(cantidad) || cantidad <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cada ítem debe tener un producto válido y cantidad mayor a cero' });
      }

      const { rows: prodRows } = await client.query(
        `SELECT id_producto, nombre, sku, precio, stock_actual, stock_minimo, unidad, alerta_stock_enviada
           FROM producto
          WHERE id_producto = $1 AND id_empresa = $2
          FOR UPDATE`,
        [idProducto, req.user.id_empresa]
      );

      if (!prodRows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Producto ID ${idProducto} no encontrado o no le pertenece` });
      }

      const prod = prodRows[0];
      if (prod.stock_actual < cantidad) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock_actual} ${prod.unidad}, solicitados: ${cantidad}.`,
        });
      }

      const precioUnitario =
        item.precio_unitario !== undefined && item.precio_unitario !== null
          ? Math.round(Number(item.precio_unitario) * 100) / 100
          : parseFloat(prod.precio);

      const descuentoItem = Math.max(Number(item.descuento || item.descuento_item || 0), 0);
      const subtotalItem = Math.max(Math.round((cantidad * precioUnitario - descuentoItem) * 100) / 100, 0);

      subtotalCalculado += Math.round(cantidad * precioUnitario * 100) / 100;
      descuentoTotal += descuentoItem;

      itemsValidados.push({
        id_producto: idProducto,
        nombre: prod.nombre,
        sku: prod.sku,
        unidad: prod.unidad,
        cantidad,
        precio_unitario: precioUnitario,
        descuento: descuentoItem,
        subtotal: subtotalItem,
        stock_anterior: prod.stock_actual,
        stock_posterior: prod.stock_actual - cantidad,
        stock_minimo: prod.stock_minimo,
        alerta_enviada: prod.alerta_stock_enviada,
      });
    }

    const totalCalculado = Math.max(Math.round((subtotalCalculado - descuentoTotal) * 100) / 100, 0);
    const totalLiteral = numeroALiteral(totalCalculado);
    const anio = new Date().getFullYear();

    // Obtener siguiente correlativo numérico para esta empresa y año
    const { rows: corrRows } = await client.query(
      `SELECT COALESCE(MAX(numero), 0) + 1 AS siguiente FROM venta WHERE id_empresa = $1 AND anio = $2`,
      [req.user.id_empresa, anio]
    );
    const numero = parseInt(corrRows[0].siguiente, 10);
    const numeroFormato = String(numero).padStart(6, '0');
    const correlativo = `VTA-${anio}-${numeroFormato}`;

    const tokenPublico = crypto.randomBytes(24).toString('hex');
    const tokenExpira = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 días

    // Crear la venta
    const { rows: ventaRows } = await client.query(
      `INSERT INTO venta (id_empresa, id_cliente, numero, numero_formato, anio, nombre_cliente, nit_ci_cliente,
                          metodo_pago, subtotal, descuento, total, total_literal, observaciones, estado, canal, creado_por,
                          token_publico, token_expira, cliente_correo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'emitida', $14, $15, $16, $17, $18)
       RETURNING id_venta, token_publico`,
      [
        req.user.id_empresa,
        idClienteFinal,
        numero,
        numeroFormato,
        anio,
        nombreClienteFinal,
        nitClienteFinal,
        metodoPagoValido,
        subtotalCalculado,
        descuentoTotal,
        totalCalculado,
        totalLiteral,
        notas || observaciones ? String(notas || observaciones).trim().slice(0, 500) : null,
        canalValido,
        req.user.id_usuario || null,
        tokenPublico,
        tokenExpira,
        correoClienteFinal,
      ]
    );
    const idVenta = ventaRows[0].id_venta;

    // Descontar inventario y registrar items y movimientos
    for (const item of itemsValidados) {
      await client.query(
        `INSERT INTO venta_item (id_venta, id_producto, descripcion, sku, cantidad, precio_unitario, descuento_item, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [idVenta, item.id_producto, item.nombre, item.sku, item.cantidad, item.precio_unitario, item.descuento, item.subtotal]
      );

      // Descontar stock
      const disponible = item.stock_posterior > 0;
      let nuevaAlerta = item.alerta_enviada;
      if (item.stock_posterior <= item.stock_minimo && !item.alerta_enviada) {
        nuevaAlerta = true;
        productosParaAlertar.push({
          nombre: item.nombre,
          sku: item.sku,
          stock_actual: item.stock_posterior,
          stock_minimo: item.stock_minimo,
          unidad: item.unidad,
        });
      }

      await client.query(
        `UPDATE producto
            SET stock_actual = $1, disponible = $2, alerta_stock_enviada = $3
          WHERE id_producto = $4`,
        [item.stock_posterior, disponible, nuevaAlerta, item.id_producto]
      );

      // Registrar movimiento de stock
      await client.query(
        `INSERT INTO movimiento_stock (id_empresa, id_producto, tipo, cantidad, stock_anterior, stock_resultante, referencia, nota, id_usuario)
         VALUES ($1, $2, 'salida_venta', $3, $4, $5, $6, $7, $8)`,
        [
          req.user.id_empresa,
          item.id_producto,
          item.cantidad,
          item.stock_anterior,
          item.stock_posterior,
          correlativo,
          `Venta registrada (${canalValido})`,
          req.user.id_usuario || null,
        ]
      );
    }

    await client.query('COMMIT');

    // Envío de alerta de stock bajo si algún producto cruzó el umbral
    if (productosParaAlertar.length > 0) {
      (async () => {
        try {
          const emp = await pool.query(
            `SELECT e.razon_social, u.correo FROM empresa e JOIN usuario u ON u.id_usuario = e.id_usuario WHERE e.id_empresa = $1`,
            [req.user.id_empresa]
          );
          if (emp.rows.length) {
            const { html, texto } = construirCorreoStockBajo({
              razonSocial: emp.rows[0].razon_social,
              productos: productosParaAlertar,
            });
            await enviarCorreo({
              id_empresa: req.user.id_empresa,
              tipo: 'stock_bajo',
              para: emp.rows[0].correo,
              asunto: 'Alerta de stock bajo en UNIMARKET BO',
              html,
              texto,
            });
          }
        } catch (err) {
          console.error('[ALERTA_STOCK] Error enviando correo tras venta:', err.message);
        }
      })();
    }

    res.status(201).json({
      id_venta: idVenta,
      correlativo: correlativo,
      numero: numero,
      total: totalCalculado,
      total_literal: totalLiteral,
      token_publico: tokenPublico,
      mensaje: `Venta ${correlativo} registrada con éxito`,
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

router.post('/ventas/:id/anular', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    const motivo = req.body.motivo ? String(req.body.motivo).trim().slice(0, 300) : 'Anulación solicitada por la empresa';

    await client.query('BEGIN');

    const { rows: ventas } = await client.query(
      `SELECT id_venta, numero, numero_formato, anio, estado FROM venta WHERE id_venta = $1 AND id_empresa = $2 FOR UPDATE`,
      [id, req.user.id_empresa]
    );

    if (!ventas.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const venta = ventas[0];
    const correlativo = `VTA-${venta.anio}-${venta.numero_formato}`;

    if (venta.estado === 'anulada') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Esta venta ya se encuentra anulada' });
    }

    // Marcar venta como anulada
    await client.query(
      `UPDATE venta SET estado = 'anulada', motivo_anulacion = $1, anulada_en = NOW() WHERE id_venta = $2`,
      [motivo, id]
    );

    // Obtener ítems para restaurar stock
    const { rows: items } = await client.query(
      `SELECT id_producto, cantidad FROM venta_item WHERE id_venta = $1`,
      [id]
    );

    for (const item of items) {
      const prodRes = await client.query(
        `SELECT stock_actual, stock_minimo FROM producto WHERE id_producto = $1 FOR UPDATE`,
        [item.id_producto]
      );
      if (prodRes.rows.length) {
        const prod = prodRes.rows[0];
        const nuevoStock = prod.stock_actual + item.cantidad;
        const alertaReset = nuevoStock > prod.stock_minimo ? false : true;

        await client.query(
          `UPDATE producto SET stock_actual = $1, disponible = true, alerta_stock_enviada = $2 WHERE id_producto = $3`,
          [nuevoStock, alertaReset, item.id_producto]
        );

        await client.query(
          `INSERT INTO movimiento_stock (id_empresa, id_producto, tipo, cantidad, stock_anterior, stock_resultante, referencia, nota, id_usuario)
           VALUES ($1, $2, 'anulacion', $3, $4, $5, $6, $7, $8)`,
          [
            req.user.id_empresa,
            item.id_producto,
            item.cantidad,
            prod.stock_actual,
            nuevoStock,
            correlativo,
            `Restablecimiento por anulación: ${motivo}`,
            req.user.id_usuario || null,
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ mensaje: `Venta ${correlativo} anulada e inventario restablecido con éxito` });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

// Descargar o visualizar comprobante de venta en PDF (A4 o Ticket 80mm)
router.get('/ventas/:id/pdf', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const formato = String(req.query.formato || 'a4').toLowerCase() === 'ticket' ? 'ticket' : 'a4';

    const { rows: ventas } = await pool.query(
      `SELECT v.*, c.nombre AS cliente_nombre, c.nit_ci AS cliente_nit,
              c.telefono AS cliente_telefono, c.direccion AS cliente_direccion
         FROM venta v
         LEFT JOIN cliente c ON c.id_cliente = v.id_cliente
        WHERE v.id_venta = $1 AND v.id_empresa = $2`,
      [id, req.user.id_empresa]
    );
    if (!ventas.length) return res.status(404).json({ error: 'Venta no encontrada' });

    const venta = ventas[0];
    venta.correlativo = venta.correlativo || (venta.numero_formato ? `VTA-${venta.numero_formato}` : `VTA-${String(venta.numero || venta.id_venta).padStart(6, '0')}`);
    const { rows: items } = await pool.query(
      `SELECT vi.*, COALESCE(p.nombre, vi.descripcion) AS nombre, COALESCE(vi.sku, p.sku) AS sku, p.unidad
         FROM venta_item vi
         LEFT JOIN producto p ON p.id_producto = vi.id_producto
        WHERE vi.id_venta = $1
        ORDER BY vi.id_venta_item ASC`,
      [id]
    );
    venta.items = items;

    const { rows: empRows } = await pool.query(
      `SELECT e.razon_social, e.nit, e.telefono, e.whatsapp, e.direccion, u.correo
         FROM empresa e
         JOIN usuario u ON u.id_usuario = e.id_usuario
        WHERE e.id_empresa = $1`,
      [req.user.id_empresa]
    );
    const empresa = empRows[0] || {};

    const corr = venta.numero_formato || String(venta.numero || venta.id_venta).padStart(6, '0');
    const filename = `comprobante-venta-${corr}-${formato}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    generarPdfVenta({ venta, empresa, formato, stream: res });
  } catch (e) {
    next(e);
  }
});

// Obtener datos y enlace público temporal para compartir comprobante por WhatsApp o Correo
router.get('/ventas/:id/compartir', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows: ventas } = await pool.query(
      `SELECT v.*, ('VTA-' || v.anio || '-' || v.numero_formato) AS correlativo,
              v.nombre_cliente AS cliente_nombre, v.nit_ci_cliente AS cliente_nit,
              COALESCE(v.cliente_correo, c.correo) AS cliente_correo,
              c.telefono AS cliente_telefono
         FROM venta v
         LEFT JOIN cliente c ON c.id_cliente = v.id_cliente
        WHERE v.id_venta = $1 AND v.id_empresa = $2`,
      [id, req.user.id_empresa]
    );

    if (!ventas.length) return res.status(404).json({ error: 'Venta no encontrada' });
    const venta = ventas[0];

    // Asegurar token público temporal
    let token = venta.token_publico;
    if (!token || !venta.token_expira || new Date(venta.token_expira) < new Date()) {
      token = crypto.randomBytes(24).toString('hex');
      const tokenExpira = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      await pool.query(
        `UPDATE venta SET token_publico = $1, token_expira = $2 WHERE id_venta = $3`,
        [token, tokenExpira, id]
      );
      venta.token_publico = token;
      venta.token_expira = tokenExpira;
    }

    const { rows: empRows } = await pool.query(
      `SELECT e.razon_social, e.whatsapp, e.telefono FROM empresa e WHERE e.id_empresa = $1`,
      [req.user.id_empresa]
    );
    const empresa = empRows[0] || {};
    const config = getMailConfig();

    const corr = venta.correlativo || (venta.numero_formato ? `VTA-${venta.numero_formato}` : `VTA-${venta.id_venta}`);
    const totalFmt = Number(venta.total).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const urlComprobante = `${config.appUrl}/comprobante/${token}`;
    const urlPdfDirecto = `${config.appUrl}/api/publico/comprobante/${token}`;

    const mensajeWhatsApp = `Hola ${venta.cliente_nombre}, le compartimos su comprobante de compra ${corr} por Bs ${totalFmt} emitido por ${empresa.razon_social}: ${urlComprobante}\n¡Muchas gracias por su preferencia!`;

    let telClienteLimpio = String(venta.cliente_telefono || '').replace(/\D/g, '');
    let urlWhatsApp = '';
    if (telClienteLimpio) {
      if (!telClienteLimpio.startsWith('591') && telClienteLimpio.length === 8) {
        telClienteLimpio = `591${telClienteLimpio}`;
      }
      urlWhatsApp = `https://wa.me/${telClienteLimpio}?text=${encodeURIComponent(mensajeWhatsApp)}`;
    }

    res.json({
      id_venta: venta.id_venta,
      correlativo: corr,
      total: venta.total,
      cliente_nombre: venta.cliente_nombre,
      cliente_telefono: venta.cliente_telefono,
      cliente_correo: venta.cliente_correo,
      token_publico: token,
      token_expira: venta.token_expira,
      url_comprobante: urlComprobante,
      url_pdf_directo: urlPdfDirecto,
      mensaje_whatsapp: mensajeWhatsApp,
      url_whatsapp: urlWhatsApp,
    });
  } catch (e) {
    next(e);
  }
});

// Enviar comprobante al correo del comprador
router.post('/ventas/:id/enviar-correo', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const correoDestino = String(req.body.correo || '').trim().toLowerCase();

    const { rows: ventas } = await pool.query(
      `SELECT v.*, ('VTA-' || v.anio || '-' || v.numero_formato) AS correlativo,
              v.nombre_cliente AS cliente_nombre,
              COALESCE(v.cliente_correo, c.correo) AS cliente_correo
         FROM venta v
         LEFT JOIN cliente c ON c.id_cliente = v.id_cliente
        WHERE v.id_venta = $1 AND v.id_empresa = $2`,
      [id, req.user.id_empresa]
    );

    if (!ventas.length) return res.status(404).json({ error: 'Venta no encontrada' });
    const venta = ventas[0];

    const emailFinal = correoDestino || venta.cliente_correo;
    if (!emailFinal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFinal)) {
      return res.status(400).json({ error: 'Ingrese un correo electrónico válido para el cliente' });
    }

    // Asegurar token público
    let token = venta.token_publico;
    if (!token || !venta.token_expira || new Date(venta.token_expira) < new Date()) {
      token = crypto.randomBytes(24).toString('hex');
      const tokenExpira = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      await pool.query(
        `UPDATE venta SET token_publico = $1, token_expira = $2 WHERE id_venta = $3`,
        [token, tokenExpira, id]
      );
      venta.token_publico = token;
    }

    // Guardar correo en la venta y cliente si no estaba
    if (!venta.cliente_correo) {
      await pool.query(`UPDATE venta SET cliente_correo = $1 WHERE id_venta = $2`, [emailFinal, id]);
      if (venta.id_cliente) {
        await pool.query(`UPDATE cliente SET correo = $1 WHERE id_cliente = $2 AND correo IS NULL`, [emailFinal, venta.id_cliente]);
      }
    }

    const { rows: empRows } = await pool.query(
      `SELECT e.razon_social, e.nit, e.telefono, e.whatsapp FROM empresa e WHERE e.id_empresa = $1`,
      [req.user.id_empresa]
    );
    const empresa = empRows[0] || {};
    const config = getMailConfig();
    const urlComprobante = `${config.appUrl}/comprobante/${token}`;

    const plantilla = construirCorreoComprobanteVenta({
      empresa,
      venta,
      cliente: { nombre: venta.cliente_nombre },
      enlaceComprobante: urlComprobante,
    });

    await enviarCorreo({
      id_empresa: req.user.id_empresa,
      tipo: 'comprobante_cliente',
      para: emailFinal,
      asunto: plantilla.asunto,
      html: plantilla.html,
      texto: plantilla.texto,
    });

    res.json({
      ok: true,
      mensaje: `Comprobante enviado exitosamente a ${emailFinal}`,
      correo: emailFinal,
    });
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------
// GESTIÓN DE PEDIDOS RECIBIDOS POR WHATSAPP / CATÁLOGO
// -------------------------------------------------------------
// Listar todos los pedidos de la empresa con ítems
router.get('/pedidos', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.codigo, p.nombre_cliente, p.ciudad, p.total_estimado, p.estado,
              p.visto, p.id_venta, p.creado_en,
              COALESCE(
                (SELECT json_agg(
                   json_build_object(
                     'id_item', pi.id_item,
                     'id_producto', pi.id_producto,
                     'descripcion', pi.descripcion,
                     'sku', pi.sku,
                     'cantidad_total', pi.cantidad_total,
                     'desglose_colores', pi.desglose_colores,
                     'modo', pi.modo,
                     'precio_unitario', pi.precio_unitario,
                     'subtotal', pi.subtotal
                   ) ORDER BY pi.id_item ASC
                 )
                 FROM pedido_whatsapp_item pi
                WHERE pi.id_pedido = p.id),
                '[]'::json
              ) AS items
         FROM pedido_whatsapp p
        WHERE p.id_empresa = $1
        ORDER BY p.creado_en DESC
        LIMIT 150`,
      [req.user.id_empresa]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Contador de pedidos nuevos y pendientes (para badge en panel)
router.get('/pedidos/contador', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE visto = FALSE) AS no_vistos,
         COUNT(*) FILTER (WHERE estado = 'enviado') AS pendientes,
         COUNT(*) AS total
        FROM pedido_whatsapp
       WHERE id_empresa = $1`,
      [req.user.id_empresa]
    );
    const r = rows[0] || {};
    res.json({
      no_vistos: parseInt(r.no_vistos || 0, 10),
      pendientes: parseInt(r.pendientes || 0, 10),
      total: parseInt(r.total || 0, 10),
    });
  } catch (e) {
    next(e);
  }
});

// Marcar pedido como visto
router.put('/pedidos/:id/marcar-visto', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query(
      `UPDATE pedido_whatsapp SET visto = TRUE WHERE id = $1 AND id_empresa = $2`,
      [id, req.user.id_empresa]
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Cambiar estado del pedido ('enviado', 'atendido', 'convertido_en_venta', 'cancelado')
router.put('/pedidos/:id/estado', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { estado, id_venta } = req.body;
    const estadosValidos = ['enviado', 'atendido', 'convertido_en_venta', 'cancelado'];

    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado de pedido no válido' });
    }

    const { rows } = await pool.query(
      `UPDATE pedido_whatsapp
          SET estado = $1,
              visto = TRUE,
              id_venta = COALESCE($2, id_venta)
        WHERE id = $3 AND id_empresa = $4
        RETURNING *`,
      [estado, id_venta ? parseInt(id_venta, 10) : null, id, req.user.id_empresa]
    );

    if (!rows.length) return res.status(404).json({ error: 'Pedido no encontrado' });

    res.json({ ok: true, pedido: rows[0] });
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------
// REPORTES COMERCIALES Y EN PDF (PARTE 6)
// -------------------------------------------------------------
router.get('/reportes/resumen', async (req, res, next) => {
  try {
    const { desde, hasta, id_producto } = req.query;

    let filtroFecha = '';
    const params = [req.user.id_empresa];

    if (desde) {
      params.push(desde);
      filtroFecha += ` AND v.fecha >= $${params.length}`;
    }
    if (hasta) {
      params.push(`${hasta} 23:59:59`);
      filtroFecha += ` AND v.fecha <= $${params.length}`;
    }

    const paramsTopProds = [...params];

    let filtroProd = '';
    if (id_producto && Number.isInteger(parseInt(id_producto, 10))) {
      params.push(parseInt(id_producto, 10));
      filtroProd = ` AND vi.id_producto = $${params.length}`;
    }

    // Totales de ventas no anuladas
    const { rows: totRows } = await pool.query(
      `SELECT COUNT(DISTINCT v.id_venta) AS total_ventas,
              COALESCE(SUM(vi.subtotal), 0) AS ingresos_totales,
              COALESCE(SUM(vi.cantidad), 0) AS total_unidades_vendidas
         FROM venta v
         JOIN venta_item vi ON vi.id_venta = v.id_venta
        WHERE v.id_empresa = $1 AND v.estado = 'emitida' ${filtroFecha} ${filtroProd}`,
      params
    );

    // Top productos más vendidos
    const { rows: topProds } = await pool.query(
      `SELECT p.id_producto, p.nombre, p.sku,
              SUM(vi.cantidad) AS unidades_vendidas,
              SUM(vi.subtotal) AS total_recaudado
         FROM venta_item vi
         JOIN venta v ON v.id_venta = vi.id_venta
         JOIN producto p ON p.id_producto = vi.id_producto
        WHERE v.id_empresa = $1 AND v.estado = 'emitida' ${filtroFecha}
        GROUP BY p.id_producto, p.nombre, p.sku
        ORDER BY unidades_vendidas DESC
        LIMIT 5`,
      paramsTopProds
    );

    // Productos con stock bajo o agotado
    const { rows: stockBajo } = await pool.query(
      `SELECT p.id_producto, p.nombre, p.sku, p.stock_actual, p.stock_minimo, p.unidad
         FROM producto p
        WHERE p.id_empresa = $1 AND p.stock_actual <= p.stock_minimo
        ORDER BY p.stock_actual ASC`,
      [req.user.id_empresa]
    );

    const totalVentas = parseInt(totRows[0]?.total_ventas, 10) || 0;
    const ingresosTotales = parseFloat(totRows[0]?.ingresos_totales) || 0;
    const unidadesVendidas = parseInt(totRows[0]?.total_unidades_vendidas, 10) || 0;

    res.json({
      total_ventas: totalVentas,
      ingresos_totales: Math.round(ingresosTotales * 100) / 100,
      total_unidades_vendidas: unidadesVendidas,
      ticket_promedio: totalVentas > 0 ? Math.round((ingresosTotales / totalVentas) * 100) / 100 : 0,
      stock_bajo_count: stockBajo.length,
      top_productos: topProds,
      productos_stock_bajo: stockBajo,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/reportes/pdf', async (req, res, next) => {
  try {
    const { desde, hasta } = req.query;

    let filtroFecha = '';
    const params = [req.user.id_empresa];

    if (desde) {
      params.push(desde);
      filtroFecha += ` AND v.fecha >= $${params.length}`;
    }
    if (hasta) {
      params.push(`${hasta} 23:59:59`);
      filtroFecha += ` AND v.fecha <= $${params.length}`;
    }

    const { rows: totRows } = await pool.query(
      `SELECT COUNT(DISTINCT v.id_venta) AS total_ventas,
              COALESCE(SUM(vi.subtotal), 0) AS ingresos_totales,
              COALESCE(SUM(vi.cantidad), 0) AS total_unidades_vendidas
         FROM venta v
         JOIN venta_item vi ON vi.id_venta = v.id_venta
        WHERE v.id_empresa = $1 AND v.estado = 'emitida' ${filtroFecha}`,
      params
    );

    const { rows: topProds } = await pool.query(
      `SELECT p.id_producto, p.nombre, p.sku,
              SUM(vi.cantidad) AS unidades_vendidas,
              SUM(vi.subtotal) AS total_recaudado
         FROM venta_item vi
         JOIN venta v ON v.id_venta = vi.id_venta
         JOIN producto p ON p.id_producto = vi.id_producto
        WHERE v.id_empresa = $1 AND v.estado = 'emitida' ${filtroFecha}
        GROUP BY p.id_producto, p.nombre, p.sku
        ORDER BY unidades_vendidas DESC
        LIMIT 5`,
      params
    );

    const { rows: stockBajo } = await pool.query(
      `SELECT p.id_producto, p.nombre, p.sku, p.stock_actual, p.stock_minimo, p.unidad
         FROM producto p
        WHERE p.id_empresa = $1 AND p.stock_actual <= p.stock_minimo
        ORDER BY p.stock_actual ASC`,
      [req.user.id_empresa]
    );

    const { rows: empRows } = await pool.query(
      `SELECT razon_social, nit, telefono, whatsapp FROM empresa WHERE id_empresa = $1`,
      [req.user.id_empresa]
    );

    const resumen = {
      total_ventas: parseInt(totRows[0]?.total_ventas, 10) || 0,
      ingresos_totales: parseFloat(totRows[0]?.ingresos_totales) || 0,
      total_unidades_vendidas: parseInt(totRows[0]?.total_unidades_vendidas, 10) || 0,
      stock_bajo_count: stockBajo.length,
      top_productos: topProds,
      productos_stock_bajo: stockBajo,
    };

    const empresa = empRows[0] || {};
    const filename = `reporte-ventas-inventario-${empresa.razon_social?.slice(0, 20) || 'empresa'}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    generarPdfReporte({ resumen, empresa, desde, hasta, stream: res });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

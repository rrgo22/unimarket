const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const pool = require('../db');
const { firmar, autenticar } = require('../middleware/auth');
const { subirDocumento, erroresUpload } = require('../middleware/upload');
const {
  limpiar,
  normalizarRazonSocial,
  normalizarRazonSocialParaBusqueda,
  normalizarNit,
  normalizarTelefono,
  normalizarWhatsapp,
  resolverSlugUnico,
  esUrlValida,
} = require('../utils/normalizar');

const router = express.Router();

// Límite de intentos contra fuerza bruta
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intente nuevamente en 15 minutos.' },
});

router.post('/login', limiteLogin, async (req, res, next) => {
  try {
    const usuario = limpiar(req.body.usuario);
    const contrasena = String(req.body.contrasena || '');
    if (!usuario || !contrasena) return res.status(400).json({ error: 'Ingrese usuario y contraseña' });

    const { rows } = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.usuario, u.rol, u.contrasena_hash, u.activo,
              e.id_empresa, e.razon_social, e.slug, e.estado_verificacion, e.eliminado_en
         FROM usuario u LEFT JOIN empresa e ON e.id_usuario = u.id_usuario
        WHERE LOWER(u.usuario) = LOWER($1)`,
      [usuario]
    );
    const u = rows[0];
    const ok = u && (await bcrypt.compare(contrasena, u.contrasena_hash));
    if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    // Verificar si la cuenta ha sido eliminada o desactivada
    if (u.activo === false || (u.id_empresa && u.eliminado_en)) {
      return res.status(403).json({ error: 'Cuenta eliminada o desactivada por la administración.' });
    }

    res.json({
      token: firmar(u),
      user: {
        id_usuario: u.id_usuario,
        nombre: u.nombre,
        usuario: u.usuario,
        rol: u.rol,
        id_empresa: u.id_empresa,
        razon_social: u.razon_social,
        slug: u.slug,
        estado_verificacion: u.estado_verificacion,
      },
    });
  } catch (e) {
    next(e);
  }
});

// Límite de solicitudes de disponibilidad (120 por minuto)
const limiteDisponibilidad = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { disponible: false, mensaje: 'Demasiadas consultas de validación.' },
});

/**
 * PARTE 1: Verificación de disponibilidad en vivo para registro
 * GET /api/auth/disponibilidad?campo=nit|correo|usuario|razon_social|whatsapp&valor=...
 * No revela información de empresas, solo responde { disponible: boolean, mensaje?: string }
 */
router.get('/disponibilidad', limiteDisponibilidad, async (req, res, next) => {
  try {
    const campo = String(req.query.campo || '').trim().toLowerCase();
    const valor = String(req.query.valor || '').trim();

    if (!campo || !valor) {
      return res.json({ disponible: true });
    }

    if (campo === 'nit') {
      const nitNorm = normalizarNit(valor);
      if (nitNorm.error) {
        return res.json({ disponible: false, mensaje: nitNorm.error });
      }
      const { rowCount } = await pool.query(
        'SELECT 1 FROM empresa WHERE nit = $1 AND eliminado_en IS NULL',
        [nitNorm.valor]
      );
      if (rowCount > 0) {
        return res.json({ disponible: false, mensaje: 'Este NIT ya está registrado' });
      }
      return res.json({ disponible: true });
    }

    if (campo === 'razon_social') {
      const razonVal = normalizarRazonSocial(valor);
      if (razonVal.error) {
        return res.json({ disponible: false, mensaje: razonVal.error });
      }
      const norm = normalizarRazonSocialParaBusqueda(valor);
      if (!norm) return res.json({ disponible: true });

      const { rowCount } = await pool.query(
        'SELECT 1 FROM empresa WHERE razon_social_norm = $1 AND eliminado_en IS NULL',
        [norm]
      );
      if (rowCount > 0) {
        return res.json({ disponible: false, mensaje: 'Ya existe una empresa con ese nombre' });
      }
      return res.json({ disponible: true });
    }

    if (campo === 'correo') {
      const email = valor.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.json({ disponible: false, mensaje: 'Correo electrónico no válido' });
      }
      const { rowCount } = await pool.query(
        'SELECT 1 FROM usuario WHERE LOWER(correo) = LOWER($1)',
        [email]
      );
      if (rowCount > 0) {
        return res.json({ disponible: false, mensaje: 'Este correo ya está en uso' });
      }
      return res.json({ disponible: true });
    }

    if (campo === 'usuario') {
      const u = valor.toLowerCase();
      if (!/^[a-z0-9_]{4,30}$/.test(u)) {
        return res.json({ disponible: false, mensaje: 'Usuario: 4 a 30 caracteres (letras, números o _)' });
      }
      const { rowCount } = await pool.query(
        'SELECT 1 FROM usuario WHERE LOWER(usuario) = LOWER($1)',
        [u]
      );
      if (rowCount > 0) {
        return res.json({ disponible: false, mensaje: 'Este nombre de usuario ya está en uso' });
      }
      return res.json({ disponible: true });
    }

    if (campo === 'whatsapp') {
      const waNorm = normalizarWhatsapp(valor);
      if (waNorm.error) {
        return res.json({ disponible: false, mensaje: waNorm.error });
      }
      const { rowCount } = await pool.query(
        'SELECT 1 FROM empresa WHERE whatsapp = $1 AND eliminado_en IS NULL',
        [waNorm.valor]
      );
      if (rowCount > 0) {
        return res.json({ disponible: false, mensaje: 'Este WhatsApp ya pertenece a otra empresa' });
      }
      return res.json({ disponible: true });
    }

    return res.json({ disponible: true });
  } catch (e) {
    next(e);
  }
});

// Límite de solicitudes de registro de empresa por IP (10 por hora)
const limiteRegistro = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de registro desde esta IP. Intente nuevamente en una hora.' },
});

// CU1 + CU2: registro de empresa con documento NIT en PDF
router.post(
  '/registro-empresa',
  limiteRegistro,
  subirDocumento.single('documento'),
  erroresUpload,
  async (req, res, next) => {
    const quitarArchivo = () => req.file && fs.unlink(req.file.path, () => {});
    const client = await pool.connect();
    try {
      const errores = {};
      const razon = normalizarRazonSocial(req.body.razon_social);
      const nit = normalizarNit(req.body.nit);
      const tel = normalizarTelefono(req.body.telefono, 'teléfono', true);
      const wa = normalizarWhatsapp(req.body.whatsapp);
      const usuario = String(req.body.usuario ?? '').trim().toLowerCase();
      const correo = String(req.body.correo ?? '').trim().toLowerCase();
      const contrasena = String(req.body.contrasena || '');
      const sitio = req.body.sitio_web ? String(req.body.sitio_web).trim() : null;

      // Validaciones sintácticas y de formato
      if (razon.error) errores.razon_social = razon.error;
      if (nit.error) errores.nit = nit.error;
      if (tel.error) errores.telefono = tel.error;
      if (wa.error) errores.whatsapp = wa.error;
      if (!/^[a-z0-9_]{4,30}$/.test(usuario)) errores.usuario = 'Usuario: 4 a 30 caracteres (letras, números o _)';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.correo = 'Correo electrónico no válido';
      if (contrasena.length < 8) errores.contrasena = 'La contraseña debe tener al menos 8 caracteres';
      if (sitio && !esUrlValida(sitio)) errores.sitio_web = 'Ingrese una URL válida (debe empezar con http:// o https://)';
      if (!req.file) errores.documento = 'Adjunte el documento de NIT en PDF';

      if (Object.keys(errores).length) {
        quitarArchivo();
        return res.status(400).json({ error: 'Corrija los campos marcados', errores });
      }

      const razonNorm = normalizarRazonSocialParaBusqueda(razon.valor);

      // PARTE 1: Verificación de unicidad en Backend (fuente de verdad) con código 409
      const { rowCount: rNit } = await client.query(
        'SELECT 1 FROM empresa WHERE nit = $1 AND eliminado_en IS NULL',
        [nit.valor]
      );
      if (rNit > 0) {
        quitarArchivo();
        return res.status(409).json({
          error: 'Este NIT ya está registrado',
          campo: 'nit',
          mensaje: 'Este NIT ya está registrado',
          errores: { nit: 'Este NIT ya está registrado' },
        });
      }

      const { rowCount: rRazon } = await client.query(
        'SELECT 1 FROM empresa WHERE razon_social_norm = $1 AND eliminado_en IS NULL',
        [razonNorm]
      );
      if (rRazon > 0) {
        quitarArchivo();
        return res.status(409).json({
          error: 'Ya existe una empresa con ese nombre',
          campo: 'razon_social',
          mensaje: 'Ya existe una empresa con ese nombre',
          errores: { razon_social: 'Ya existe una empresa con ese nombre' },
        });
      }

      const { rowCount: rCorreo } = await client.query(
        'SELECT 1 FROM usuario WHERE LOWER(correo) = LOWER($1)',
        [correo]
      );
      if (rCorreo > 0) {
        quitarArchivo();
        return res.status(409).json({
          error: 'Este correo ya está en uso',
          campo: 'correo',
          mensaje: 'Este correo ya está en uso',
          errores: { correo: 'Este correo ya está en uso' },
        });
      }

      const { rowCount: rUsu } = await client.query(
        'SELECT 1 FROM usuario WHERE LOWER(usuario) = LOWER($1)',
        [usuario]
      );
      if (rUsu > 0) {
        quitarArchivo();
        return res.status(409).json({
          error: 'Este nombre de usuario ya está en uso',
          campo: 'usuario',
          mensaje: 'Este nombre de usuario ya está en uso',
          errores: { usuario: 'Este nombre de usuario ya está en uso' },
        });
      }

      const { rowCount: rWa } = await client.query(
        'SELECT 1 FROM empresa WHERE whatsapp = $1 AND eliminado_en IS NULL',
        [wa.valor]
      );
      if (rWa > 0) {
        quitarArchivo();
        return res.status(409).json({
          error: 'Este WhatsApp ya pertenece a otra empresa',
          campo: 'whatsapp',
          mensaje: 'Este WhatsApp ya pertenece a otra empresa',
          errores: { whatsapp: 'Este WhatsApp ya pertenece a otra empresa' },
        });
      }

      if (tel.valor) {
        const { rowCount: rTel } = await client.query(
          'SELECT 1 FROM empresa WHERE telefono = $1 AND eliminado_en IS NULL',
          [tel.valor]
        );
        if (rTel > 0) {
          quitarArchivo();
          return res.status(409).json({
            error: 'Este teléfono ya está registrado',
            campo: 'telefono',
            mensaje: 'Este teléfono ya está registrado',
            errores: { telefono: 'Este teléfono ya está registrado' },
          });
        }
      }

      await client.query('BEGIN');
      const slugUnico = await resolverSlugUnico(client, razon.valor);

      const hash = await bcrypt.hash(contrasena, 10);
      const u = await client.query(
        `INSERT INTO usuario (nombre, usuario, correo, contrasena_hash, rol, activo)
         VALUES ($1,$2,$3,$4,'empresa', TRUE) RETURNING id_usuario`,
        [razon.valor, usuario, correo, hash]
      );

      const e = await client.query(
        `INSERT INTO empresa (id_usuario, razon_social, razon_social_norm, slug, nit, telefono, whatsapp, sitio_web)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id_empresa, slug`,
        [u.rows[0].id_usuario, razon.valor, razonNorm, slugUnico, nit.valor, tel.valor, wa.valor, sitio]
      );
      const id_empresa = e.rows[0].id_empresa;

      await client.query(
        `INSERT INTO verificacion (id_empresa, documento) VALUES ($1,$2)`,
        [id_empresa, req.file.filename]
      );
      await client.query(`INSERT INTO suscripcion (id_empresa, estado) VALUES ($1, 'pendiente_pago')`, [id_empresa]);
      await client.query('COMMIT');

      // Envío de correo asíncrono posterior al COMMIT (no bloquea ni revierte)
      try {
        const { enviarCorreo, construirCorreoSolicitudRecibida } = require('../utils/correo');
        const emailData = construirCorreoSolicitudRecibida({
          razonSocial: razon.valor,
          nit: nit.valor,
          correo,
        });
        enviarCorreo({
          id_empresa,
          tipo: 'recibida',
          para: correo,
          asunto: 'Solicitud de registro recibida en UNIMARKET BO',
          html: emailData.html,
          texto: emailData.texto,
        }).catch((errMail) => console.error('Error enviando correo de solicitud recibida:', errMail.message));
      } catch (errReq) {
        console.error('Error preparando plantilla de correo:', errReq.message);
      }

      res.status(201).json({
        mensaje: 'Empresa registrada. Su verificación quedó pendiente de revisión.',
        slug: e.rows[0].slug,
        id_empresa,
        razon_social: razon.valor,
        nit: nit.valor,
        correo,
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      quitarArchivo();
      if (err.code === '23505') {
        let campo = 'nit';
        let mensaje = 'Este NIT ya está registrado';
        if (/razon_social|razon_social_norm/.test(err.constraint)) {
          campo = 'razon_social';
          mensaje = 'Ya existe una empresa con ese nombre';
        } else if (/correo/.test(err.constraint)) {
          campo = 'correo';
          mensaje = 'Este correo ya está en uso';
        } else if (/whatsapp/.test(err.constraint)) {
          campo = 'whatsapp';
          mensaje = 'Este WhatsApp ya pertenece a otra empresa';
        } else if (/telefono/.test(err.constraint)) {
          campo = 'telefono';
          mensaje = 'Este teléfono ya está registrado';
        } else if (/usuario/.test(err.constraint)) {
          campo = 'usuario';
          mensaje = 'Este nombre de usuario ya está en uso';
        }
        return res.status(409).json({ error: mensaje, campo, mensaje, errores: { [campo]: mensaje } });
      }
      next(err);
    } finally {
      client.release();
    }
  }
);

router.get('/me', autenticar, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.usuario, u.rol, u.activo,
              e.id_empresa, e.razon_social, e.slug, e.estado_verificacion, e.eliminado_en
         FROM usuario u LEFT JOIN empresa e ON e.id_usuario = u.id_usuario
        WHERE u.id_usuario = $1`,
      [req.user.id_usuario]
    );
    if (!rows.length) return res.status(401).json({ error: 'Usuario no encontrado' });
    const u = rows[0];
    if (u.activo === false || (u.id_empresa && u.eliminado_en)) {
      return res.status(403).json({ error: 'Cuenta eliminada o desactivada' });
    }
    res.json(u);
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------
// RECUPERACIÓN DE CONTRASEÑA Y CAMBIO DESDE EL PANEL
// -------------------------------------------------------------
const crypto = require('crypto');
const {
  enviarCorreo,
  construirCorreoRecuperacionPassword,
  getMailConfig,
} = require('../servicios/correo');

const limiteRecuperacion = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de recuperación. Intente nuevamente en 15 minutos.' },
});

// Solicitar recuperación de contraseña (envía enlace temporal por correo)
router.post('/olvide-password', limiteRecuperacion, async (req, res, next) => {
  try {
    const cuenta = String(req.body.correo || req.body.usuario || '').trim().toLowerCase();
    if (!cuenta) {
      return res.status(400).json({ error: 'Ingrese su correo electrónico o nombre de usuario' });
    }

    const { rows } = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.usuario, u.correo, u.activo, e.id_empresa, e.eliminado_en
         FROM usuario u
         LEFT JOIN empresa e ON e.id_usuario = u.id_usuario
        WHERE (LOWER(u.correo) = $1 OR LOWER(u.usuario) = $1)`,
      [cuenta]
    );

    const u = rows[0];

    // Por seguridad, si el usuario no existe o está eliminado respondemos con éxito genérico para no filtrar cuentas
    if (!u || u.activo === false || (u.id_empresa && u.eliminado_en)) {
      return res.json({
        ok: true,
        mensaje: 'Si los datos corresponden a una cuenta registrada, recibirá un enlace temporal para restablecer su contraseña.',
      });
    }

    // Generar token seguro de 32 bytes (64 caracteres hex) con expiración de 1 hora
    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 60 * 60 * 1000); // 60 minutos

    await pool.query(
      `UPDATE usuario
          SET reset_password_token = $1,
              reset_password_expira = $2
        WHERE id_usuario = $3`,
      [token, expira, u.id_usuario]
    );

    const config = getMailConfig();
    const enlaceRecuperacion = `${config.appUrl}/recuperar-password/${token}`;

    const plantilla = construirCorreoRecuperacionPassword({
      usuario: u.usuario,
      nombre: u.nombre,
      enlaceRecuperacion,
      expiraMinutos: 60,
    });

    enviarCorreo({
      id_empresa: u.id_empresa,
      tipo: 'recuperacion_password',
      para: u.correo,
      asunto: plantilla.asunto,
      html: plantilla.html,
      texto: plantilla.texto,
    }).catch((err) => console.error('Error enviando correo de recuperación:', err.message));

    res.json({
      ok: true,
      mensaje: 'Le enviamos un correo con un enlace temporal para restablecer su contraseña. Revise su bandeja de entrada o spam.',
    });
  } catch (e) {
    next(e);
  }
});

// Verificar si un token de recuperación sigue siendo válido
router.get('/verificar-token-reset/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ valido: false, error: 'Token no proporcionado' });

    const { rows } = await pool.query(
      `SELECT id_usuario, usuario, nombre, reset_password_expira
         FROM usuario
        WHERE reset_password_token = $1`,
      [token]
    );

    if (!rows.length) {
      return res.status(404).json({ valido: false, error: 'El enlace de recuperación es inválido o ya ha sido utilizado.' });
    }

    const u = rows[0];
    if (new Date(u.reset_password_expira) < new Date()) {
      return res.status(410).json({ valido: false, error: 'El enlace de recuperación ha expirado. Por favor solicite uno nuevo.' });
    }

    res.json({
      valido: true,
      usuario: u.usuario,
      nombre: u.nombre,
    });
  } catch (e) {
    next(e);
  }
});

// Restablecer contraseña con el token temporal
router.post('/reset-password', async (req, res, next) => {
  try {
    const token = String(req.body.token || '').trim();
    const contrasena = String(req.body.contrasena || '');

    if (!token) return res.status(400).json({ error: 'Token no proporcionado' });
    if (!contrasena || contrasena.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    const { rows } = await pool.query(
      `SELECT id_usuario, usuario, reset_password_expira
         FROM usuario
        WHERE reset_password_token = $1`,
      [token]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'El enlace de recuperación es inválido o ya fue utilizado.' });
    }

    const u = rows[0];
    if (new Date(u.reset_password_expira) < new Date()) {
      return res.status(410).json({ error: 'El enlace ha expirado. Solicite una nueva recuperación de contraseña.' });
    }

    const nuevoHash = await bcrypt.hash(contrasena, 10);

    await pool.query(
      `UPDATE usuario
          SET contrasena_hash = $1,
              reset_password_token = NULL,
              reset_password_expira = NULL
        WHERE id_usuario = $2`,
      [nuevoHash, u.id_usuario]
    );

    res.json({
      ok: true,
      mensaje: 'Contraseña actualizada con éxito. Ya puede iniciar sesión con su nueva clave.',
    });
  } catch (e) {
    next(e);
  }
});

// Cambiar contraseña desde el panel de la empresa (usuario autenticado)
router.put('/cambiar-password', autenticar, async (req, res, next) => {
  try {
    const contrasenaActual = String(req.body.contrasena_actual || '');
    const nuevaContrasena = String(req.body.nueva_contrasena || '');

    if (!contrasenaActual || !nuevaContrasena) {
      return res.status(400).json({ error: 'Debe ingresar la contraseña actual y la nueva contraseña' });
    }

    if (nuevaContrasena.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    const { rows } = await pool.query(
      `SELECT id_usuario, contrasena_hash FROM usuario WHERE id_usuario = $1`,
      [req.user.id_usuario]
    );

    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });

    const coincide = await bcrypt.compare(contrasenaActual, rows[0].contrasena_hash);
    if (!coincide) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta' });
    }

    const nuevoHash = await bcrypt.hash(nuevaContrasena, 10);
    await pool.query(
      `UPDATE usuario SET contrasena_hash = $1 WHERE id_usuario = $2`,
      [nuevoHash, req.user.id_usuario]
    );

    res.json({
      ok: true,
      mensaje: 'Su contraseña ha sido modificada con éxito.',
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;


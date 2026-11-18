// Servicio Centralizado de Envío de Correos Electrónicos y Plantillas - UNIMARKET BO
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { REGLAS_USO } = require('../utils/reglas');

const QR_PATH = path.join(__dirname, '..', '..', 'assets', 'qr-pago.png');

function escaparHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatearFecha(f) {
  if (!f) return '';
  const d = new Date(f);
  if (isNaN(d.getTime())) return String(f);
  return d.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getMailConfig() {
  const host = process.env.MAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.MAIL_PORT || process.env.SMTP_PORT, 10) || 465;
  const secure = (process.env.MAIL_SECURE || process.env.SMTP_SECURE) === 'true' || port === 465;
  const user = process.env.MAIL_USER || process.env.SMTP_USER || 'unimarketbo@gmail.com';
  const pass = process.env.MAIL_PASS || process.env.SMTP_PASS || '';
  const from = process.env.MAIL_FROM || `UNIMARKET BO <${user}>`;
  const adminNotify = process.env.ADMIN_NOTIFY_EMAIL || 'unimarketbo@gmail.com';
  const appUrl = process.env.APP_URL || 'http://localhost:5173';

  const banco = process.env.PAGO_BANCO || 'Banco Unión S.A.';
  const titular = process.env.PAGO_TITULAR || 'UNIMARKET BO';
  const cuenta = process.env.PAGO_CUENTA || '10000034567890';
  const tipoCuenta = process.env.PAGO_TIPO_CUENTA || 'Caja de Ahorros en Bs';
  const monto = process.env.PAGO_MONTO || '200';

  return { host, port, secure, user, pass, from, adminNotify, appUrl, banco, titular, cuenta, tipoCuenta, monto };
}

function smtpConfigurado() {
  const { pass } = getMailConfig();
  if (!pass) return false;
  if (pass.includes('CONTRASENA') || pass.includes('cambia_esta') || pass.length < 8) return false;
  return true;
}

function obtenerTransportador() {
  const { host, port, secure, user, pass } = getMailConfig();
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

/**
 * Envío genérico con reintentos (hasta 2 reintentos, 3 intentos en total)
 * Registra cada envío en la tabla notificacion_correo.
 * NUNCA lanza una excepción que interrumpa la transacción de la BD.
 */
async function enviarCorreo({ id_empresa = null, tipo, para, asunto, html, texto, adjuntarQr = false, adjuntos = [] }) {
  const config = getMailConfig();
  const destino = String(para || '').trim().toLowerCase();
  const listaAdjuntos = [...adjuntos];

  if (adjuntarQr) {
    if (fs.existsSync(QR_PATH)) {
      listaAdjuntos.push({
        filename: 'qr-pago.png',
        path: QR_PATH,
        cid: 'qr-pago',
      });
    }
  }

  // Si SMTP no tiene clave de aplicación real, simular envío con log estructurado
  if (!smtpConfigurado()) {
    console.log('\n================== [NOTIFICACIÓN POR CORREO (MODO SIMULACIÓN / LOG)] ==================');
    console.log(`Empresa ID: ${id_empresa || 'SISTEMA'}`);
    console.log(`Plantilla:  ${tipo}`);
    console.log(`Para:       ${destino}`);
    console.log(`De:         ${config.from}`);
    console.log(`Asunto:     ${asunto}`);
    console.log(`Adjuntos:   ${listaAdjuntos.map((a) => a.filename).join(', ') || 'Ninguno'}`);
    console.log(`------------------------------ Contenido Texto ------------------------------`);
    console.log(texto);
    console.log('======================================================================================\n');

    try {
      const res = await pool.query(
        `INSERT INTO notificacion_correo (id_empresa, tipo, destino, asunto, estado, error, intentos, fecha)
         VALUES ($1, $2, $3, $4, 'enviado', 'Simulado: clave de aplicación no configurada', 1, NOW())
         RETURNING id_notificacion`,
        [id_empresa, tipo, destino, asunto]
      );
      return { exito: true, simulado: true, id_notificacion: res.rows[0]?.id_notificacion };
    } catch (errDb) {
      console.error('Error registrando notificación simulada:', errDb.message);
      return { exito: true, simulado: true };
    }
  }

  // Intentar envío real con hasta 2 reintentos (3 intentos en total)
  let intentos = 0;
  let ultimoError = null;
  const maxIntentos = 3;

  while (intentos < maxIntentos) {
    intentos++;
    try {
      const transporter = obtenerTransportador();
      const info = await transporter.sendMail({
        from: config.from,
        to: destino,
        replyTo: config.adminNotify,
        subject: asunto,
        text: texto,
        html,
        attachments: listaAdjuntos,
      });

      // Registro exitoso en BD
      try {
        const res = await pool.query(
          `INSERT INTO notificacion_correo (id_empresa, tipo, destino, asunto, estado, error, intentos, fecha)
           VALUES ($1, $2, $3, $4, 'enviado', NULL, $5, NOW())
           RETURNING id_notificacion`,
          [id_empresa, tipo, destino, asunto, intentos]
        );
        return { exito: true, messageId: info.messageId, id_notificacion: res.rows[0]?.id_notificacion };
      } catch (errDb) {
        console.error('Error guardando notificación en BD:', errDb.message);
        return { exito: true, messageId: info.messageId };
      }
    } catch (err) {
      ultimoError = err;
      console.warn(`[REINTENTO ${intentos}/${maxIntentos}] Error enviando correo ${tipo} a ${destino}:`, err.message);
      if (intentos < maxIntentos) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  // Si fallaron todos los intentos, registrar fallo en BD
  try {
    const res = await pool.query(
      `INSERT INTO notificacion_correo (id_empresa, tipo, destino, asunto, estado, error, intentos, fecha)
       VALUES ($1, $2, $3, $4, 'fallido', $5, $6, NOW())
       RETURNING id_notificacion`,
      [id_empresa, tipo, destino, asunto, ultimoError ? ultimoError.message : 'Error desconocido', intentos]
    );
    return { exito: false, error: ultimoError ? ultimoError.message : 'Error', id_notificacion: res.rows[0]?.id_notificacion };
  } catch (errDb) {
    console.error('Error guardando fallo de notificación:', errDb.message);
    return { exito: false, error: ultimoError ? ultimoError.message : 'Error' };
  }
}

/**
 * Reenvío manual solicitado por el administrador
 */
async function reenviarNotificacion(id_notificacion) {
  const { rows } = await pool.query(
    `SELECT * FROM notificacion_correo WHERE id_notificacion = $1`,
    [id_notificacion]
  );
  if (!rows.length) throw new Error('Notificación no encontrada');
  const notif = rows[0];

  // Si tenemos empresa asociada, buscar sus datos reales
  let datosEmpresa = null;
  if (notif.id_empresa) {
    const emp = await pool.query(
      `SELECT e.*, u.usuario FROM empresa e JOIN usuario u ON u.id_usuario = e.id_usuario WHERE e.id_empresa = $1`,
      [notif.id_empresa]
    );
    if (emp.rows.length) datosEmpresa = emp.rows[0];
  }

  // Reconstruir plantilla según tipo
  let construido = null;
  switch (notif.tipo) {
    case 'cuenta_verificada':
    case 'aprobada':
      if (datosEmpresa) {
        construido = construirCorreoCuentaVerificada({
          razonSocial: datosEmpresa.razon_social,
          codigoPago: datosEmpresa.codigo_pago || 'UM-0001',
          usuario: datosEmpresa.usuario,
        });
      }
      break;
    case 'stock_bajo':
      if (datosEmpresa) {
        construido = construirCorreoStockBajo({
          razonSocial: datosEmpresa.razon_social,
          productos: [{ nombre: 'Productos de inventario', sku: 'Varios', stock_actual: 0, stock_minimo: 20, unidad: 'u.' }],
        });
      }
      break;
    case 'pago_confirmado':
      if (datosEmpresa) {
        construido = construirCorreoPagoConfirmado({
          razonSocial: datosEmpresa.razon_social,
          codigoPago: datosEmpresa.codigo_pago || 'UM-0001',
          fechaInicio: new Date(),
          fechaVencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          monto: '200.00',
          referencia: 'Confirmación manual',
          slug: datosEmpresa.slug,
        });
      }
      break;
    default:
      break;
  }

  if (construido) {
    return await enviarCorreo({
      id_empresa: notif.id_empresa,
      tipo: notif.tipo,
      para: notif.destino,
      asunto: construido.asunto,
      html: construido.html,
      texto: construido.texto,
      adjuntarQr: notif.tipo === 'cuenta_verificada' || notif.tipo === 'recordatorio_pago',
    });
  }

  // Fallback simple si no hay constructor específico
  return await enviarCorreo({
    id_empresa: notif.id_empresa,
    tipo: notif.tipo,
    para: notif.destino,
    asunto: notif.asunto || 'Reenvío de notificación UNIMARKET BO',
    html: `<p>Reenvío de notificación: ${notif.tipo}</p>`,
    texto: `Reenvío de notificación: ${notif.tipo}`,
  });
}

// -------------------------------------------------------------
// Layout HTML Estructurado y Responsive
// -------------------------------------------------------------

function layoutCorreo({ titulo, preheader, contenido }) {
  const config = getMailConfig();
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escaparHtml(titulo)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; -webkit-font-smoothing: antialiased;">
  <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0;">${escaparHtml(preheader || titulo)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0b0f19; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #111827; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
          <!-- Cabecera -->
          <tr>
            <td style="background: linear-gradient(135deg, #312e81 0%, #4338ca 50%, #6366f1 100%); padding: 28px 32px; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: rgba(255,255,255,0.2); color: #ffffff; font-weight: 800; font-size: 14px; padding: 6px 12px; border-radius: 8px; letter-spacing: 0.5px;">UM</span>
                    <span style="font-size: 20px; font-weight: 800; color: #ffffff; margin-left: 8px; letter-spacing: -0.5px;">UNIMARKET <span style="color: #a5b4fc;">BO</span></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Contenido Principal -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; background-color: #111827;">
              ${contenido}
            </td>
          </tr>
          <!-- Pie de página -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 32px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: #94a3b8; line-height: 1.6;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #cbd5e1;">UNIMARKET BO · Plataforma de Catálogos Digitales en Bolivia</p>
              <p style="margin: 0 0 8px 0;">Soporte y atención a empresas: <a href="mailto:${config.adminNotify}" style="color: #818cf8; text-decoration: none;">${config.adminNotify}</a></p>
              <p style="margin: 0; color: #64748b; font-size: 11px;">Este es un mensaje institucional generado por el sistema. Por favor conserve este correo para futuras referencias.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// -------------------------------------------------------------
// 1. REGISTRO RECIBIDO (A LA EMPRESA)
// -------------------------------------------------------------
function construirCorreoSolicitudRecibida({ razonSocial, nit, correo }) {
  const config = getMailConfig();
  const razon = escaparHtml(razonSocial);
  const nitEsc = escaparHtml(nit);
  const asunto = 'Solicitud de registro recibida en UNIMARKET BO';

  const html = layoutCorreo({
    titulo: asunto,
    preheader: `Hemos recibido la solicitud de ${razon}. Plazo de revisión: 24 a 48 horas.`,
    contenido: `
      <h1 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 16px 0;">
        ¡Solicitud de registro recibida con éxito!
      </h1>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Estimado/a representante de <strong>${razon}</strong>:
      </p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Hemos recibido correctamente su registro y el documento de NIT presentado para la verificación legal de su empresa.
      </p>

      <div style="background-color: rgba(255,255,255,0.05); border-left: 4px solid #6366f1; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px 0;">
        <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #a5b4fc; text-transform: uppercase;">Resumen de la solicitud</p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #e2e8f0;"><strong>Razón Social:</strong> ${razon}</p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #e2e8f0;"><strong>NIT:</strong> ${nitEsc}</p>
        <p style="margin: 0; font-size: 14px; color: #38bdf8;"><strong>Estado:</strong> Pendiente de verificación legal</p>
      </div>

      <div style="background-color: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.25); border-radius: 12px; padding: 20px; margin: 0 0 24px 0;">
        <h2 style="font-size: 15px; font-weight: 700; color: #c7d2fe; margin: 0 0 8px 0;">
          Plazo de revisión: 24 a 48 horas
        </h2>
        <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0;">
          Nuestro equipo administrativo revisará la autenticidad de su documento de NIT en un lapso de <strong>24 a 48 horas</strong>.
          Una vez verificado su registro, recibirá un correo electrónico con los datos de pago de su suscripción (Plan Único, Bs 200/mes) para activar su portal y publicar su catálogo.
        </p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <a href="${config.appUrl}/login" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px;">
              Ingresar a mi panel
            </a>
          </td>
        </tr>
      </table>
    `,
  });

  const texto = `¡SOLICITUD DE REGISTRO RECIBIDA CON ÉXITO!

Estimado/a representante de ${razonSocial}:
Hemos recibido correctamente su registro y el documento de NIT presentado para la verificación legal de su empresa.

RESUMEN:
- Razón Social: ${razonSocial}
- NIT: ${nit}
- Estado: Pendiente de verificación legal

PLAZO DE REVISIÓN: 24 a 48 horas
Una vez verificado su registro, recibirá un correo con los datos de pago para activar su tienda.

Enlace al panel: ${config.appUrl}/login
UNIMARKET BO - Soporte: ${config.adminNotify}`;

  return { asunto, html, texto };
}

// -------------------------------------------------------------
// 2. CUENTA VERIFICADA (CON QR EMBEBIDO Y CÓDIGO UM-XXXX)
// -------------------------------------------------------------
function construirCorreoCuentaVerificada({ razonSocial, codigoPago, usuario }) {
  const config = getMailConfig();
  const razon = escaparHtml(razonSocial);
  const cod = escaparHtml(codigoPago || 'UM-0001');
  const userEsc = escaparHtml(usuario || '');
  const asunto = 'Su cuenta en UNIMARKET BO fue verificada';

  const qrDisponible = fs.existsSync(QR_PATH);

  const html = layoutCorreo({
    titulo: asunto,
    preheader: `Su empresa ${razon} fue verificada. Realice el pago con código ${cod} para publicar su tienda.`,
    contenido: `
      <div style="background-color: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; padding: 16px 20px; margin: 0 0 24px 0;">
        <p style="font-size: 16px; font-weight: 800; color: #34d399; margin: 0 0 4px 0;">
          Cuenta legalmente verificada
        </p>
        <p style="font-size: 13px; color: #a7f3d0; margin: 0;">
          Su empresa fue verificada y su cuenta está activada, pero su tienda aún no es pública. Se publicará cuando confirmemos el pago de su suscripción.
        </p>
      </div>

      <h1 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 16px 0;">
        ¡Felicidades, ${razon}!
      </h1>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Su documentación fue aprobada con éxito. Ya puede ingresar a su panel con su usuario <strong>${userEsc}</strong> y la contraseña que registró para cargar sus productos y configurar su portal.
      </p>

      <!-- Bloque de Pago Destacado -->
      <div style="background-color: #1e1b4b; border: 2px solid #6366f1; border-radius: 16px; padding: 24px; margin: 0 0 24px 0;">
        <h2 style="font-size: 17px; font-weight: 800; color: #ffffff; margin: 0 0 16px 0; text-align: center;">
          Datos para la activación de su tienda (Plan Único Bs ${config.monto}/mes)
        </h2>

        <div style="background-color: rgba(255,255,255,0.06); border-radius: 12px; padding: 16px; margin: 0 0 20px 0; text-align: center;">
          <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #a5b4fc; font-weight: 700; display: block; margin-bottom: 4px;">
            SU CÓDIGO DE PAGO OBLIGATORIO
          </span>
          <span style="font-size: 28px; font-weight: 900; color: #38bdf8; letter-spacing: 2px; font-family: monospace;">
            ${cod}
          </span>
          <p style="font-size: 12px; color: #fef08a; font-weight: 600; margin: 8px 0 0 0;">
            Importante: Escriba este código en la glosa o concepto de su pago por QR o transferencia.
          </p>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="padding-bottom: 16px;">
              ${
                qrDisponible
                  ? `<img src="cid:qr-pago" alt="QR Simple para Pago de Suscripción UNIMARKET BO" style="max-width: 200px; width: 100%; height: auto; border-radius: 12px; border: 2px solid rgba(255,255,255,0.2); background-color: #ffffff; padding: 6px;" />`
                  : `<div style="background-color: rgba(255,255,255,0.05); padding: 16px; border-radius: 12px; color: #cbd5e1; font-size: 13px;">QR Simple disponible en su panel de empresa en Mi Suscripción</div>`
              }
            </td>
          </tr>
        </table>

        <div style="background-color: rgba(0,0,0,0.25); border-radius: 10px; padding: 14px 18px; font-size: 13px; color: #e2e8f0; line-height: 1.7;">
          <p style="margin: 0;"><strong>Banco:</strong> ${escaparHtml(config.banco)}</p>
          <p style="margin: 0;"><strong>Titular:</strong> ${escaparHtml(config.titular)}</p>
          <p style="margin: 0;"><strong>N° de Cuenta:</strong> <span style="font-family: monospace; font-weight: bold; color: #38bdf8;">${escaparHtml(config.cuenta)}</span> (${escaparHtml(config.tipoCuenta)})</p>
          <p style="margin: 0;"><strong>Monto:</strong> Bs ${config.monto}.00 (Plan Mensual)</p>
          <p style="margin: 0;"><strong>Glosa requerida:</strong> UNIMARKET BO - ${cod} - ${razon}</p>
        </div>
      </div>

      <!-- Pasos Siguientes -->
      <h3 style="font-size: 15px; font-weight: 700; color: #ffffff; margin: 0 0 12px 0;">
        Pasos para publicar su catálogo:
      </h3>
      <ol style="font-size: 13px; color: #cbd5e1; line-height: 1.8; margin: 0 0 24px 0; padding-left: 20px;">
        <li>Pague Bs ${config.monto} mediante el QR Simple o transferencia bancaria indicando su código <strong>${cod}</strong>.</li>
        <li>Ingrese a su panel con su usuario <strong>${userEsc}</strong> y la contraseña que registró.</li>
        <li>En la sección <strong>Mi suscripción</strong>, pulse <strong>"Subir comprobante"</strong> y adjunte la foto o captura del pago.</li>
        <li>Su tienda se activará y será visible para todo el país tras la confirmación administrativa (habitualmente dentro de 24 horas).</li>
        <li>Plazo sugerido para realizar el pago: <strong>7 días calendario</strong>.</li>
      </ol>

      <!-- Beneficios del Plan -->
      <div style="background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; margin: 0 0 24px 0;">
        <h4 style="font-size: 13px; font-weight: 700; color: #a5b4fc; text-transform: uppercase; margin: 0 0 10px 0;">
          Beneficios incluidos en su suscripción:
        </h4>
        <ul style="font-size: 12px; color: #cbd5e1; line-height: 1.7; margin: 0; padding-left: 18px;">
          <li>Catálogo digital propio con portal público web (sin comisiones por venta).</li>
          <li>Búsqueda avanzada y visibilidad nacional ante compradores.</li>
          <li>Contacto directo de compradores a su WhatsApp oficial.</li>
          <li>Control de inventario con alertas automáticas de stock bajo.</li>
          <li>Registro de ventas acordadas por WhatsApp con comprobantes en PDF.</li>
          <li>Reportes comerciales por día, mes, año y producto.</li>
        </ul>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <a href="${config.appUrl}/login" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 36px; border-radius: 10px;">
              Ingresar a mi cuenta y subir comprobante
            </a>
          </td>
        </tr>
      </table>
    `,
  });

  const texto = `SU CUENTA EN UNIMARKET BO FUE VERIFICADA

Estimado/a representante de ${razonSocial}:
Su empresa fue verificada y su cuenta está activada, pero su tienda aún no es pública. Se publicará cuando confirmemos el pago de su suscripción.

DATOS PARA LA ACTIVACIÓN (Plan Único Bs ${config.monto}/mes):
- Código de pago obligatorio: ${codigoPago} (escríbalo en la glosa o concepto de su pago)
- Banco: ${config.banco}
- Titular: ${config.titular}
- Cuenta: ${config.cuenta} (${config.tipoCuenta})
- Monto: Bs ${config.monto}.00
- Glosa requerida: UNIMARKET BO - ${codigoPago} - ${razonSocial}

PASOS:
1) Pague por QR o transferencia bancaria con el código ${codigoPago}.
2) Ingrese con el usuario ${usuario} y la contraseña que registró.
3) En "Mi suscripción", pulse "Subir comprobante".
4) Su tienda se activará al confirmar el pago (habitualmente dentro de 24 horas).
Plazo sugerido: 7 días.

Acceso al panel: ${config.appUrl}/login
Soporte: ${config.adminNotify}
UNIMARKET BO`;

  return { asunto, html, texto };
}

// -------------------------------------------------------------
// 3. OBSERVADA (A LA EMPRESA)
// -------------------------------------------------------------
function construirCorreoObservacion({ razonSocial, motivo }) {
  const config = getMailConfig();
  const razon = escaparHtml(razonSocial);
  const mot = escaparHtml(motivo || 'Documento NIT ilegible o no coincidente con el padrón.');
  const asunto = 'Observación en la verificación de su empresa en UNIMARKET BO';

  const html = layoutCorreo({
    titulo: asunto,
    preheader: `Su solicitud requiere una corrección: ${mot}`,
    contenido: `
      <h1 style="font-size: 22px; font-weight: 800; color: #fbbf24; margin: 0 0 16px 0;">
        Observación en su registro
      </h1>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Estimado/a representante de <strong>${razon}</strong>:
      </p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Durante la revisión de su solicitud de verificación, el equipo administrativo identificó la siguiente observación que requiere ser corregida:
      </p>

      <div style="background-color: rgba(245,158,11,0.1); border-left: 4px solid #f59e0b; border-radius: 8px; padding: 18px 20px; margin: 0 0 24px 0;">
        <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #fde68a; text-transform: uppercase;">Detalle de la observación</p>
        <p style="margin: 0; font-size: 14px; color: #ffffff; font-weight: 600;">${mot}</p>
      </div>

      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 24px 0;">
        Para corregir esta observación, por favor ingrese a su panel con su usuario y contraseña, y en la sección de inicio suba el documento corregido. Su solicitud será reevaluada prioritariamente sin necesidad de crear un nuevo registro.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <a href="${config.appUrl}/login" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px;">
              Ingresar y corregir documento
            </a>
          </td>
        </tr>
      </table>
    `,
  });

  const texto = `OBSERVACIÓN EN SU REGISTRO - UNIMARKET BO

Estimado/a representante de ${razonSocial}:
Durante la revisión de su solicitud se identificó la siguiente observación:

MOTIVO:
${motivo}

Para corregirlo, ingrese a su panel en ${config.appUrl}/login y adjunte el documento corregido.

Soporte: ${config.adminNotify}`;

  return { asunto, html, texto };
}

// -------------------------------------------------------------
// 4. RECHAZADA (A LA EMPRESA)
// -------------------------------------------------------------
function construirCorreoRechazo({ razonSocial, motivo }) {
  const config = getMailConfig();
  const razon = escaparHtml(razonSocial);
  const mot = escaparHtml(motivo || 'No cumple con las políticas de registro comercial.');
  const asunto = 'Solicitud de verificación no aprobada en UNIMARKET BO';

  const html = layoutCorreo({
    titulo: asunto,
    preheader: `Información sobre su solicitud de registro para ${razon}.`,
    contenido: `
      <h1 style="font-size: 22px; font-weight: 800; color: #f87171; margin: 0 0 16px 0;">
        Solicitud de registro no aprobada
      </h1>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Estimado/a representante de <strong>${razon}</strong>:
      </p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Le informamos que luego de la evaluación legal y tributaria correspondiente, su solicitud de verificación no pudo ser aprobada por el siguiente motivo:
      </p>

      <div style="background-color: rgba(239,68,68,0.1); border-left: 4px solid #ef4444; border-radius: 8px; padding: 18px 20px; margin: 0 0 24px 0;">
        <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #fca5a5; text-transform: uppercase;">Motivo del rechazo</p>
        <p style="margin: 0; font-size: 14px; color: #ffffff; font-weight: 600;">${mot}</p>
      </div>

      <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; margin: 0;">
        Si considera que existe algún error o desea mayor información sobre los requisitos de admisibilidad comercial, puede comunicarse directamente con nuestro equipo de soporte a <a href="mailto:${config.adminNotify}" style="color: #818cf8;">${config.adminNotify}</a>.
      </p>
    `,
  });

  const texto = `SOLICITUD DE REGISTRO NO APROBADA - UNIMARKET BO

Estimado/a representante de ${razonSocial}:
Le informamos que su solicitud de registro no pudo ser aprobada.

MOTIVO:
${motivo}

Para consultas: ${config.adminNotify}`;

  return { asunto, html, texto };
}

// -------------------------------------------------------------
// 5. COMPROBANTE RECIBIDO (A LA EMPRESA TRAS SUBIR PAGO)
// -------------------------------------------------------------
function construirCorreoComprobanteRecibido({ razonSocial, codigoPago, monto, referencia, banco }) {
  const config = getMailConfig();
  const razon = escaparHtml(razonSocial);
  const cod = escaparHtml(codigoPago || 'UM-0001');
  const ref = escaparHtml(referencia || 'N/A');
  const bco = escaparHtml(banco || 'QR / Transferencia');
  const asunto = 'Comprobante de pago recibido en UNIMARKET BO';

  const html = layoutCorreo({
    titulo: asunto,
    preheader: `Recibimos su comprobante de pago por Bs ${monto}. Revisión habitual dentro de 24 horas.`,
    contenido: `
      <div style="background-color: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.3); border-radius: 12px; padding: 16px 20px; margin: 0 0 24px 0;">
        <p style="font-size: 16px; font-weight: 800; color: #38bdf8; margin: 0 0 4px 0;">
          Comprobante en revisión
        </p>
        <p style="font-size: 13px; color: #bae6fd; margin: 0;">
          Recibimos su comprobante, lo revisaremos en breve (revisión habitual dentro de 24 horas).
        </p>
      </div>

      <h1 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 16px 0;">
        Hemos recibido su comprobante de pago
      </h1>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Estimado/a representante de <strong>${razon}</strong>:
      </p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Confirmamos la recepción de su comprobante de pago para la activación de su suscripción en UNIMARKET BO.
      </p>

      <div style="background-color: rgba(255,255,255,0.05); border-radius: 12px; padding: 18px 20px; margin: 0 0 24px 0; font-size: 14px; line-height: 1.8;">
        <p style="margin: 0;"><strong>Código de Empresa:</strong> <span style="font-family: monospace; color: #38bdf8; font-weight: bold;">${cod}</span></p>
        <p style="margin: 0;"><strong>Monto declarado:</strong> Bs ${monto}</p>
        <p style="margin: 0;"><strong>Banco / Medio:</strong> ${bco}</p>
        <p style="margin: 0;"><strong>N° de Referencia:</strong> ${ref}</p>
        <p style="margin: 0;"><strong>Estado:</strong> En revisión administrativa</p>
      </div>

      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 24px 0;">
        Una vez que verifiquemos el depósito bancario, su suscripción quedará activa por 30 días calendario y su tienda con catálogo de productos pasará a ser pública de forma inmediata.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <a href="${config.appUrl}/panel" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px;">
              Ver estado en mi panel
            </a>
          </td>
        </tr>
      </table>
    `,
  });

  const texto = `COMPROBANTE DE PAGO RECIBIDO - UNIMARKET BO

Estimado/a representante de ${razonSocial}:
Recibimos su comprobante, lo revisaremos en breve (revisión habitual dentro de 24 horas).

DETALLES:
- Código de empresa: ${codigoPago}
- Monto: Bs ${monto}
- Banco/Medio: ${banco}
- Referencia: ${referencia}
- Estado: En revisión

Su tienda se activará tan pronto confirmemos el depósito.
UNIMARKET BO - Soporte: ${config.adminNotify}`;

  return { asunto, html, texto };
}

// -------------------------------------------------------------
// 6. PAGO CONFIRMADO / SUSCRIPCIÓN ACTIVA (A LA EMPRESA TRAS CONFIRMAR ADMIN)
// -------------------------------------------------------------
function construirCorreoPagoConfirmado({ razonSocial, codigoPago, fechaInicio, fechaVencimiento, monto, referencia, slug }) {
  const config = getMailConfig();
  const razon = escaparHtml(razonSocial);
  const cod = escaparHtml(codigoPago || 'UM-0001');
  const inicio = formatearFecha(fechaInicio);
  const fin = formatearFecha(fechaVencimiento);
  const mto = escaparHtml(monto || '200.00');
  const ref = escaparHtml(referencia || 'Depósito verificado');
  const urlTienda = `${config.appUrl}/tienda/${slug || 'mi-tienda'}`;
  const asunto = '¡Su suscripción en UNIMARKET BO está activa!';

  const html = layoutCorreo({
    titulo: asunto,
    preheader: `Su tienda oficial ya está pública. Suscripción activa hasta el ${fin}.`,
    contenido: `
      <div style="background-color: rgba(16,185,129,0.15); border: 2px solid #10b981; border-radius: 16px; padding: 24px; margin: 0 0 24px 0; text-align: center;">
        <span style="font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; color: #6ee7b7; font-weight: 800; display: block; margin-bottom: 6px;">
          SUSCRIPCIÓN ACTIVA Y CATÁLOGO PUBLICADO
        </span>
        <h1 style="font-size: 26px; font-weight: 900; color: #ffffff; margin: 0 0 8px 0;">
          ¡Su tienda oficial ya está visible al público!
        </h1>
        <p style="font-size: 15px; color: #a7f3d0; margin: 0; font-weight: 600;">
          ACTIVA HASTA EL ${fin}
        </p>
      </div>

      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Estimado/a representante de <strong>${razon}</strong>:
      </p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Hemos confirmado satisfactoriamente su pago de <strong>Bs ${mto}</strong> (Referencia: ${ref}). Su portal empresarial y catálogo de productos ya están disponibles públicamente en todo el territorio nacional.
      </p>

      <div style="background-color: rgba(255,255,255,0.05); border-radius: 12px; padding: 18px 20px; margin: 0 0 24px 0; font-size: 14px; line-height: 1.8;">
        <p style="margin: 0;"><strong>Plan:</strong> Plan Único Mensual (Bs ${config.monto}/mes)</p>
        <p style="margin: 0;"><strong>Código de Empresa:</strong> <span style="font-family: monospace; color: #38bdf8; font-weight: bold;">${cod}</span></p>
        <p style="margin: 0;"><strong>Fecha de Inicio:</strong> ${inicio}</p>
        <p style="margin: 0;"><strong>Vencimiento:</strong> <strong style="color: #34d399;">${fin}</strong></p>
        <p style="margin: 0;"><strong>Enlace oficial de su tienda:</strong> <a href="${urlTienda}" style="color: #38bdf8; text-decoration: underline; word-break: break-all;">${urlTienda}</a></p>
      </div>

      <!-- Beneficios Activos -->
      <div style="background-color: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); border-radius: 12px; padding: 20px; margin: 0 0 24px 0;">
        <h3 style="font-size: 14px; font-weight: 700; color: #c7d2fe; text-transform: uppercase; margin: 0 0 12px 0;">
          Servicios habilitados en su cuenta:
        </h3>
        <ul style="font-size: 13px; color: #cbd5e1; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li><strong>Catálogo digital propio:</strong> portal web exclusivo con logo, portada, descripción y productos.</li>
          <li><strong>Portal individual:</strong> enlace oficial listo para compartir en redes sociales y tarjetas de presentación.</li>
          <li><strong>Búsqueda avanzada:</strong> sus productos aparecen en los resultados por palabra clave, marca, modelo y categoría.</li>
          <li><strong>Contacto por WhatsApp:</strong> botón directo en cada producto para recibir pedidos sin comisiones.</li>
          <li><strong>Control de inventario:</strong> alertas automáticas por correo electrónico cuando sus existencias sean bajas.</li>
          <li><strong>Facturación y comprobantes:</strong> registro de ventas con generación instantánea de comprobantes en PDF (A4 y ticket).</li>
          <li><strong>Reportes comerciales:</strong> gráficos y estadísticas descargables por período y por producto.</li>
        </ul>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="padding-bottom: 12px;">
            <a href="${urlTienda}" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 10px; margin-right: 8px;">
              Visitar mi tienda pública
            </a>
            <a href="${config.appUrl}/panel" style="display: inline-block; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #ffffff; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 28px; border-radius: 10px;">
              Ir al panel de gestión
            </a>
          </td>
        </tr>
      </table>
    `,
  });

  const texto = `¡SU SUSCRIPCIÓN ESTÁ ACTIVA EN UNIMARKET BO!

Estimado/a representante de ${razonSocial}:
Su pago de Bs ${mto} fue confirmado satisfactoriamente. Su tienda oficial ya es pública en UNIMARKET BO.

DATOS DE SUSCRIPCIÓN:
- Plan: Plan Único (Bs 200/mes)
- Código de empresa: ${codigoPago}
- Inicio: ${inicio}
- ACTIVA HASTA: ${fin}
- Enlace público de su tienda: ${urlTienda}

BENEFICIOS ACTIVOS:
- Catálogo digital propio
- Portal individual
- Búsqueda avanzada
- Contacto por WhatsApp sin comisiones
- Control de inventario con alertas
- Registro de ventas y comprobantes en PDF
- Reportes comerciales

Panel de administración: ${config.appUrl}/panel
UNIMARKET BO - Soporte: ${config.adminNotify}`;

  return { asunto, html, texto };
}

// -------------------------------------------------------------
// 7. COMPROBANTE RECHAZADO (A LA EMPRESA TRAS RECHAZO ADMIN)
// -------------------------------------------------------------
function construirCorreoComprobanteRechazado({ razonSocial, codigoPago, motivo }) {
  const config = getMailConfig();
  const razon = escaparHtml(razonSocial);
  const cod = escaparHtml(codigoPago || 'UM-0001');
  const mot = escaparHtml(motivo || 'El depósito no figura en nuestro extracto bancario.');
  const asunto = 'Observación en comprobante de pago en UNIMARKET BO';

  const html = layoutCorreo({
    titulo: asunto,
    preheader: `Su comprobante no pudo ser confirmado: ${mot}`,
    contenido: `
      <h1 style="font-size: 22px; font-weight: 800; color: #f87171; margin: 0 0 16px 0;">
        Comprobante de pago observado
      </h1>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Estimado/a representante de <strong>${razon}</strong>:
      </p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Le informamos que el comprobante de pago enviado para el código de empresa <strong>${cod}</strong> no pudo ser confirmado por el siguiente motivo:
      </p>

      <div style="background-color: rgba(239,68,68,0.1); border-left: 4px solid #ef4444; border-radius: 8px; padding: 18px 20px; margin: 0 0 24px 0;">
        <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #fca5a5; text-transform: uppercase;">Motivo del rechazo</p>
        <p style="margin: 0; font-size: 14px; color: #ffffff; font-weight: 600;">${mot}</p>
      </div>

      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 24px 0;">
        Por favor ingrese a su panel en la sección <strong>Mi suscripción</strong> y adjunte nuevamente el comprobante correcto (legible, con número de transacción y fecha visible).
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <a href="${config.appUrl}/panel" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px;">
              Ingresar y subir nuevo comprobante
            </a>
          </td>
        </tr>
      </table>
    `,
  });

  const texto = `COMPROBANTE DE PAGO OBSERVADO - UNIMARKET BO

Estimado/a representante de ${razonSocial}:
Su comprobante para el código ${codigoPago} no pudo ser confirmado.

MOTIVO:
${motivo}

Ingrese a su panel para subir el comprobante correcto: ${config.appUrl}/panel
Soporte: ${config.adminNotify}`;

  return { asunto, html, texto };
}

// -------------------------------------------------------------
// 8. RECORDATORIO DE PAGO PENDIENTE (A LA EMPRESA DÍAS 3, 6, 7)
// -------------------------------------------------------------
function construirCorreoRecordatorioPago({ razonSocial, codigoPago, diasTranscurridos }) {
  const config = getMailConfig();
  const razon = escaparHtml(razonSocial);
  const cod = escaparHtml(codigoPago || 'UM-0001');
  const dias = parseInt(diasTranscurridos, 10) || 3;
  const esPlazoCumplido = dias >= 7;

  const asunto = esPlazoCumplido
    ? 'Plazo sugerido de pago cumplido para su tienda en UNIMARKET BO'
    : `Recordatorio: Active su tienda oficial en UNIMARKET BO (${cod})`;

  const qrDisponible = fs.existsSync(QR_PATH);

  const html = layoutCorreo({
    titulo: asunto,
    preheader: `Active su tienda oficial con su código ${cod}. Pago único Bs ${config.monto}/mes.`,
    contenido: `
      <h1 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 16px 0;">
        ${esPlazoCumplido ? 'Plazo sugerido de pago cumplido' : '¡Su tienda oficial está lista para ser publicada!'}
      </h1>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Estimado/a representante de <strong>${razon}</strong>:
      </p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        ${
          esPlazoCumplido
            ? `Han transcurrido 7 días desde la verificación de su empresa. Su cuenta <strong>no se ha eliminado</strong> y sus datos se encuentran a salvo, pero su catálogo aún no es visible para compradores en UNIMARKET BO.`
            : `Le recordamos que su empresa fue verificada exitosamente. Para que su tienda y catálogo sean visibles ante compradores de toda Bolivia, realice el pago de su suscripción mensual.`
        }
      </p>

      <!-- Bloque de Pago -->
      <div style="background-color: #1e1b4b; border: 2px solid #6366f1; border-radius: 16px; padding: 24px; margin: 0 0 24px 0;">
        <div style="background-color: rgba(255,255,255,0.06); border-radius: 12px; padding: 14px; margin: 0 0 16px 0; text-align: center;">
          <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #a5b4fc; font-weight: 700; display: block; margin-bottom: 4px;">
            CÓDIGO DE PAGO
          </span>
          <span style="font-size: 26px; font-weight: 900; color: #38bdf8; letter-spacing: 2px; font-family: monospace;">
            ${cod}
          </span>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="padding-bottom: 14px;">
              ${
                qrDisponible
                  ? `<img src="cid:qr-pago" alt="QR Simple para Pago de Suscripción UNIMARKET BO" style="max-width: 180px; width: 100%; height: auto; border-radius: 12px; border: 2px solid rgba(255,255,255,0.2); background-color: #ffffff; padding: 6px;" />`
                  : `<div style="background-color: rgba(255,255,255,0.05); padding: 14px; border-radius: 12px; color: #cbd5e1; font-size: 13px;">QR Simple disponible en Mi Suscripción</div>`
              }
            </td>
          </tr>
        </table>

        <div style="background-color: rgba(0,0,0,0.25); border-radius: 10px; padding: 14px 18px; font-size: 13px; color: #e2e8f0; line-height: 1.7;">
          <p style="margin: 0;"><strong>Banco:</strong> ${escaparHtml(config.banco)}</p>
          <p style="margin: 0;"><strong>N° de Cuenta:</strong> ${escaparHtml(config.cuenta)} (${escaparHtml(config.tipoCuenta)})</p>
          <p style="margin: 0;"><strong>Monto:</strong> Bs ${config.monto}.00</p>
          <p style="margin: 0;"><strong>Glosa:</strong> UNIMARKET BO - ${cod} - ${razon}</p>
        </div>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <a href="${config.appUrl}/panel" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px;">
              Ingresar al panel y subir comprobante
            </a>
          </td>
        </tr>
      </table>
    `,
  });

  const texto = `RECORDATORIO DE PAGO - UNIMARKET BO

Estimado/a representante de ${razonSocial}:
${
  esPlazoCumplido
    ? 'Se ha cumplido el plazo sugerido de 7 días. Su cuenta se conserva activa, pero su tienda aún no es visible.'
    : 'Le recordamos activar su tienda oficial mediante el pago de su suscripción.'
}

Código de pago: ${codigoPago}
Banco: ${config.banco} | Cuenta: ${config.cuenta}
Monto: Bs ${config.monto}.00

Acceda a su panel para subir el comprobante: ${config.appUrl}/panel
UNIMARKET BO - Soporte: ${config.adminNotify}`;

  return { asunto, html, texto };
}

// -------------------------------------------------------------
// 9. RECORDATORIO DE VENCIMIENTO DE SUSCRIPCIÓN (DÍAS 7, 3, 1 Y DÍA 0)
// -------------------------------------------------------------
function construirCorreoRecordatorioVencimiento({ razonSocial, codigoPago, fechaVencimiento, diasRestantes }) {
  const config = getMailConfig();
  const razon = escaparHtml(razonSocial);
  const cod = escaparHtml(codigoPago || 'UM-0001');
  const fin = formatearFecha(fechaVencimiento);
  const dias = parseInt(diasRestantes, 10);
  const esVencido = dias <= 0;

  const asunto = esVencido
    ? 'Su suscripción en UNIMARKET BO ha vencido'
    : `Su suscripción en UNIMARKET BO vence en ${dias} día${dias === 1 ? '' : 's'}`;

  const qrDisponible = fs.existsSync(QR_PATH);

  const html = layoutCorreo({
    titulo: asunto,
    preheader: esVencido
      ? `Su suscripción venció el ${fin}. Renueve para republicar su catálogo.`
      : `Su suscripción vence el ${fin}. Renueve anticipadamente sin interrupciones.`,
    contenido: `
      <div style="background-color: ${esVencido ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}; border: 1px solid ${esVencido ? '#ef4444' : '#f59e0b'}; border-radius: 12px; padding: 18px 20px; margin: 0 0 24px 0;">
        <h2 style="font-size: 17px; font-weight: 800; color: ${esVencido ? '#f87171' : '#fde68a'}; margin: 0 0 6px 0;">
          ${esVencido ? 'Suscripción vencida' : `Vencimiento próximo: ${dias} día${dias === 1 ? '' : 's'} restante${dias === 1 ? '' : 's'}`}
        </h2>
        <p style="font-size: 13px; color: #cbd5e1; margin: 0;">
          ${
            esVencido
              ? `Su catálogo ha dejado de ser visible para el público. Sus datos y productos están perfectamente conservados.`
              : `Fecha límite de su período actual: <strong>${fin}</strong>. Puede renovar ahora mismo y sus nuevos 30 días se sumarán a su vigencia.`
          }
        </p>
      </div>

      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Estimado/a representante de <strong>${razon}</strong>:
      </p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Para mantener o reactivar la publicación de sus productos, la recepción de pedidos por WhatsApp y el acceso a sus comprobantes de venta, realice la renovación de su plan:
      </p>

      <!-- Bloque de Pago -->
      <div style="background-color: #1e1b4b; border: 2px solid #6366f1; border-radius: 16px; padding: 24px; margin: 0 0 24px 0;">
        <div style="background-color: rgba(255,255,255,0.06); border-radius: 12px; padding: 14px; margin: 0 0 16px 0; text-align: center;">
          <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #a5b4fc; font-weight: 700; display: block; margin-bottom: 4px;">
            SU CÓDIGO DE RENOVACIÓN
          </span>
          <span style="font-size: 26px; font-weight: 900; color: #38bdf8; letter-spacing: 2px; font-family: monospace;">
            ${cod}
          </span>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="padding-bottom: 14px;">
              ${
                qrDisponible
                  ? `<img src="cid:qr-pago" alt="QR Simple para Renovación UNIMARKET BO" style="max-width: 180px; width: 100%; height: auto; border-radius: 12px; border: 2px solid rgba(255,255,255,0.2); background-color: #ffffff; padding: 6px;" />`
                  : `<div style="background-color: rgba(255,255,255,0.05); padding: 14px; border-radius: 12px; color: #cbd5e1; font-size: 13px;">QR Simple disponible en Mi Suscripción</div>`
              }
            </td>
          </tr>
        </table>

        <div style="background-color: rgba(0,0,0,0.25); border-radius: 10px; padding: 14px 18px; font-size: 13px; color: #e2e8f0; line-height: 1.7;">
          <p style="margin: 0;"><strong>Banco:</strong> ${escaparHtml(config.banco)}</p>
          <p style="margin: 0;"><strong>Cuenta:</strong> ${escaparHtml(config.cuenta)}</p>
          <p style="margin: 0;"><strong>Monto:</strong> Bs ${config.monto}.00 (30 días adicionales)</p>
          <p style="margin: 0;"><strong>Glosa:</strong> UNIMARKET BO - ${cod} - ${razon}</p>
        </div>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <a href="${config.appUrl}/panel" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px;">
              Subir comprobante de renovación
            </a>
          </td>
        </tr>
      </table>
    `,
  });

  const texto = `${asunto.toUpperCase()} - UNIMARKET BO

Estimado/a representante de ${razonSocial}:
${
  esVencido
    ? `Su suscripción venció el ${fin}. Renueve para republicar su tienda.`
    : `Su suscripción vence el ${fin} (${dias} días restantes).`
}

DATOS PARA RENOVAR:
- Código: ${codigoPago}
- Banco: ${config.banco} | Cuenta: ${config.cuenta}
- Monto: Bs ${config.monto}.00
- Glosa: UNIMARKET BO - ${codigoPago} - ${razonSocial}

Suba su comprobante en: ${config.appUrl}/panel
UNIMARKET BO - Soporte: ${config.adminNotify}`;

  return { asunto, html, texto };
}

// -------------------------------------------------------------
// 10. ALERTA DE STOCK BAJO (A LA EMPRESA)
// -------------------------------------------------------------
function construirCorreoStockBajo({ razonSocial, productos }) {
  const config = getMailConfig();
  const razon = escaparHtml(razonSocial);
  const total = productos.length;
  const asunto = `Alerta de inventario: ${total} producto${total === 1 ? '' : 's'} con stock bajo en UNIMARKET BO`;

  let filasHtml = '';
  let filasTexto = '';

  productos.forEach((p) => {
    const nombre = escaparHtml(p.nombre);
    const sku = escaparHtml(p.sku || 'Sin SKU');
    const actual = parseInt(p.stock_actual, 10) || 0;
    const minimo = parseInt(p.stock_minimo, 10) || 20;
    const unidad = escaparHtml(p.unidad || 'u.');
    const agotado = actual === 0;

    filasHtml += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
        <td style="padding: 12px 10px; font-size: 13px; color: #ffffff; font-weight: 600;">
          ${nombre}
          <span style="display: block; font-size: 11px; color: #38bdf8; font-family: monospace;">SKU: ${sku}</span>
        </td>
        <td style="padding: 12px 10px; font-size: 13px; text-align: center; font-weight: 700; color: ${agotado ? '#f87171' : '#fde047'};">
          ${actual} ${unidad}
          ${agotado ? '<span style="display: block; font-size: 10px; color: #ef4444; text-transform: uppercase;">Agotado</span>' : ''}
        </td>
        <td style="padding: 12px 10px; font-size: 13px; text-align: center; color: #94a3b8;">
          ${minimo} ${unidad}
        </td>
      </tr>
    `;

    filasTexto += `• ${p.nombre} (SKU: ${p.sku || 'N/A'}) - Stock actual: ${actual} ${unidad} (Mínimo: ${minimo} ${unidad}) ${agotado ? '[AGOTADO]' : ''}\n`;
  });

  const html = layoutCorreo({
    titulo: asunto,
    preheader: `Atención: ${total} producto(s) alcanzaron su nivel mínimo de existencias.`,
    contenido: `
      <h1 style="font-size: 22px; font-weight: 800; color: #facc15; margin: 0 0 16px 0;">
        Alerta de stock bajo en su inventario
      </h1>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Estimado/a representante de <strong>${razon}</strong>:
      </p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        El sistema ha detectado que los siguientes productos han alcanzado o se encuentran por debajo del nivel de <strong>stock mínimo configurado</strong>:
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; margin: 0 0 24px 0; overflow: hidden;">
        <thead>
          <tr style="background-color: rgba(255,255,255,0.06); text-align: left; font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px;">
            <th style="padding: 12px 10px;">Producto / SKU</th>
            <th style="padding: 12px 10px; text-align: center;">Stock actual</th>
            <th style="padding: 12px 10px; text-align: center;">Mínimo</th>
          </tr>
        </thead>
        <tbody>
          ${filasHtml}
        </tbody>
      </table>

      <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; margin: 0 0 24px 0;">
        <em>Recuerde que los productos con stock en 0 se marcan automáticamente como <strong>"Agotado"</strong> en el catálogo público para evitar que sus clientes soliciten artículos sin disponibilidad.</em>
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <a href="${config.appUrl}/panel" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px;">
              Ir a mi inventario y reponer stock
            </a>
          </td>
        </tr>
      </table>
    `,
  });

  const texto = `ALERTA DE STOCK BAJO - UNIMARKET BO

Estimado/a representante de ${razonSocial}:
Se ha detectado stock bajo en los siguientes productos:

${filasTexto}
Los productos con stock en 0 se muestran como "Agotado" en el catálogo público.
Ingrese a su panel para reponer stock: ${config.appUrl}/panel
UNIMARKET BO`;

  return { asunto, html, texto };
}

// -------------------------------------------------------------
// 11. AVISO AL ADMIN DE NUEVO REGISTRO
// -------------------------------------------------------------
function construirCorreoAvisoAdminRegistro({ razonSocial, nit, rubro, telefono, correo, ciudad }) {
  const config = getMailConfig();
  const razon = escaparHtml(razonSocial);
  const nitEsc = escaparHtml(nit);
  const rub = escaparHtml(rubro || 'General');
  const tel = escaparHtml(telefono || 'N/A');
  const cor = escaparHtml(correo || 'N/A');
  const ciu = escaparHtml(ciudad || 'Bolivia');
  const asunto = `Nueva empresa registrada para revisión NIT: ${razonSocial} (NIT: ${nit})`;

  const html = layoutCorreo({
    titulo: asunto,
    preheader: `Revisión pendiente: ${razon} ha subido su NIT para verificación.`,
    contenido: `
      <div style="background-color: rgba(99,102,241,0.15); border-left: 4px solid #6366f1; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px 0;">
        <span style="font-size: 12px; font-weight: 700; color: #a5b4fc; text-transform: uppercase;">Aviso para el Administrador</span>
        <h1 style="font-size: 20px; font-weight: 800; color: #ffffff; margin: 6px 0 0 0;">
          Nueva solicitud de verificación NIT
        </h1>
      </div>

      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Se ha registrado una nueva empresa en UNIMARKET BO y se encuentra en espera de revisión de su documento legal:
      </p>

      <div style="background-color: rgba(255,255,255,0.05); border-radius: 12px; padding: 18px 20px; margin: 0 0 24px 0; font-size: 14px; line-height: 1.8;">
        <p style="margin: 0;"><strong>Razón Social:</strong> ${razon}</p>
        <p style="margin: 0;"><strong>NIT:</strong> <span style="font-family: monospace; color: #38bdf8; font-weight: bold;">${nitEsc}</span></p>
        <p style="margin: 0;"><strong>Rubro / Categoría:</strong> ${rub}</p>
        <p style="margin: 0;"><strong>Ciudad / Ubicación:</strong> ${ciu}</p>
        <p style="margin: 0;"><strong>Teléfono / WhatsApp:</strong> ${tel}</p>
        <p style="margin: 0;"><strong>Correo de contacto:</strong> ${cor}</p>
        <p style="margin: 0;"><strong>Fecha de solicitud:</strong> ${formatearFecha(new Date())}</p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <a href="${config.appUrl}/admin" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px;">
              Revisar solicitud en Panel Admin
            </a>
          </td>
        </tr>
      </table>
    `,
  });

  const texto = `NUEVA EMPRESA REGISTRADA EN UNIMARKET BO

- Razón Social: ${razonSocial}
- NIT: ${nit}
- Rubro: ${rubro || 'General'}
- Teléfono: ${telefono || 'N/A'}
- Correo: ${correo}
- Ciudad: ${ciudad || 'Bolivia'}

Revise la solicitud en: ${config.appUrl}/admin`;

  return { asunto, html, texto };
}

// -------------------------------------------------------------
// 12. AVISO AL ADMIN DE NUEVO COMPROBANTE DE PAGO
// -------------------------------------------------------------
function construirCorreoAvisoAdminComprobante({ razonSocial, codigoPago, monto, referencia, banco }) {
  const config = getMailConfig();
  const razon = escaparHtml(razonSocial);
  const cod = escaparHtml(codigoPago || 'UM-0001');
  const mto = escaparHtml(monto || '200.00');
  const ref = escaparHtml(referencia || 'N/A');
  const bco = escaparHtml(banco || 'QR / Transferencia');
  const asunto = `Nuevo comprobante de pago recibido: ${razonSocial} (${codigoPago}) - Bs ${monto}`;

  const html = layoutCorreo({
    titulo: asunto,
    preheader: `Comprobante de ${razon} por Bs ${mto} listo para confirmación bancaria.`,
    contenido: `
      <div style="background-color: rgba(56,189,248,0.15); border-left: 4px solid #38bdf8; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px 0;">
        <span style="font-size: 12px; font-weight: 700; color: #7dd3fc; text-transform: uppercase;">Aviso para el Administrador</span>
        <h1 style="font-size: 20px; font-weight: 800; color: #ffffff; margin: 6px 0 0 0;">
          Nuevo comprobante de pago subido
        </h1>
      </div>

      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        La siguiente empresa ha reportado su pago de suscripción y se encuentra en espera de confirmación bancaria:
      </p>

      <div style="background-color: rgba(255,255,255,0.05); border-radius: 12px; padding: 18px 20px; margin: 0 0 24px 0; font-size: 14px; line-height: 1.8;">
        <p style="margin: 0;"><strong>Empresa:</strong> ${razon}</p>
        <p style="margin: 0;"><strong>Código de Pago:</strong> <span style="font-family: monospace; color: #38bdf8; font-weight: bold;">${cod}</span></p>
        <p style="margin: 0;"><strong>Monto declarado:</strong> <span style="font-weight: bold; color: #34d399;">Bs ${mto}</span></p>
        <p style="margin: 0;"><strong>Banco / App:</strong> ${bco}</p>
        <p style="margin: 0;"><strong>N° Transacción / Referencia:</strong> <span style="font-family: monospace;">${ref}</span></p>
        <p style="margin: 0;"><strong>Fecha de envío:</strong> ${formatearFecha(new Date())}</p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <a href="${config.appUrl}/admin" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px;">
              Revisar pago en Panel Admin
            </a>
          </td>
        </tr>
      </table>
    `,
  });

  const texto = `NUEVO COMPROBANTE DE PAGO EN UNIMARKET BO

- Empresa: ${razonSocial}
- Código: ${codigoPago}
- Monto: Bs ${monto}
- Banco: ${banco}
- Referencia: ${referencia}

Revisar en: ${config.appUrl}/admin`;

  return { asunto, html, texto };
}

// -------------------------------------------------------------
// Categoría sugerida aprobada (notificación opcional requerida)
// -------------------------------------------------------------
function construirCorreoCategoriaAprobada({ razonSocial, categoria }) {
  const config = getMailConfig();
  const razon = escaparHtml(razonSocial);
  const cat = escaparHtml(categoria);
  const asunto = `Sugerencia de categoría aprobada: "${categoria}"`;

  const html = layoutCorreo({
    titulo: asunto,
    preheader: `La categoría "${cat}" fue aprobada y ya está disponible para sus productos.`,
    contenido: `
      <h1 style="font-size: 22px; font-weight: 800; color: #34d399; margin: 0 0 16px 0;">
        ¡Categoría sugerida aprobada!
      </h1>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Estimado/a representante de <strong>${razon}</strong>:
      </p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Nos complace informarle que la categoría sugerida <strong>"${cat}"</strong> ha sido aprobada por la administración y ya se encuentra disponible para clasificar sus productos.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <a href="${config.appUrl}/panel" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px;">
              Ir a mi catálogo
            </a>
          </td>
        </tr>
      </table>
    `,
  });

  const texto = `CATEGORÍA APROBADA - UNIMARKET BO

Estimado/a representante de ${razonSocial}:
La categoría "${categoria}" ha sido aprobada y ya está disponible en su catálogo.

Panel: ${config.appUrl}/panel`;

  return { asunto, html, texto };
}

// -------------------------------------------------------------
// Suscripción activada por administración
// -------------------------------------------------------------
function construirCorreoSuscripcionActivada({ razonSocial, fechaVencimiento, motivo }) {
  const config = getMailConfig();
  const razon = escaparHtml(razonSocial);
  const vence = formatearFecha(fechaVencimiento);
  const mot = escaparHtml(motivo || 'Activación manual por administración');
  const asunto = `Suscripción activada - UNIMARKET BO`;

  const html = layoutCorreo({
    titulo: asunto,
    preheader: `Su suscripción ha sido activada y su tienda oficial ya está pública hasta el ${vence}.`,
    contenido: `
      <h1 style="font-size: 22px; font-weight: 800; color: #34d399; margin: 0 0 16px 0;">
        ¡Su suscripción está activa!
      </h1>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Estimado/a representante de <strong>${razon}</strong>:
      </p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Le informamos que la suscripción de su empresa ha sido <strong>activada</strong> por la administración. Su portal y productos ya se encuentran visibles para los clientes.
      </p>

      <div style="background-color: rgba(16,185,129,0.08); border-left: 4px solid #10b981; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px 0;">
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #e2e8f0;"><strong>Estado:</strong> <span style="color: #34d399; font-weight: bold;">ACTIVA</span></p>
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #e2e8f0;"><strong>Vigente hasta:</strong> <span style="font-weight: bold; color: #38bdf8;">${vence}</span></p>
        <p style="margin: 0; font-size: 13px; color: #cbd5e1;"><strong>Detalle / Motivo:</strong> ${mot}</p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <a href="${config.appUrl}/panel" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px;">
              Ir al panel de mi empresa
            </a>
          </td>
        </tr>
      </table>
    `,
  });

  const texto = `SUSCRIPCIÓN ACTIVADA - UNIMARKET BO

Estimado/a representante de ${razonSocial}:
Le informamos que su suscripción ha sido activada con éxito.

- Estado: ACTIVA
- Vigente hasta: ${vence}
- Detalle / Motivo: ${motivo || 'Activación manual por administración'}

Panel: ${config.appUrl}/panel`;

  return { asunto, html, texto };
}

// -------------------------------------------------------------
// Suscripción suspendida por administración
// -------------------------------------------------------------
function construirCorreoSuscripcionSuspendida({ razonSocial, motivo }) {
  const config = getMailConfig();
  const razon = escaparHtml(razonSocial);
  const mot = escaparHtml(motivo || 'Suspensión administrativa');
  const asunto = `Aviso: Suscripción suspendida - UNIMARKET BO`;

  const html = layoutCorreo({
    titulo: asunto,
    preheader: `La suscripción de ${razon} ha sido suspendida.`,
    contenido: `
      <h1 style="font-size: 22px; font-weight: 800; color: #f43f5e; margin: 0 0 16px 0;">
        Suscripción suspendida
      </h1>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Estimado/a representante de <strong>${razon}</strong>:
      </p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Le notificamos que la suscripción de su empresa ha sido <strong>suspendida</strong> temporalmente por la administración. Mientras su suscripción se encuentre en este estado, su portal de tienda y sus productos no estarán visibles para el público.
      </p>

      <div style="background-color: rgba(244,63,94,0.08); border-left: 4px solid #f43f5e; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px 0;">
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #e2e8f0;"><strong>Estado:</strong> <span style="color: #f43f5e; font-weight: bold;">SUSPENDIDA</span></p>
        <p style="margin: 0; font-size: 13px; color: #cbd5e1;"><strong>Motivo de la suspensión:</strong> ${mot}</p>
      </div>

      <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; margin: 0 0 20px 0;">
        Para regularizar su situación o resolver cualquier observación, por favor ingrese a su panel de control o comuníquese con el equipo de soporte.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <a href="${config.appUrl}/panel" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px;">
              Ingresar al panel
            </a>
          </td>
        </tr>
      </table>
    `,
  });

  const texto = `SUSCRIPCIÓN SUSPENDIDA - UNIMARKET BO

Estimado/a representante de ${razonSocial}:
Le notificamos que la suscripción de su empresa ha sido suspendida.

- Estado: SUSPENDIDA
- Motivo: ${motivo || 'Suspensión administrativa'}

Su catálogo y tienda no estarán visibles públicamente mientras persista la suspensión.
Para regularizar la situación, comuníquese con soporte: ${config.adminNotify}`;

  return { asunto, html, texto };
}

// -------------------------------------------------------------
// RECUPERACIÓN DE CONTRASEÑA
// -------------------------------------------------------------
function construirCorreoRecuperacionPassword({ usuario, nombre, enlaceRecuperacion, expiraMinutos = 60 }) {
  const config = getMailConfig();
  const usu = escaparHtml(usuario || '');
  const nom = escaparHtml(nombre || usuario || 'Usuario');
  const asunto = '🔑 Recuperación de contraseña - UNIMARKET BO';

  const html = layoutCorreo({
    titulo: asunto,
    preheader: `Solicitud de restablecimiento de contraseña para ${usu}`,
    contenido: `
      <h1 style="font-size: 22px; font-weight: 800; color: #38bdf8; margin: 0 0 16px 0;">
        Recuperación de contraseña
      </h1>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin: 0 0 16px 0;">
        Hola <strong>${nom}</strong>,
      </p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Hemos recibido una solicitud para restablecer la contraseña asociada a su cuenta (<strong>${usu}</strong>) en UNIMARKET BO.
      </p>

      <div style="background-color: rgba(56,189,248,0.08); border-left: 4px solid #38bdf8; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px 0;">
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #e2e8f0;">
          ⏰ <strong>Tiempo de validez:</strong> Este enlace expirará en <strong>${expiraMinutos} minutos</strong> y solo puede ser usado una vez.
        </p>
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">
          Si usted no solicitó este cambio, puede ignorar este mensaje; su contraseña actual no sufrirá ninguna modificación.
        </p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
        <tr>
          <td align="center">
            <a href="${enlaceRecuperacion}" style="display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(2,132,199,0.3);">
              Restablecer mi contraseña
            </a>
          </td>
        </tr>
      </table>

      <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0;">
        O copie y pegue el siguiente enlace en su navegador:<br/>
        <span style="color: #38bdf8; word-break: break-all;">${enlaceRecuperacion}</span>
      </p>
    `,
  });

  const texto = `RECUPERACIÓN DE CONTRASEÑA - UNIMARKET BO

Hola ${nombre || usuario || 'Usuario'},
Hemos recibido una solicitud para restablecer la contraseña de su cuenta (${usuario}).

Para crear una nueva contraseña, ingrese al siguiente enlace temporal (válido por ${expiraMinutos} minutos):
${enlaceRecuperacion}

Si usted no solicitó este cambio, puede ignorar este mensaje; su cuenta se mantendrá segura.
Soporte: ${config.adminNotify}`;

  return { asunto, html, texto };
}

// -------------------------------------------------------------
// ENVÍO DE COMPROBANTE DE VENTA AL CLIENTE
// -------------------------------------------------------------
function construirCorreoComprobanteVenta({ empresa, venta, cliente, enlaceComprobante }) {
  const config = getMailConfig();
  const nomEmpresa = escaparHtml(empresa.razon_social || 'UNIMARKET BO');
  const nomCliente = escaparHtml(cliente?.nombre || venta.nombre_cliente || 'Estimado/a cliente');
  const corr = escaparHtml(venta.correlativo || (venta.numero_formato ? `VTA-${venta.numero_formato}` : `VTA-${venta.id_venta}`));
  const total = Number(venta.total || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const asunto = `📄 Comprobante de compra ${corr} - ${nomEmpresa}`;

  const html = layoutCorreo({
    titulo: asunto,
    preheader: `Comprobante de compra por Bs ${total} emitido por ${nomEmpresa}`,
    contenido: `
      <h1 style="font-size: 22px; font-weight: 800; color: #10b981; margin: 0 0 16px 0;">
        Comprobante de Compra
      </h1>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin: 0 0 16px 0;">
        Hola <strong>${nomCliente}</strong>,
      </p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Muchas gracias por su compra en <strong>${nomEmpresa}</strong>. A continuación le compartimos los detalles de su comprobante de pago oficial:
      </p>

      <div style="background-color: rgba(16,185,129,0.08); border-left: 4px solid #10b981; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px 0;">
        <table width="100%" cellpadding="4" cellspacing="0" border="0" style="font-size: 13px; color: #cbd5e1;">
          <tr>
            <td style="width: 40%; color: #94a3b8;">N° Comprobante:</td>
            <td style="font-weight: 700; color: #34d399;">${corr}</td>
          </tr>
          <tr>
            <td style="color: #94a3b8;">Empresa emisora:</td>
            <td style="font-weight: 600; color: #ffffff;">${nomEmpresa}</td>
          </tr>
          <tr>
            <td style="color: #94a3b8;">Total cancelado:</td>
            <td style="font-weight: 800; font-size: 16px; color: #10b981;">Bs ${total}</td>
          </tr>
          <tr>
            <td style="color: #94a3b8;">Método de pago:</td>
            <td style="color: #e2e8f0; text-transform: uppercase;">${escaparHtml(venta.metodo_pago || 'Efectivo')}</td>
          </tr>
        </table>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
        <tr>
          <td align="center">
            <a href="${enlaceComprobante}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(16,185,129,0.3);">
              📥 Ver y Descargar Comprobante PDF
            </a>
          </td>
        </tr>
      </table>

      <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin: 0 0 10px 0;">
        Puede conservar o imprimir este comprobante para sus registros y garantías comerciales.
      </p>
      <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0;">
        Enlace directo: <span style="color: #34d399; word-break: break-all;">${enlaceComprobante}</span>
      </p>
    `,
  });

  const texto = `COMPROBANTE DE COMPRA - ${empresa.razon_social || 'UNIMARKET BO'}

Hola ${cliente?.nombre || venta.nombre_cliente || 'Cliente'},
Muchas gracias por su compra. Adjuntamos los datos de su comprobante:

- Comprobante: ${corr}
- Empresa: ${empresa.razon_social || 'UNIMARKET BO'}
- Total: Bs ${total}
- Método: ${(venta.metodo_pago || 'efectivo').toUpperCase()}

Puede ver y descargar su comprobante en PDF desde el siguiente enlace:
${enlaceComprobante}

¡Gracias por su preferencia!`;

  return { asunto, html, texto };
}

// -------------------------------------------------------------
// AVISO DE NUEVO PEDIDO A LA EMPRESA
// -------------------------------------------------------------
function construirCorreoNuevoPedido({ empresa, pedido, items = [], urlPanel }) {
  const config = getMailConfig();
  const razon = escaparHtml(empresa.razon_social || 'Empresa');
  const codigo = escaparHtml(pedido.codigo || '');
  const cli = escaparHtml(pedido.nombre_cliente || 'Cliente del Catálogo Web');
  const ciudad = escaparHtml(pedido.ciudad || 'No especificada');
  const total = Number(pedido.total_estimado || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const asunto = `🔔 ¡Nuevo pedido recibido! Ref. ${codigo} - UNIMARKET BO`;
  const urlDestino = urlPanel || `${config.appUrl}/panel`;

  let filasHtml = '';
  let lineasTexto = [];

  items.forEach((it, idx) => {
    let extraColores = '';
    if (Array.isArray(it.desglose_colores) && it.desglose_colores.length > 0) {
      const colStr = it.desglose_colores.filter((c) => c.cantidad > 0).map((c) => `${c.cantidad} ${c.nombre}`).join(', ');
      if (colStr) extraColores = `<br/><span style="font-size: 11px; color: #94a3b8;">Colores: ${escaparHtml(colStr)}</span>`;
    }
    const pu = Number(it.precio_unitario || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sub = Number(it.subtotal || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    filasHtml += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.07);">
        <td style="padding: 10px 8px; font-size: 13px; color: #ffffff;">
          <strong>${escaparHtml(it.descripcion)}</strong>${it.sku ? ` <span style="font-size: 11px; color: #64748b;">(SKU ${escaparHtml(it.sku)})</span>` : ''}
          ${extraColores}
        </td>
        <td align="center" style="padding: 10px 8px; font-size: 13px; color: #38bdf8; font-weight: 700;">${it.cantidad_total}</td>
        <td align="right" style="padding: 10px 8px; font-size: 13px; color: #cbd5e1;">Bs ${pu}</td>
        <td align="right" style="padding: 10px 8px; font-size: 13px; color: #34d399; font-weight: 700;">Bs ${sub}</td>
      </tr>
    `;
    lineasTexto.push(`  ${idx + 1}) ${it.descripcion} x ${it.cantidad_total} - Bs ${sub}`);
  });

  const html = layoutCorreo({
    titulo: asunto,
    preheader: `Nuevo pedido de ${cli} por Bs ${total} (${codigo})`,
    contenido: `
      <h1 style="font-size: 22px; font-weight: 800; color: #38bdf8; margin: 0 0 16px 0;">
        ¡Nuevo Pedido Recibido!
      </h1>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; margin: 0 0 16px 0;">
        Estimado/a representante de <strong>${razon}</strong>:
      </p>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
        Un cliente acaba de enviar un nuevo pedido desde su portal/catálogo en UNIMARKET BO con el código <span style="color: #38bdf8; font-weight: 700;">${codigo}</span>:
      </p>

      <div style="background-color: rgba(56,189,248,0.08); border-left: 4px solid #38bdf8; border-radius: 8px; padding: 14px 18px; margin: 0 0 20px 0;">
        <table width="100%" cellpadding="3" cellspacing="0" border="0" style="font-size: 13px; color: #cbd5e1;">
          <tr>
            <td style="width: 35%; color: #94a3b8;">Cliente:</td>
            <td style="font-weight: 700; color: #ffffff;">${cli}</td>
          </tr>
          <tr>
            <td style="color: #94a3b8;">Ciudad de entrega:</td>
            <td style="font-weight: 600; color: #ffffff;">${ciudad}</td>
          </tr>
          <tr>
            <td style="color: #94a3b8;">Total estimado:</td>
            <td style="font-weight: 800; font-size: 16px; color: #34d399;">Bs ${total}</td>
          </tr>
        </table>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid rgba(255,255,255,0.15); font-size: 11px; text-transform: uppercase; color: #94a3b8;">
            <th align="left" style="padding: 8px;">Producto</th>
            <th align="center" style="padding: 8px;">Cant.</th>
            <th align="right" style="padding: 8px;">P. Unit.</th>
            <th align="right" style="padding: 8px;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${filasHtml}
        </tbody>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
        <tr>
          <td align="center">
            <a href="${urlDestino}" style="display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%); color: #ffffff; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(37,99,235,0.3);">
              📦 Ver Pedido en Mi Panel
            </a>
          </td>
        </tr>
      </table>

      <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin: 0;">
        💡 <strong>Recomendación:</strong> El cliente también puede comunicarse por WhatsApp. Atiéndalo pronto para confirmar stock y cerrar la venta.
      </p>
    `,
  });

  const texto = `¡NUEVO PEDIDO RECIBIDO! - UNIMARKET BO

Empresa: ${empresa.razon_social}
Código: ${pedido.codigo}
Cliente: ${pedido.nombre_cliente || 'No especificado'}
Ciudad: ${pedido.ciudad || 'No especificada'}
Total Estimado: Bs ${total}

ÍTEMS:
${lineasTexto.join('\n')}

Revise y gestione el pedido en su panel:
${urlDestino}`;

  return { asunto, html, texto };
}

module.exports = {
  getMailConfig,
  smtpConfigurado,
  obtenerTransportador,
  enviarCorreo,
  reenviarNotificacion,
  // Constructores de plantillas
  construirCorreoSolicitudRecibida,
  construirCorreoCuentaVerificada,
  construirCorreoObservacion,
  construirCorreoRechazo,
  construirCorreoComprobanteRecibido,
  construirCorreoPagoConfirmado,
  construirCorreoComprobanteRechazado,
  construirCorreoRecordatorioPago,
  construirCorreoRecordatorioVencimiento,
  construirCorreoStockBajo,
  construirCorreoAvisoAdminRegistro,
  construirCorreoAvisoAdminComprobante,
  construirCorreoCategoriaAprobada,
  construirCorreoSuscripcionActivada,
  construirCorreoSuscripcionSuspendida,
  construirCorreoRecuperacionPassword,
  construirCorreoComprobanteVenta,
  construirCorreoNuevoPedido,
};


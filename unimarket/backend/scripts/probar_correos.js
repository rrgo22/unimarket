require('dotenv').config();
const pool = require('../src/db');
const {
  enviarCorreo,
  smtpConfigurado,
  getMailConfig,
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
} = require('../src/servicios/correo');

async function probarCorreos() {
  console.log('========================================================================');
  console.log('           PRUEBA DE PLANTILLAS DE CORREO - UNIMARKET BO                ');
  console.log('========================================================================\n');

  const config = getMailConfig();
  const destino = 'per1per9@gmail.com';

  console.log(`Configuración actual:`);
  console.log(`- Remitente: ${config.from}`);
  console.log(`- Host SMTP: ${config.host}:${config.port}`);
  console.log(`- Usuario:   ${config.user}`);
  console.log(`- Destino:   ${destino}`);
  console.log(`- SMTP Real: ${smtpConfigurado() ? 'SI (Credenciales presentes)' : 'NO (Modo Simulación / Log en BD)'}\n`);

  if (!smtpConfigurado()) {
    console.log('------------------------------------------------------------------------');
    console.log('AVISO: Actualmente MAIL_PASS contiene un marcador de posición.');
    console.log('Para enviar correos REALES a Gmail:');
    console.log('1. Ingrese a: https://myaccount.google.com/security');
    console.log('2. Active "Verificación en dos pasos" si aún no la tiene.');
    console.log('3. Busque "Contraseñas de aplicaciones" (o ingrese a https://myaccount.google.com/apppasswords).');
    console.log('4. Genere una contraseña para "UNIMARKET BO" (16 caracteres, ej: abcd efgh ijkl mnop).');
    console.log('5. Coloque ese valor en backend/.env: MAIL_PASS=abcdefghijklmnop');
    console.log('Mientras tanto, los correos se probarán, renderizarán y registrarán en notificacion_correo.');
    console.log('------------------------------------------------------------------------\n');
  }

  // Obtener datos reales de Tecno Andina S.R.L.
  const { rows: empRows } = await pool.query(
    `SELECT e.*, u.usuario, u.correo AS usuario_correo
       FROM empresa e
       JOIN usuario u ON u.id_usuario = e.id_usuario
      WHERE e.nit = $1`,
    ['1023456789']
  );

  if (!empRows.length) {
    console.error('ERROR: No se encontró la empresa Tecno Andina S.R.L. en la base de datos.');
    process.exit(1);
  }

  const emp = empRows[0];
  const { rows: prods } = await pool.query(
    `SELECT id_producto, nombre, sku, stock_actual, stock_minimo, unidad
       FROM producto
      WHERE id_empresa = $1
      ORDER BY id_producto ASC`,
    [emp.id_empresa]
  );

  const plantillas = [
    {
      nombre: '1. Registro Recibido (Empresa)',
      tipo: 'registro_recibido',
      generar: () =>
        construirCorreoSolicitudRecibida({
          razonSocial: emp.razon_social,
          nit: emp.nit,
          correo: destino,
        }),
      adjuntarQr: false,
    },
    {
      nombre: '2. Cuenta Verificada (con QR y código UM-0001)',
      tipo: 'cuenta_verificada',
      generar: () =>
        construirCorreoCuentaVerificada({
          razonSocial: emp.razon_social,
          codigoPago: emp.codigo_pago || 'UM-0001',
          usuario: emp.usuario,
        }),
      adjuntarQr: true,
    },
    {
      nombre: '3. Observada con Motivo (Empresa)',
      tipo: 'observada',
      generar: () =>
        construirCorreoObservacion({
          razonSocial: emp.razon_social,
          motivo: 'El archivo PDF del NIT adjunto se encuentra borroso y no permite verificar el código QR del SIN.',
        }),
      adjuntarQr: false,
    },
    {
      nombre: '4. Rechazada con Motivo (Empresa)',
      tipo: 'rechazada',
      generar: () =>
        construirCorreoRechazo({
          razonSocial: emp.razon_social,
          motivo: 'El NIT proporcionado figura en estado Pasivo en el Padrón Nacional Biométrico Digital del SIN.',
        }),
      adjuntarQr: false,
    },
    {
      nombre: '5. Comprobante de Pago Recibido (Empresa)',
      tipo: 'comprobante_recibido',
      generar: () =>
        construirCorreoComprobanteRecibido({
          razonSocial: emp.razon_social,
          codigoPago: emp.codigo_pago || 'UM-0001',
          monto: '200.00',
          referencia: 'TR-78945612',
          banco: 'Banco Unión S.A.',
        }),
      adjuntarQr: false,
    },
    {
      nombre: '6. Pago Confirmado y Suscripción Activa (Empresa)',
      tipo: 'pago_confirmado',
      generar: () =>
        construirCorreoPagoConfirmado({
          razonSocial: emp.razon_social,
          codigoPago: emp.codigo_pago || 'UM-0001',
          fechaInicio: new Date(),
          fechaVencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          monto: '200.00',
          referencia: 'TR-78945612',
          slug: emp.slug,
        }),
      adjuntarQr: false,
    },
    {
      nombre: '7. Comprobante de Pago Rechazado (Empresa)',
      tipo: 'comprobante_rechazado',
      generar: () =>
        construirCorreoComprobanteRechazado({
          razonSocial: emp.razon_social,
          codigoPago: emp.codigo_pago || 'UM-0001',
          motivo: 'El monto transferido es de Bs 100.00 y no cubre la mensualidad completa de Bs 200.00.',
        }),
      adjuntarQr: false,
    },
    {
      nombre: '8. Recordatorio de Pago Pendiente (Empresa)',
      tipo: 'recordatorio_pago',
      generar: () =>
        construirCorreoRecordatorioPago({
          razonSocial: emp.razon_social,
          codigoPago: emp.codigo_pago || 'UM-0001',
          diasTranscurridos: 3,
        }),
      adjuntarQr: true,
    },
    {
      nombre: '9. Recordatorio de Vencimiento de Suscripción (Empresa)',
      tipo: 'recordatorio_vencimiento',
      generar: () =>
        construirCorreoRecordatorioVencimiento({
          razonSocial: emp.razon_social,
          codigoPago: emp.codigo_pago || 'UM-0001',
          fechaVencimiento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          diasRestantes: 3,
        }),
      adjuntarQr: true,
    },
    {
      nombre: '10. Alerta de Stock Bajo (Empresa)',
      tipo: 'stock_bajo',
      generar: () =>
        construirCorreoStockBajo({
          razonSocial: emp.razon_social,
          productos: prods.length > 0 ? prods.slice(0, 3) : [
            { nombre: 'Audífonos Bluetooth Pro', sku: 'SW-300', stock_actual: 0, stock_minimo: 20, unidad: 'unidad' },
            { nombre: 'Set de Destornilladores 32 Piezas', sku: 'TM-32', stock_actual: 5, stock_minimo: 20, unidad: 'unidad' },
          ],
        }),
      adjuntarQr: false,
    },
    {
      nombre: '11. Aviso al Admin: Nuevo Registro',
      tipo: 'aviso_admin_nuevo_registro',
      generar: () =>
        construirCorreoAvisoAdminRegistro({
          razonSocial: emp.razon_social,
          nit: emp.nit,
          rubro: 'Electrónica y Computación',
          telefono: emp.telefono,
          correo: destino,
          ciudad: 'La Paz',
        }),
      adjuntarQr: false,
    },
    {
      nombre: '12. Aviso al Admin: Nuevo Comprobante de Pago',
      tipo: 'aviso_admin_nuevo_comprobante',
      generar: () =>
        construirCorreoAvisoAdminComprobante({
          razonSocial: emp.razon_social,
          codigoPago: emp.codigo_pago || 'UM-0001',
          monto: '200.00',
          referencia: 'TR-78945612',
          banco: 'Banco Unión S.A.',
        }),
      adjuntarQr: false,
    },
  ];

  let exitosos = 0;
  let fallidos = 0;

  for (const p of plantillas) {
    process.stdout.write(`Probando ${p.nombre}... `);
    try {
      const { asunto, html, texto } = p.generar();
      const res = await enviarCorreo({
        id_empresa: emp.id_empresa,
        tipo: p.tipo,
        para: destino,
        asunto,
        html,
        texto,
        adjuntarQr: p.adjuntarQr,
      });

      if (res.exito) {
        exitosos++;
        console.log(`[OK] (Notificación #${res.id_notificacion || 'N/A'}${res.simulado ? ' - Simulado en BD' : ' - Enviado SMTP'})`);
      } else {
        fallidos++;
        console.log(`[FALLO] ${res.error}`);
      }
    } catch (err) {
      fallidos++;
      console.log(`[ERROR EXCEPCIÓN] ${err.message}`);
    }
  }

  console.log('\n========================================================================');
  console.log(`RESUMEN: ${exitosos} exitosos, ${fallidos} fallidos de ${plantillas.length} plantillas.`);
  console.log('Todas las plantillas fueron generadas con datos reales de Tecno Andina S.R.L.');
  console.log('========================================================================\n');

  await pool.end();
  process.exit(fallidos > 0 ? 1 : 0);
}

probarCorreos().catch((err) => {
  console.error('Error general:', err);
  process.exit(1);
});

const cron = require('node-cron');
const pool = require('../db');
const { enviarCorreo } = require('../servicios/correo');

/**
 * Tarea periódica de revisión de vencimientos y recordatorios
 * Se ejecuta diariamente a las 08:00 en zona horaria America/La_Paz
 */
async function ejecutarRevisionDiaria() {
  console.log('[CRON 08:00 America/La_Paz] Iniciando revisión de suscripciones y recordatorios...');
  try {
    // 1. Marcar como vencida toda suscripción activa cuya fecha de vencimiento ya pasó
    const vencidasRes = await pool.query(
      `UPDATE suscripcion
          SET estado = 'vencida'
        WHERE estado = 'activa'
          AND fecha_vencimiento < (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date
        RETURNING id_empresa`
    );

    if (vencidasRes.rowCount > 0) {
      console.log(`[CRON] ${vencidasRes.rowCount} suscripción(es) marcada(s) como vencida(s).`);
      for (const row of vencidasRes.rows) {
        // Enviar aviso el día del vencimiento
        const empRes = await pool.query(
          `SELECT e.razon_social, COALESCE(e.correo, u.correo) AS correo, s.fecha_vencimiento
             FROM empresa e
             JOIN usuario u ON u.id_usuario = e.id_usuario
             JOIN suscripcion s ON s.id_empresa = e.id_empresa
            WHERE e.id_empresa = $1`,
          [row.id_empresa]
        );
        if (empRes.rows.length) {
          const emp = empRes.rows[0];
          await enviarCorreo({
            id_empresa: row.id_empresa,
            tipo: 'recordatorio_vencimiento',
            para: emp.correo,
            datos: {
              razonSocial: emp.razon_social,
              diasRestantes: 0,
              fechaVencimiento: emp.fecha_vencimiento,
            },
          }).catch((e) => console.error('[CRON] Error enviando aviso de vencimiento hoy:', e.message));
        }
      }
    }

    // 2. Recordatorios a empresas verificadas con suscripción en 'pendiente_pago':
    // Plazos: día 3, día 6 y aviso de plazo cumplido el día 7 desde la verificación
    const pendientesRes = await pool.query(
      `SELECT e.id_empresa, e.razon_social, COALESCE(e.correo, u.correo) AS correo, e.codigo_pago,
              ((CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date - v.fecha_revision::date) AS dias_transcurridos
         FROM empresa e
         JOIN usuario u ON u.id_usuario = e.id_usuario
         JOIN suscripcion s ON s.id_empresa = e.id_empresa
         JOIN verificacion v ON v.id_empresa = e.id_empresa
        WHERE e.estado_verificacion = 'verificado'
          AND s.estado = 'pendiente_pago'
          AND v.estado IN ('verificado', 'verificada', 'aprobado')
          AND v.fecha_revision IS NOT NULL`
    );

    for (const r of pendientesRes.rows) {
      const dias = parseInt(r.dias_transcurridos, 10);
      if (dias === 3 || dias === 6 || dias === 7) {
        // Verificar que no se haya enviado ya en las últimas 20 horas
        const yaEnviado = await pool.query(
          `SELECT 1 FROM notificacion_correo
            WHERE id_empresa = $1
              AND (tipo = 'recordatorio_pago' OR plantilla = 'recordatorio_pago')
              AND fecha >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz') - INTERVAL '20 hours'`,
          [r.id_empresa]
        );
        if (yaEnviado.rowCount === 0) {
          await enviarCorreo({
            id_empresa: r.id_empresa,
            tipo: 'recordatorio_pago',
            para: r.correo,
            datos: {
              razonSocial: r.razon_social,
              codigoPago: r.codigo_pago || 'UM-0001',
              diasTranscurridos: dias,
            },
          }).catch((e) => console.error('[CRON] Error enviando recordatorio de pago:', e.message));
        }
      }
    }

    // 3. Recordatorios a suscripciones activas a los 7, 3 y 1 días antes de vencer
    const porVencerRes = await pool.query(
      `SELECT e.id_empresa, e.razon_social, COALESCE(e.correo, u.correo) AS correo, s.fecha_vencimiento,
              (s.fecha_vencimiento - (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date) AS dias_restantes
         FROM suscripcion s
         JOIN empresa e ON e.id_empresa = s.id_empresa
         JOIN usuario u ON u.id_usuario = e.id_usuario
        WHERE s.estado = 'activa'
          AND (s.fecha_vencimiento - (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date) IN (7, 3, 1)`
    );

    for (const r of porVencerRes.rows) {
      const dias = parseInt(r.dias_restantes, 10);
      const yaEnviado = await pool.query(
        `SELECT 1 FROM notificacion_correo
          WHERE id_empresa = $1
            AND (tipo = 'recordatorio_vencimiento' OR plantilla = 'recordatorio_vencimiento')
            AND fecha >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz') - INTERVAL '20 hours'`,
        [r.id_empresa]
      );
      if (yaEnviado.rowCount === 0) {
        await enviarCorreo({
          id_empresa: r.id_empresa,
          tipo: 'recordatorio_vencimiento',
          para: r.correo,
          datos: {
            razonSocial: r.razon_social,
            diasRestantes: dias,
            fechaVencimiento: r.fecha_vencimiento,
          },
        }).catch((e) => console.error('[CRON] Error enviando recordatorio de vencimiento:', e.message));
      }
    }

    console.log('[CRON] Revisión diaria completada con éxito.');
  } catch (err) {
    console.error('[CRON] Error en ejecución de revisión diaria:', err.message);
  }
}

/**
 * Inicia el cron job a las 08:00 AM hora de Bolivia
 */
function iniciarCronVencimientos() {
  // Ejecutar a las 08:00 todos los días en America/La_Paz
  cron.schedule('0 8 * * *', () => {
    ejecutarRevisionDiaria();
  }, {
    timezone: 'America/La_Paz',
  });
  console.log('[CRON] Programado job diario de suscripciones a las 08:00 (America/La_Paz)');
}

module.exports = {
  iniciarCronVencimientos,
  ejecutarRevisionDiaria,
};

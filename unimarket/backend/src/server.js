require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const pool = require('./db');
const { DIR_PROD, DIR_EMP } = require('./middleware/upload');
const { enviarCorreo, construirCorreoAvisoVencimiento } = require('./utils/correo');

const fs = require('fs');
const app = express();

// Middleware de identificación única de cada petición
app.use((req, res, next) => {
  req.id = 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Capa 1: cabeceras seguras + CORS restringido al dominio de la aplicación
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','), credentials: false }));
app.use(express.json({ limit: '100kb' }));

// Las imágenes públicas de productos y portales de empresas se sirven estáticamente
app.use('/uploads/productos', express.static(DIR_PROD, { maxAge: '7d' }));
app.use('/uploads/empresas', express.static(DIR_EMP, { maxAge: '7d' }));

app.get('/api/salud', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/publico', require('./routes/publico'));
app.use('/api/empresa', require('./routes/empresa'));
app.use('/api/admin', require('./routes/admin'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada', id_peticion: req.id }));

// Manejo central de errores con ID de petición y stack trace en servidor
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const reqId = req.id || 'req_desconocida';
  console.error(`[ERROR FATAL ${reqId}] ${req.method} ${req.originalUrl}:`);
  console.error(err.stack || err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON no válido', id_peticion: reqId });
  }

  const statusCode = err.status || err.statusCode || 500;
  const mensaje = statusCode < 500 && err.message ? err.message : 'Error interno del servidor';

  res.status(statusCode).json({
    error: mensaje,
    id_peticion: reqId,
    ...(process.env.NODE_ENV !== 'production' && statusCode >= 500 ? { detalle: err.message } : {})
  });
});

// Verificación de archivo de imagen QR al iniciar
const qrRutaRelativa = process.env.QR_PATH || '../frontend/public/qr-pago.png';
const qrRutaAbsoluta = path.resolve(__dirname, '..', qrRutaRelativa);
if (fs.existsSync(qrRutaAbsoluta)) {
  console.log(`[QR PAGO] Imagen QR verificada exitosamente en: ${qrRutaAbsoluta}`);
} else {
  console.warn(`[ALERTA QR] No se encontró el archivo de imagen QR en: ${qrRutaAbsoluta}. Verifique la variable QR_PATH en .env.`);
}

// Job diario de suscripciones a las 08:00 America/La_Paz con node-cron
const { iniciarCronVencimientos } = require('./cron/vencimientos');
iniciarCronVencimientos();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`UNIMARKET BO API escuchando en http://localhost:${PORT}`));

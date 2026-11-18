const jwt = require('jsonwebtoken');
const pool = require('../db');

const SECRET = () => process.env.JWT_SECRET || 'dev_secret_inseguro';

function firmar(user) {
  return jwt.sign(
    { id_usuario: user.id_usuario, rol: user.rol, id_empresa: user.id_empresa || null },
    SECRET(),
    { expiresIn: process.env.JWT_EXPIRES || '8h' }
  );
}

// Capa 3: autenticación (token con expiración)
function autenticar(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Acceso denegado: inicie sesión' });
  try {
    req.user = jwt.verify(token, SECRET());
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o vencida: inicie sesión nuevamente' });
  }
}

// Capa 4: autorización por rol
const permitir = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.rol))
    return res.status(403).json({ error: 'No tiene permisos para esta acción' });
  next();
};

// Autorización por estado de verificación (PR03)
async function exigirVerificada(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT estado_verificacion FROM empresa WHERE id_empresa = $1',
      [req.user.id_empresa]
    );
    if (!rows.length || rows[0].estado_verificacion !== 'verificado')
      return res.status(403).json({ error: 'Su empresa aún no está verificada' });
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { firmar, autenticar, permitir, exigirVerificada };

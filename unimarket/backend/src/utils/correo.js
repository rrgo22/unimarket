// Re-exportación para compatibilidad hacia el servicio unificado en src/servicios/correo.js
const servicioCorreo = require('../servicios/correo');

module.exports = {
  ...servicioCorreo,
  // Alias de nombres previos si alguno se usaba
  construirCorreoAprobacion: servicioCorreo.construirCorreoCuentaVerificada,
};

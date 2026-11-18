require('dotenv').config();
const pool = require('../src/db');

async function main() {
  const nuevoCorreo = 'per1per9@gmail.com';

  // 1. Asegurar que empresa tenga columna correo e índice único parcial
  await pool.query(`ALTER TABLE empresa ADD COLUMN IF NOT EXISTS correo VARCHAR(120)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_correo_unique ON empresa(correo) WHERE eliminado_en IS NULL`);

  // 2. Verificar si algún otro usuario tiene este correo
  const dupUsu = await pool.query(
    'SELECT id_usuario, usuario FROM usuario WHERE correo = $1 AND usuario != $2',
    [nuevoCorreo, 'empresa1']
  );
  if (dupUsu.rows.length) {
    console.error('ERROR: Ya existe otro usuario con este correo:', dupUsu.rows);
    process.exit(1);
  }

  // 3. Verificar si alguna otra empresa tiene este correo
  const dupEmp = await pool.query(
    'SELECT id_empresa, razon_social FROM empresa WHERE correo = $1 AND nit != $2',
    [nuevoCorreo, '1023456789']
  );
  if (dupEmp.rows.length) {
    console.error('ERROR: Ya existe otra empresa con este correo:', dupEmp.rows);
    process.exit(1);
  }

  // 4. Actualizar usuario empresa1
  const resU = await pool.query(
    'UPDATE usuario SET correo = $1 WHERE usuario = $2 RETURNING id_usuario, usuario, correo',
    [nuevoCorreo, 'empresa1']
  );
  console.log('Usuario actualizado:', resU.rows[0]);

  // 5. Actualizar empresa Tecno Andina S.R.L.
  const resE = await pool.query(
    'UPDATE empresa SET correo = $1 WHERE nit = $2 RETURNING id_empresa, razon_social, correo, slug, estado_verificacion',
    [nuevoCorreo, '1023456789']
  );
  console.log('Empresa actualizada:', resE.rows[0]);

  // 6. Limpiar observación 'Datos de ejemplo'
  await pool.query("UPDATE verificacion SET observacion = NULL WHERE observacion = 'Datos de ejemplo'");
  console.log('Observación "Datos de ejemplo" limpiada de verificaciones.');

  console.log('EXITO: Correo per1per9@gmail.com configurado correctamente para Tecno Andina S.R.L. y su usuario.');
  await pool.end();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

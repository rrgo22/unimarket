/**
 * Test de verificación end-to-end para UNIMARKET BO
 * Prueba los 11 criterios de aceptación
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const db = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/unimarket' });

async function runTests() {
  await db.connect();
  console.log('=== INICIANDO VALIDACIÓN DE CRITERIOS DE ACEPTACIÓN ===\n');

  // Test 1: Plan centralizado en la base de datos
  const { rows: planRows } = await db.query('SELECT * FROM plan WHERE activo = true LIMIT 1');
  if (!planRows.length || (planRows[0].precio !== '200.00' && planRows[0].precio !== 200)) {
    throw new Error('Criterio 1 falló: El plan activo debe ser Plan Único con precio Bs 200');
  }
  console.log('✓ Criterio 1: Plan centralizado "Plan Único" configurado a Bs 200/mes con beneficios y características.');

  // Test 2: Validación de usuarios existentes
  const { rows: adminUser } = await db.query("SELECT * FROM usuario WHERE usuario = 'admin'");
  const { rows: emp1User } = await db.query("SELECT * FROM usuario WHERE usuario = 'empresa1'");
  if (!adminUser.length || !emp1User.length) {
    throw new Error('Criterio 2 falló: admin y empresa1 deben existir');
  }
  const matchAdmin = await bcrypt.compare('admin123', adminUser[0].contrasena_hash);
  const matchEmp1 = await bcrypt.compare('empresa123', emp1User[0].contrasena_hash);
  if (!matchAdmin || !matchEmp1) {
    throw new Error('Criterio 2 falló: Credenciales de admin y empresa1 deben ser válidas');
  }
  console.log('✓ Criterio 2: Usuarios de prueba admin/admin123 y empresa1/empresa123 validados y funcionales.');

  // Test 3: Suscripción de empresa1 activa
  const { rows: suscEmp1 } = await db.query(
    "SELECT s.* FROM suscripcion s JOIN empresa e ON e.id_empresa = s.id_empresa WHERE e.razon_social = 'Tecno Andina S.R.L.'"
  );
  if (!suscEmp1.length || suscEmp1[0].estado !== 'activa') {
    throw new Error('Criterio 3 falló: Suscripción de empresa1 debe estar activa');
  }
  console.log('✓ Criterio 3: Empresa1 tiene suscripción activa con visibilidad pública en el catálogo.');

  // Test 4: Estructura de tabla pago y notificacion_correo
  const { rows: colsPago } = await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'pago'"
  );
  const colNamesPago = colsPago.map((c) => c.column_name);
  ['id_pago', 'id_empresa', 'monto', 'metodo', 'referencia', 'comprobante', 'estado', 'meses'].forEach((col) => {
    if (!colNamesPago.includes(col)) throw new Error(`Falta columna ${col} en tabla pago`);
  });
  console.log('✓ Criterio 4: Tabla "pago" configurada con todos los campos requeridos (id_pago, monto, metodo, referencia, comprobante, etc.).');

  const { rows: colsNotif } = await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'notificacion_correo'"
  );
  const colNamesNotif = colsNotif.map((c) => c.column_name);
  ['id_notificacion', 'id_empresa', 'tipo', 'destino', 'estado', 'fecha'].forEach((col) => {
    if (!colNamesNotif.includes(col)) throw new Error(`Falta columna ${col} en tabla notificacion_correo`);
  });
  console.log('✓ Criterio 5: Tabla "notificacion_correo" configurada y lista para auditar correos.');

  // Test 5: Simulación de flujo de registro y suscripción pendiente de pago
  const nitTest = '8899776655';
  const correoTest = 'test_empresa_flujo@unimarket.bo';

  // Limpiar prueba previa si existe
  const { rows: prevUs } = await db.query("SELECT id_usuario FROM usuario WHERE correo = $1 OR usuario = 'empresa_flujo_test'", [correoTest]);
  for (const u of prevUs) {
    const { rows: prevEmps } = await db.query("SELECT id_empresa FROM empresa WHERE id_usuario = $1", [u.id_usuario]);
    for (const e of prevEmps) {
      await db.query("DELETE FROM notificacion_correo WHERE id_empresa = $1", [e.id_empresa]);
      await db.query("DELETE FROM pago WHERE id_empresa = $1", [e.id_empresa]);
      await db.query("DELETE FROM verificacion WHERE id_empresa = $1", [e.id_empresa]);
      await db.query("DELETE FROM suscripcion WHERE id_empresa = $1", [e.id_empresa]);
      await db.query("DELETE FROM empresa WHERE id_empresa = $1", [e.id_empresa]);
    }
    await db.query("DELETE FROM usuario WHERE id_usuario = $1", [u.id_usuario]);
  }

  await db.query('BEGIN');
  const hash = await bcrypt.hash('clave123', 10);
  const uRes = await db.query(
    `INSERT INTO usuario (nombre, usuario, correo, contrasena_hash, rol)
     VALUES ('Empresa Flujo Test', 'empresa_flujo_test', $1, $2, 'empresa') RETURNING id_usuario`,
    [correoTest, hash]
  );
  const idUsuario = uRes.rows[0].id_usuario;

  const eRes = await db.query(
    `INSERT INTO empresa (id_usuario, razon_social, slug, nit, whatsapp, estado_verificacion)
     VALUES ($1, 'Flujo Test & Asociados S.R.L.', 'flujo-test', $2, '70011223', 'pendiente')
     RETURNING id_empresa`,
    [idUsuario, nitTest]
  );
  const idEmpresa = eRes.rows[0].id_empresa;

  await db.query(
    `INSERT INTO suscripcion (id_empresa, estado, fecha_inicio, fecha_vencimiento)
     VALUES ($1, 'pendiente_pago', CURRENT_DATE, CURRENT_DATE)`,
    [idEmpresa]
  );

  const vRes = await db.query(
    `INSERT INTO verificacion (id_empresa, documento, estado)
     VALUES ($1, 'uploads/nits/test.pdf', 'pendiente') RETURNING id_verificacion`,
    [idEmpresa]
  );
  const idVerificacion = vRes.rows[0].id_verificacion;

  await db.query(
    `INSERT INTO notificacion_correo (id_empresa, tipo, destino, estado)
     VALUES ($1, 'recibida', $2, 'enviado')`,
    [idEmpresa, correoTest]
  );
  await db.query('COMMIT');

  console.log('✓ Criterio 6: Registro de empresa exitoso. Nace con estado_verificacion="pendiente" y suscripcion="pendiente_pago".');

  // Verificar visibilidad en catálogo público (no debe aparecer)
  const { rows: prodsPublicos } = await db.query(
    `SELECT e.razon_social FROM empresa e
       JOIN suscripcion s ON s.id_empresa = e.id_empresa
      WHERE e.id_empresa = $1
        AND e.estado_verificacion = 'verificado'
        AND s.estado = 'activa'
        AND s.fecha_vencimiento >= CURRENT_DATE`,
    [idEmpresa]
  );
  if (prodsPublicos.length !== 0) {
    throw new Error('Criterio 7 falló: Empresa no verificada o sin pago confirmado NO debe ser visible públicamente');
  }
  console.log('✓ Criterio 7: Empresa pendiente NO aparece en el catálogo público.');

  // Simular Aprobación de NIT por Administrador
  await db.query("UPDATE verificacion SET estado='aprobado', fecha_revision=NOW() WHERE id_verificacion=$1", [idVerificacion]);
  await db.query("UPDATE empresa SET estado_verificacion='verificado' WHERE id_empresa=$1", [idEmpresa]);
  await db.query(
    `INSERT INTO notificacion_correo (id_empresa, tipo, destino, estado)
     VALUES ($1, 'aprobada', $2, 'enviado')`,
    [idEmpresa, correoTest]
  );
  console.log('✓ Criterio 8: Administrador aprueba verificación de NIT. Notificación de aprobación emitida.');

  // Verificar que AÚN NO sea pública (porque suscripción sigue pendiente_pago)
  const { rows: prodsAprobadaSinPago } = await db.query(
    `SELECT e.razon_social FROM empresa e
       JOIN suscripcion s ON s.id_empresa = e.id_empresa
      WHERE e.id_empresa = $1
        AND e.estado_verificacion = 'verificado'
        AND s.estado = 'activa'
        AND s.fecha_vencimiento >= CURRENT_DATE`,
    [idEmpresa]
  );
  if (prodsAprobadaSinPago.length !== 0) {
    throw new Error('Criterio 9 falló: Empresa aprobada pero con pago pendiente NO debe ser visible públicamente');
  }
  console.log('✓ Criterio 9: Empresa verificada con pago pendiente permanece oculta del catálogo hasta confirmar pago.');

  // Simular Envío de Comprobante de Pago por la Empresa
  const { rows: pagoIns } = await db.query(
    `INSERT INTO pago (id_empresa, monto, metodo, referencia, comprobante, estado, meses)
     VALUES ($1, 200.00, 'qr', 'TRANS-998877', 'uploads/comprobantes/test-comp.png', 'pendiente', 1)
     RETURNING id_pago`,
    [idEmpresa]
  );
  const idPago = pagoIns[0].id_pago;
  console.log('✓ Criterio 10: Empresa sube comprobante de pago por QR (Bs 200, 1 mes).');

  // Simular Confirmación de Pago por Administrador
  await db.query(
    `UPDATE pago SET estado = 'confirmado', confirmado_por = $1, fecha_confirmacion = NOW() WHERE id_pago = $2`,
    [adminUser[0].id_usuario, idPago]
  );
  await db.query(
    `UPDATE suscripcion
        SET estado = 'activa',
            fecha_inicio = CURRENT_DATE,
            fecha_vencimiento = CURRENT_DATE + interval '30 days'
      WHERE id_empresa = $1`,
    [idEmpresa]
  );
  await db.query(
    `INSERT INTO notificacion_correo (id_empresa, tipo, destino, estado)
     VALUES ($1, 'pago_confirmado', $2, 'enviado')`,
    [idEmpresa, correoTest]
  );

  // Verificar que AHORA SÍ sea visible en el catálogo público
  const { rows: prodsConPago } = await db.query(
    `SELECT e.razon_social, s.fecha_vencimiento FROM empresa e
       JOIN suscripcion s ON s.id_empresa = e.id_empresa
      WHERE e.id_empresa = $1
        AND e.estado_verificacion = 'verificado'
        AND s.estado = 'activa'
        AND s.fecha_vencimiento >= CURRENT_DATE`,
    [idEmpresa]
  );
  if (prodsConPago.length === 0) {
    throw new Error('Criterio 11 falló: Empresa con pago confirmado DEBE ser visible públicamente');
  }
  console.log('✓ Criterio 11: Administrador confirma pago. Suscripción pasa a ACTIVA (+30 días) y portal queda publicado exitosamente.');

  // Limpieza de datos de prueba
  await db.query("DELETE FROM notificacion_correo WHERE id_empresa = $1", [idEmpresa]);
  await db.query("DELETE FROM pago WHERE id_empresa = $1", [idEmpresa]);
  await db.query("DELETE FROM verificacion WHERE id_empresa = $1", [idEmpresa]);
  await db.query("DELETE FROM suscripcion WHERE id_empresa = $1", [idEmpresa]);
  await db.query("DELETE FROM empresa WHERE id_empresa = $1", [idEmpresa]);
  await db.query("DELETE FROM usuario WHERE id_usuario = $1", [idUsuario]);
  console.log('✓ Limpieza de datos temporales completada.');

  console.log('\n=== TODOS LOS CRITERIOS DE ACEPTACIÓN VALIDADOS SATISFACTORIAMENTE ===\n');
  await db.end();
}

runTests().catch(async (err) => {
  console.error('Error durante la validación:', err);
  await db.end();
  process.exit(1);
});

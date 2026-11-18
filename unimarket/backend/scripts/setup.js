// Crea la base de datos (si no existe), las tablas y los datos iniciales.
// Uso: npm run setup
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/unimarket';

async function crearBaseSiNoExiste() {
  const u = new URL(DB_URL.replace(/^postgres:/, 'postgresql:'));
  const dbName = u.pathname.slice(1);
  u.pathname = '/postgres';
  const admin = new Client({ connectionString: u.toString() });
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!rowCount) {
    await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
    console.log(`Base de datos "${dbName}" creada`);
  }
  await admin.end();
}

async function main() {
  await crearBaseSiNoExiste();
  const db = new Client({ connectionString: DB_URL });
  await db.connect();

  const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.sql'), 'utf8');
  await db.query(schema);
  console.log('Tablas y migraciones aplicadas');

  // Asegurar que si existen registros sin slug, tengan uno asignado antes de poner NOT NULL
  await db.query("UPDATE empresa SET slug = 'tecno-andina' WHERE slug IS NULL");

  const hAdmin = await bcrypt.hash('admin123', 10);
  const hEmp = await bcrypt.hash('empresa123', 10);

  await db.query(
    `INSERT INTO usuario (nombre, usuario, correo, contrasena_hash, rol)
     VALUES ('Administrador General','admin','admin@unimarket.bo',$1,'administrador')
     ON CONFLICT (usuario) DO NOTHING`,
    [hAdmin]
  );

  const u = await db.query(
    `INSERT INTO usuario (nombre, usuario, correo, contrasena_hash, rol)
     VALUES ('Tecno Andina S.R.L.','empresa1','per1per9@gmail.com',$1,'empresa')
     ON CONFLICT (usuario) DO UPDATE SET usuario = EXCLUDED.usuario, correo = EXCLUDED.correo RETURNING id_usuario`,
    [hEmp]
  );

  const e = await db.query(
    `INSERT INTO empresa (id_usuario, razon_social, slug, nit, correo, telefono, whatsapp, sitio_web, descripcion, direccion, facebook, instagram, estado_verificacion)
     VALUES ($1,'Tecno Andina S.R.L.','tecno-andina','1023456789','per1per9@gmail.com','22123456','59170000001','https://tecnoandina.example',
             'Líderes en importación y distribución de electrónica, computación y gadgets en Bolivia. Garantía oficial y soporte técnico especializado.',
             'Av. 6 de Agosto #2450, Sopocachi, La Paz',
             'https://facebook.com/tecnoandinabo',
             'https://instagram.com/tecnoandinabo',
             'verificado')
     ON CONFLICT (id_usuario) DO UPDATE SET
       estado_verificacion = 'verificado',
       correo = EXCLUDED.correo,
       slug = EXCLUDED.slug,
       descripcion = EXCLUDED.descripcion,
       direccion = EXCLUDED.direccion,
       facebook = EXCLUDED.facebook,
       instagram = EXCLUDED.instagram
     RETURNING id_empresa`,
    [u.rows[0].id_usuario]
  );
  const id_empresa = e.rows[0].id_empresa;

  await db.query(
    `INSERT INTO verificacion (id_empresa, estado, observacion, fecha_revision)
     SELECT $1,'aprobado',NULL,NOW()
      WHERE NOT EXISTS (SELECT 1 FROM verificacion WHERE id_empresa = $1)`,
    [id_empresa]
  );
  await db.query(
    `INSERT INTO suscripcion (id_empresa, estado, fecha_vencimiento)
     VALUES ($1,'activa', CURRENT_DATE + 365)
     ON CONFLICT (id_empresa) DO UPDATE SET estado='activa', fecha_vencimiento = CURRENT_DATE + 365`,
    [id_empresa]
  );

  const beneficiosPlan = [
    'Centralización de tus datos: catálogo, precios y disponibilidad siempre actualizados en un solo lugar.',
    'Portal individual propio dentro de UNIMARKET BO, sin el costo de desarrollar un sitio web.',
    'Anuncios de tu portal en Facebook, Instagram y TikTok.',
    'Mayor alcance con la promoción global de UNIMARKET BO.',
    'Búsqueda avanzada y filtros que ponen tus productos frente a quien los busca.',
    'Contacto directo con tus clientes por WhatsApp.',
    'Insignia de empresa verificada comercialmente.',
    'Infraestructura, soporte y atención a la empresa.',
  ];

  await db.query(
    `INSERT INTO plan (id_plan, nombre, precio, moneda, periodo, descripcion, activo, beneficios)
     VALUES (1, 'Plan Único', 200.00, 'Bs', 'mes', 'Para empresas pequeñas y medianas que quieren vender más sin desarrollar su propio sitio web.', TRUE, $1)
     ON CONFLICT (id_plan) DO UPDATE SET
       nombre = EXCLUDED.nombre,
       precio = EXCLUDED.precio,
       moneda = EXCLUDED.moneda,
       periodo = EXCLUDED.periodo,
       descripcion = EXCLUDED.descripcion,
       activo = EXCLUDED.activo,
       beneficios = EXCLUDED.beneficios`,
    [JSON.stringify(beneficiosPlan)]
  );

  // Extensiones para búsquedas avanzadas (tolerancia a errores e insensibilidad a tildes)
  let tieneUnaccent = false;
  let tienePgTrgm = false;
  try {
    await db.query('CREATE EXTENSION IF NOT EXISTS unaccent');
    tieneUnaccent = true;
    console.log('Extensión unaccent habilitada');
  } catch (err) {
    console.warn('Nota: no se pudo habilitar extensión unaccent (se usará normalización alternativa sin tildes en JS):', err.message);
  }

  try {
    await db.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    tienePgTrgm = true;
    console.log('Extensión pg_trgm habilitada');
  } catch (err) {
    console.warn('Nota: no se pudo habilitar extensión pg_trgm (se usará coincidencia ILIKE sin trigramas):', err.message);
  }

  // Columnas e índices de marca y modelo (compatible con base de datos nueva y existente)
  await db.query('ALTER TABLE producto ADD COLUMN IF NOT EXISTS marca VARCHAR(80)');
  await db.query('ALTER TABLE producto ADD COLUMN IF NOT EXISTS modelo VARCHAR(80)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_producto_marca ON producto(LOWER(marca))');
  await db.query('CREATE INDEX IF NOT EXISTS idx_producto_modelo ON producto(LOWER(modelo))');

  if (tienePgTrgm) {
    try {
      await db.query('CREATE INDEX IF NOT EXISTS idx_producto_nombre_trgm ON producto USING gin (nombre gin_trgm_ops)');
      await db.query('CREATE INDEX IF NOT EXISTS idx_producto_marca_trgm ON producto USING gin (marca gin_trgm_ops)');
      await db.query('CREATE INDEX IF NOT EXISTS idx_producto_modelo_trgm ON producto USING gin (modelo gin_trgm_ops)');
    } catch (err) {
      console.warn('Nota creando índices trigram:', err.message);
    }
  }

  for (const c of ['Electrónica', 'Ropa y Calzado', 'Hogar', 'Alimentos y Bebidas', 'Herramientas', 'Papelería', 'Salud y Belleza', 'Deportes'])
    await db.query('INSERT INTO categoria (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING', [c]);

  const cat = async (n) => (await db.query('SELECT id_categoria FROM categoria WHERE nombre=$1', [n])).rows[0].id_categoria;
  const demo = [
    ['Audífonos Bluetooth Pro', 'Audífonos inalámbricos con cancelación de ruido y 30 horas de batería.', 349.9, true, 'Electrónica', 'SonicWave', 'SW-300'],
    ['Teclado Mecánico Compacto', 'Teclado 60% con switches rojos y retroiluminación RGB.', 420, true, 'Electrónica', 'KeyForge', 'KF-60'],
    ['Mouse Inalámbrico Ergonómico', 'Mouse vertical recargable, 3 niveles de DPI.', 150, false, 'Electrónica', 'ErgoMove', 'EM-V1'],
    ['Set de Destornilladores 32 Piezas', 'Juego de precisión para electrónica y reparaciones del hogar.', 89.5, true, 'Herramientas', 'ToolMaster', 'TM-32'],
    ['Lámpara LED de Escritorio', 'Luz regulable en 3 tonos con puerto USB de carga.', 120, true, 'Hogar', 'LumiDesk', 'LD-10'],
  ];

  const hay = await db.query('SELECT 1 FROM producto WHERE id_empresa = $1 LIMIT 1', [id_empresa]);
  if (!hay.rowCount) {
    for (const [n, d, p, disp, c, mrc, mdl] of demo)
      await db.query(
        'INSERT INTO producto (id_empresa,id_categoria,nombre,descripcion,precio,disponible,marca,modelo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [id_empresa, await cat(c), n, d, p, disp, mrc, mdl]
      );
  } else {
    // Si ya existen los productos de ejemplo, actualizar marca y modelo
    for (const [n, , , , , mrc, mdl] of demo) {
      await db.query(
        'UPDATE producto SET marca = $1, modelo = $2 WHERE id_empresa = $3 AND nombre = $4 AND (marca IS NULL OR modelo IS NULL)',
        [mrc, mdl, id_empresa, n]
      );
    }
  }

  await db.end();
  console.log('\nListo. Usuarios de prueba:');
  console.log('  admin    / admin123   (Administrador general)');
  console.log('  empresa1 / empresa123 (Empresa verificada - portal: /tienda/tecno-andina)');
}

main().catch((e) => {
  console.error('Error en setup:', e.message);
  process.exit(1);
});

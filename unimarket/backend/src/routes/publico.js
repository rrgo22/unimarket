const express = require('express');
const pool = require('../db');
const { REGLAS_USO } = require('../utils/reglas');

const router = express.Router();

// Regla de visibilidad centralizada: vista SQL v_empresas_publicas
// (empresa verificada, no eliminada, suscripción activa y vigente en America/La_Paz)

// Datos centralizados del Plan Único
router.get('/plan', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM plan WHERE activo = TRUE ORDER BY id_plan LIMIT 1');
    const dbPlan = rows[0] || {};
    const beneficiosDefecto = [
      'Centralización de tus datos: catálogo, precios y disponibilidad siempre actualizados en un solo lugar.',
      'Portal individual propio dentro de UNIMARKET BO, sin el costo de desarrollar un sitio web.',
      'Control de inventario con alertas automáticas de stock bajo por correo electrónico.',
      'Registro interno de ventas (WhatsApp y mostrador) y emisión de comprobantes en PDF.',
      'Reportes comerciales detallados por día, mes, año y producto con exportación a PDF.',
      'Anuncios de tu portal en Facebook, Instagram y TikTok.',
      'Mayor alcance con la promoción global de UNIMARKET BO.',
      'Búsqueda avanzada y filtros que ponen tus productos frente a quien los busca.',
      'Contacto directo con tus clientes por WhatsApp.',
      'Insignia de empresa verificada comercialmente.',
      'Infraestructura, soporte y atención a la empresa.',
    ];

    const pasos = [
      {
        numero: 1,
        titulo: 'Registra tu empresa',
        descripcion: 'Completa los datos de tu empresa, cuenta de acceso y adjunta tu documento de NIT en formato PDF.',
      },
      {
        numero: 2,
        titulo: 'Verificamos tu NIT (24 a 48 horas)',
        descripcion: 'Revisamos tu documentación legal y te enviamos por correo el aviso de aprobación y los datos de pago.',
      },
      {
        numero: 3,
        titulo: 'Realizas el pago por QR o transferencia y publicas tu catálogo',
        descripcion: 'Realizas el pago fuera de la plataforma, el administrador confirma tu suscripción y tu portal queda activo.',
      },
    ];

    const faqs = [
      {
        pregunta: '¿Cuánto tarda la aprobación?',
        respuesta: 'La revisión de sus datos y la verificación legal de su NIT tarda de 24 a 48 horas hábiles. Le notificaremos de inmediato por correo electrónico.',
      },
      {
        pregunta: '¿Qué documento necesito?',
        respuesta: 'Únicamente su documento de NIT en formato PDF emitido por el Servicio de Impuestos Nacionales (tamaño máximo de 5 MB).',
      },
      {
        pregunta: '¿Cómo se paga?',
        respuesta: 'Por QR simple o transferencia bancaria, una vez aprobada la empresa. El pago no se procesa dentro de la plataforma (las transacciones se realizan directamente fuera de ella conforme a las normas de seguridad).',
      },
      {
        pregunta: '¿Cómo contacto soporte?',
        respuesta: 'Puede escribirnos al correo electrónico oficial unimarketbo@gmail.com o a través de nuestros canales de atención para empresas.',
      },
    ];

    res.json({
      nombre: dbPlan.nombre || 'Plan Único',
      precio: dbPlan.precio ? Number(dbPlan.precio) : 200,
      moneda: dbPlan.moneda || 'Bs',
      periodo: dbPlan.periodo || 'mes',
      descripcion: dbPlan.descripcion || 'Para empresas pequeñas y medianas que quieren vender más sin desarrollar su propio sitio web.',
      beneficios: dbPlan.beneficios && Array.isArray(dbPlan.beneficios) && dbPlan.beneficios.length ? dbPlan.beneficios : beneficiosDefecto,
      pasos,
      faqs,
    });
  } catch (e) {
    next(e);
  }
});

// Reglas de uso oficiales de la plataforma
const cacheMemoria = new Map();
function getCache(clave) {
  const item = cacheMemoria.get(clave);
  if (!item) return null;
  if (Date.now() > item.expira) {
    cacheMemoria.delete(clave);
    return null;
  }
  return item.valor;
}
function setCache(clave, valor, ttlSegundos = 60) {
  cacheMemoria.set(clave, {
    valor,
    expira: Date.now() + ttlSegundos * 1000,
  });
}

// Detección dinámica de extensiones unaccent y pg_trgm en PostgreSQL
let extensionesCache = null;
async function obtenerExtensiones() {
  if (extensionesCache !== null) return extensionesCache;
  try {
    const { rows } = await pool.query("SELECT extname FROM pg_extension WHERE extname IN ('unaccent', 'pg_trgm')");
    const set = new Set(rows.map((r) => r.extname));
    extensionesCache = {
      unaccent: set.has('unaccent'),
      pg_trgm: set.has('pg_trgm'),
    };
  } catch {
    extensionesCache = { unaccent: false, pg_trgm: false };
  }
  return extensionesCache;
}

function normalizarSinTildes(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Límite de 60 solicitudes por minuto por IP para sugerencias
const ipSugerenciasCounts = new Map();
function rateLimitSugerencias(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const reg = ipSugerenciasCounts.get(ip);
  if (!reg || now > reg.resetTime) {
    ipSugerenciasCounts.set(ip, { count: 1, resetTime: now + 60000 });
    return next();
  }
  if (reg.count >= 60) {
    return res.status(429).json({ error: 'Límite de solicitudes de búsqueda alcanzado (60 por minuto). Intente en unos segundos.' });
  }
  reg.count++;
  next();
}

router.get('/reglas', (_req, res) => {
  res.json({ reglas: REGLAS_USO });
});

// Métricas y estadísticas reales públicas en vivo para el Hero (sin caché en servidor)
// empresas = empresas visibles; productos = productos disponibles de empresas visibles; rubros = categorías con al menos un producto visible
router.get('/estadisticas', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    const [empRes, prodRes, catRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM v_empresas_publicas`),
      pool.query(
        `SELECT COUNT(*)::int AS n
           FROM producto p
           JOIN v_empresas_publicas v ON v.id_empresa = p.id_empresa
          WHERE p.disponible = TRUE AND (p.stock_actual IS NULL OR p.stock_actual > 0)`
      ),
      pool.query(
        `SELECT COUNT(DISTINCT p.id_categoria)::int AS n
           FROM producto p
           JOIN v_empresas_publicas v ON v.id_empresa = p.id_empresa
          WHERE p.disponible = TRUE AND (p.stock_actual IS NULL OR p.stock_actual > 0)`
      ),
    ]);

    const empresas = empRes.rows[0]?.n || 0;
    const productos = prodRes.rows[0]?.n || 0;
    const rubros = catRes.rows[0]?.n || 0;

    res.json({
      empresas,
      productos,
      rubros,
      categorias: rubros, // Sincronizado para retrocompatibilidad total
    });
  } catch (e) {
    next(e);
  }
});

// Lista de categorías con cantidad de productos visibles
router.get('/categorias', async (_req, res, next) => {
  try {
    const cached = getCache('categorias');
    if (cached) return res.json(cached);

    const { rows } = await pool.query(
      `SELECT c.id_categoria, c.nombre,
              (SELECT COUNT(*)::int
                 FROM producto p
                 JOIN v_empresas_publicas e ON e.id_empresa = p.id_empresa
                WHERE p.id_categoria = c.id_categoria
                  AND p.disponible = TRUE
                  AND (p.stock_actual IS NULL OR p.stock_actual > 0)) AS total_productos
         FROM categoria c
        ORDER BY c.nombre ASC`
    );

    const data = rows.map((r) => ({
      id_categoria: r.id_categoria,
      nombre: r.nombre,
      total_productos: r.total_productos,
      productos: r.total_productos,
    }));

    setCache('categorias', data, 60);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

// Resumen de una categoría: empresas verificadas que venden en ella y hasta 4 productos destacados
router.get('/categorias/:id/resumen', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador no válido' });

    const cacheKey = `cat_resumen_${id}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const catRes = await pool.query(
      `SELECT c.id_categoria, c.nombre,
              (SELECT COUNT(*)::int
                 FROM producto p
                 JOIN v_empresas_publicas e ON e.id_empresa = p.id_empresa
                WHERE p.id_categoria = c.id_categoria
                  AND p.disponible = TRUE
                  AND (p.stock_actual IS NULL OR p.stock_actual > 0)) AS total_productos
         FROM categoria c
        WHERE c.id_categoria = $1`,
      [id]
    );

    if (!catRes.rows.length) return res.status(404).json({ error: 'Categoría no encontrada' });
    const categoria = catRes.rows[0];

    // Empresas verificadas con suscripción activa que venden en esta categoría
    const empresasRes = await pool.query(
      `SELECT e.id_empresa, e.razon_social, e.slug, e.logo,
              COUNT(p.id_producto)::int AS productos_en_categoria
         FROM v_empresas_publicas e
         JOIN producto p ON p.id_empresa = e.id_empresa AND p.id_categoria = $1
        WHERE p.disponible = TRUE AND (p.stock_actual IS NULL OR p.stock_actual > 0)
        GROUP BY e.id_empresa, e.razon_social, e.slug, e.logo
        ORDER BY productos_en_categoria DESC, e.razon_social ASC
        LIMIT 6`,
      [id]
    );

    // Hasta 4 productos destacados disponibles con primera imagen
    const prodsRes = await pool.query(
      `SELECT p.id_producto, p.nombre, p.precio, p.disponible,
              e.razon_social AS empresa, e.slug AS empresa_slug,
              (SELECT ruta FROM imagen_producto i WHERE i.id_producto = p.id_producto ORDER BY id_imagen LIMIT 1) AS imagen
         FROM producto p
         JOIN v_empresas_publicas e ON e.id_empresa = p.id_empresa
        WHERE p.id_categoria = $1 AND p.disponible = TRUE AND (p.stock_actual IS NULL OR p.stock_actual > 0)
        ORDER BY p.creado_en DESC, p.id_producto DESC
        LIMIT 4`,
      [id]
    );

    const resumen = {
      categoria,
      empresas: empresasRes.rows,
      destacados: prodsRes.rows,
    };

    setCache(cacheKey, resumen, 60);
    res.json(resumen);
  } catch (e) {
    next(e);
  }
});

// Directorio de empresas públicas verificadas con suscripción activa (?q=, ?categoria=, ?pagina=, ?limite=)
router.get('/empresas', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const cat = parseInt(req.query.categoria, 10);
    const limite = Math.max(1, Math.min(50, parseInt(req.query.limite, 10) || 12));
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);

    const where = [];
    const params = [];
    const add = (v) => (params.push(v), `$${params.length}`);

    if (q) {
      const p = add(`%${q.replace(/[%_\\]/g, '\\$&')}%`);
      where.push(`(e.razon_social ILIKE ${p} OR COALESCE(e.descripcion, '') ILIKE ${p})`);
    }

    if (Number.isInteger(cat) && cat > 0) {
      const pCat = add(cat);
      where.push(
        `EXISTS (SELECT 1 FROM producto p2 WHERE p2.id_empresa = e.id_empresa AND p2.id_categoria = ${pCat} AND p2.disponible = TRUE AND (p2.stock_actual IS NULL OR p2.stock_actual > 0))`
      );
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const fromClause = `FROM v_empresas_publicas e ${whereClause}`;

    const totalRes = await pool.query(`SELECT COUNT(*)::int AS n ${fromClause}`, params);
    const total = totalRes.rows[0].n;

    const offset = (pagina - 1) * limite;
    const limitParam = add(limite);
    const offsetParam = add(offset);

    const { rows } = await pool.query(
      `SELECT e.id_empresa, e.razon_social, e.slug, e.logo, e.descripcion, e.direccion, e.ciudad,
              (SELECT COUNT(*)::int FROM producto p WHERE p.id_empresa = e.id_empresa AND p.disponible = TRUE AND (p.stock_actual IS NULL OR p.stock_actual > 0)) AS productos
       ${fromClause}
       ORDER BY e.razon_social ASC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    res.json({
      total,
      pagina,
      paginas: Math.ceil(total / limite) || 1,
      empresas: rows,
    });
  } catch (e) {
    next(e);
  }
});

// Portal individual de una empresa por slug (soporta /empresas/:slug y /empresa/:slug)
router.get(['/empresas/:slug', '/empresa/:slug'], async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const { rows } = await pool.query(
      `SELECT v.id_empresa, v.razon_social, v.slug, v.descripcion, v.logo, v.portada,
              v.direccion, v.ciudad, v.sitio_web, v.facebook, v.instagram, v.tiktok,
              v.telefono, v.whatsapp,
              (SELECT COUNT(*)::int FROM producto p WHERE p.id_empresa = v.id_empresa AND p.disponible = TRUE AND (p.stock_actual IS NULL OR p.stock_actual > 0)) AS total_productos
         FROM v_empresas_publicas v
        WHERE v.slug = $1`,
      [slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Esta empresa no está disponible o no se encuentra activa' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// Categorías con productos disponibles dentro del portal de una empresa
router.get(['/empresas/:slug/categorias', '/empresa/:slug/categorias'], async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const { rows } = await pool.query(
      `SELECT DISTINCT c.id_categoria, c.nombre,
              COUNT(p.id_producto)::int AS total_productos
         FROM categoria c
         JOIN producto p ON p.id_categoria = c.id_categoria
         JOIN v_empresas_publicas v ON v.id_empresa = p.id_empresa
        WHERE v.slug = $1 AND p.disponible = TRUE AND (p.stock_actual IS NULL OR p.stock_actual > 0)
        GROUP BY c.id_categoria, c.nombre
        ORDER BY c.nombre ASC`,
      [slug]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Catálogo de productos filtrable para el portal de una empresa específica
router.get(['/empresas/:slug/productos', '/empresa/:slug/productos'], async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const empRes = await pool.query(
      `SELECT v.id_empresa, v.razon_social, v.slug, v.logo
         FROM v_empresas_publicas v
        WHERE v.slug = $1`,
      [slug]
    );
    if (!empRes.rows.length) return res.status(404).json({ error: 'Esta empresa no está disponible o no se encuentra activa' });
    const emp = empRes.rows[0];

    const where = ['p.id_empresa = $1'];
    const params = [emp.id_empresa];
    const add = (v) => (params.push(v), `$${params.length}`);

    const q = String(req.query.q || '').trim().slice(0, 100);
    if (q) {
      const p = add(`%${q.replace(/[%_\\]/g, '\\$&')}%`);
      where.push(`(p.nombre ILIKE ${p} OR p.descripcion ILIKE ${p})`);
    }
    const cat = parseInt(req.query.categoria, 10);
    if (Number.isInteger(cat)) where.push(`p.id_categoria = ${add(cat)}`);
    const min = parseFloat(req.query.min);
    if (Number.isFinite(min)) where.push(`p.precio >= ${add(min)}`);
    const max = parseFloat(req.query.max);
    if (Number.isFinite(max)) where.push(`p.precio <= ${add(max)}`);
    if (req.query.disponible === 'true') where.push('p.disponible = TRUE');
    if (req.query.disponible === 'false') where.push('p.disponible = FALSE');

    const limite = 12;
    const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1);
    const from = `FROM producto p
                  JOIN categoria c ON c.id_categoria = p.id_categoria
                  WHERE ${where.join(' AND ')}`;

    const total = await pool.query(`SELECT COUNT(*)::int AS n ${from}`, params);
    const { rows } = await pool.query(
      `SELECT p.id_producto, p.nombre, p.marca, p.modelo, p.descripcion, p.precio, p.disponible,
              p.stock_actual, p.stock_minimo, p.sku, p.unidad,
              p.unidad_venta, p.unidades_por_paquete, p.cantidad_minima, p.color_unico,
              c.nombre AS categoria, emp.razon_social AS empresa, emp.slug AS empresa_slug, emp.logo AS empresa_logo,
              (SELECT ruta FROM imagen_producto i WHERE i.id_producto = p.id_producto ORDER BY id_imagen LIMIT 1) AS imagen,
              (SELECT COALESCE(json_agg(json_build_object('id', pc.id, 'nombre', pc.nombre, 'codigo_hex', pc.codigo_hex)), '[]'::json)
                 FROM producto_color pc WHERE pc.id_producto = p.id_producto AND pc.activo = TRUE) AS colores
       FROM producto p
       JOIN categoria c ON c.id_categoria = p.id_categoria
       CROSS JOIN (SELECT $2::text AS razon_social, $3::text AS slug, $4::text AS logo) emp
       WHERE ${where.join(' AND ')}
       ORDER BY p.creado_en DESC, p.id_producto DESC
       LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`,
      [...params, emp.razon_social, emp.slug, emp.logo]
    );
    res.json({ total: total.rows[0].n, pagina, paginas: Math.ceil(total.rows[0].n / limite), productos: rows, empresa: emp });
  } catch (e) {
    next(e);
  }
});

// Enlace de WhatsApp general para el portal de una empresa
router.get(['/empresas/:slug/contacto', '/empresa/:slug/contacto'], async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const { rows } = await pool.query(
      `SELECT v.razon_social, v.whatsapp
         FROM v_empresas_publicas v
        WHERE v.slug = $1`,
      [slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Esta empresa no está disponible' });
    if (!rows[0].whatsapp) return res.status(404).json({ error: 'La empresa no tiene un canal de WhatsApp disponible' });
    const texto = `Hola ${rows[0].razon_social}, me comunico desde su portal en UNIMARKET BO.`;
    res.json({ url: `https://wa.me/${rows[0].whatsapp}?text=${encodeURIComponent(texto)}` });
  } catch (e) {
    next(e);
  }
});

// Registro de métrica o contacto WhatsApp del portal
router.post(['/empresas/:slug/contacto-whatsapp', '/empresa/:slug/contacto-whatsapp'], async (_req, res) => {
  res.json({ ok: true });
});

// Lista de marcas de productos visibles con cantidad
router.get('/marcas', async (_req, res, next) => {
  try {
    const cacheKey = 'marcas_visibles';
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const { rows } = await pool.query(
      `SELECT p.marca, COUNT(*)::int AS total_productos
         FROM producto p
         JOIN v_empresas_publicas e ON e.id_empresa = p.id_empresa
        WHERE p.disponible = TRUE AND (p.stock_actual IS NULL OR p.stock_actual > 0)
          AND p.marca IS NOT NULL AND TRIM(p.marca) != ''
          AND NOT EXISTS (
            SELECT 1 FROM marca_prohibida mp WHERE LOWER(TRIM(mp.nombre)) = LOWER(TRIM(p.marca))
          )
        GROUP BY p.marca
        ORDER BY p.marca ASC`
    );

    setCache(cacheKey, rows, 30);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Autocompletado y búsqueda sugerida avanzada con ranking y tolerancia a errores
router.get('/sugerencias', rateLimitSugerencias, async (req, res, next) => {
  try {
    const rawQ = String(req.query.q || '').trim();
    const q = rawQ.slice(0, 60);
    if (q.length < 2) {
      return res.json({ productos: [], marcas: [], modelos: [], categorias: [], empresas: [] });
    }

    const qNorm = normalizarSinTildes(q);
    const cacheKey = `sug_${qNorm}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const { unaccent, pg_trgm } = await obtenerExtensiones();
    const qEscapado = q.replace(/[%_\\]/g, '\\$&');
    const patLike = `%${qEscapado}%`;
    const prefijoLike = `${qEscapado}%`;

    const sinonimos = {
      raton: 'mouse',
      ratones: 'mouse',
      mause: 'mouse',
      auricular: 'audifonos',
      auriculares: 'audifonos',
      pantalla: 'monitor',
    };
    const palabraSinonimo = sinonimos[qNorm] || null;
    const patSinonimo = palabraSinonimo ? `%${palabraSinonimo}%` : null;

    let matchExpr;
    let rankExpr;
    let params;

    if (unaccent && pg_trgm) {
      params = [patLike, prefijoLike, q];
      let sinonimoClause = '';
      if (palabraSinonimo) {
        params.push(patSinonimo);
        sinonimoClause = `OR unaccent(p.nombre) ILIKE unaccent($${params.length}::text)`;
      }
      matchExpr = `(
        unaccent(p.nombre) ILIKE unaccent($1::text)
        OR (p.marca IS NOT NULL AND unaccent(p.marca) ILIKE unaccent($1::text))
        OR (p.modelo IS NOT NULL AND unaccent(p.modelo) ILIKE unaccent($1::text))
        OR unaccent(c.nombre) ILIKE unaccent($1::text)
        OR unaccent(e.razon_social) ILIKE unaccent($1::text)
        OR similarity(unaccent(p.nombre), unaccent($3::text)) >= 0.25
        OR word_similarity(unaccent($3::text), unaccent(p.nombre)) >= 0.25
        OR (p.marca IS NOT NULL AND word_similarity(unaccent($3::text), unaccent(p.marca)) >= 0.25)
        OR (p.modelo IS NOT NULL AND word_similarity(unaccent($3::text), unaccent(p.modelo)) >= 0.25)
        ${sinonimoClause}
      )`;
      rankExpr = `
        CASE
          WHEN unaccent(p.nombre) ILIKE unaccent($2::text) THEN 1
          WHEN p.marca IS NOT NULL AND unaccent(p.marca) ILIKE unaccent($2::text) THEN 2
          WHEN p.modelo IS NOT NULL AND unaccent(p.modelo) ILIKE unaccent($2::text) THEN 2
          WHEN unaccent(p.nombre) ILIKE unaccent($1::text) THEN 3
          WHEN p.marca IS NOT NULL AND unaccent(p.marca) ILIKE unaccent($1::text) THEN 4
          WHEN p.modelo IS NOT NULL AND unaccent(p.modelo) ILIKE unaccent($1::text) THEN 4
          ELSE 5
        END
      `;
    } else if (unaccent) {
      params = [patLike, prefijoLike];
      let sinonimoClause = '';
      if (palabraSinonimo) {
        params.push(patSinonimo);
        sinonimoClause = `OR unaccent(p.nombre) ILIKE unaccent($${params.length}::text)`;
      }
      matchExpr = `(
        unaccent(p.nombre) ILIKE unaccent($1::text)
        OR (p.marca IS NOT NULL AND unaccent(p.marca) ILIKE unaccent($1::text))
        OR (p.modelo IS NOT NULL AND unaccent(p.modelo) ILIKE unaccent($1::text))
        OR unaccent(c.nombre) ILIKE unaccent($1::text)
        OR unaccent(e.razon_social) ILIKE unaccent($1::text)
        ${sinonimoClause}
      )`;
      rankExpr = `
        CASE
          WHEN unaccent(p.nombre) ILIKE unaccent($2::text) THEN 1
          WHEN p.marca IS NOT NULL AND unaccent(p.marca) ILIKE unaccent($2::text) THEN 2
          WHEN p.modelo IS NOT NULL AND unaccent(p.modelo) ILIKE unaccent($2::text) THEN 2
          WHEN unaccent(p.nombre) ILIKE unaccent($1::text) THEN 3
          ELSE 4
        END
      `;
    } else {
      params = [patLike, prefijoLike];
      let sinonimoClause = '';
      if (palabraSinonimo) {
        params.push(patSinonimo);
        sinonimoClause = `OR p.nombre ILIKE $${params.length}`;
      }
      matchExpr = `(
        p.nombre ILIKE $1
        OR (p.marca IS NOT NULL AND p.marca ILIKE $1)
        OR (p.modelo IS NOT NULL AND p.modelo ILIKE $1)
        OR c.nombre ILIKE $1
        OR e.razon_social ILIKE $1
        ${sinonimoClause}
      )`;
      rankExpr = `
        CASE
          WHEN p.nombre ILIKE $2 THEN 1
          WHEN p.marca IS NOT NULL AND p.marca ILIKE $2 THEN 2
          WHEN p.modelo IS NOT NULL AND p.modelo ILIKE $2 THEN 2
          WHEN p.nombre ILIKE $1 THEN 3
          ELSE 4
        END
      `;
    }

    const prodsQuery = `
      SELECT p.id_producto, p.nombre, p.marca, p.modelo, p.precio, p.disponible,
             c.id_categoria, c.nombre AS categoria,
             e.id_empresa, e.razon_social AS empresa, e.slug AS empresa_slug, e.logo AS empresa_logo,
             (SELECT ruta FROM imagen_producto i WHERE i.id_producto = p.id_producto ORDER BY id_imagen LIMIT 1) AS imagen,
             ${rankExpr} AS ranking
        FROM producto p
        JOIN categoria c ON c.id_categoria = p.id_categoria
        JOIN v_empresas_publicas e ON e.id_empresa = p.id_empresa
       WHERE p.disponible = TRUE AND (p.stock_actual IS NULL OR p.stock_actual > 0) AND ${matchExpr}
       ORDER BY ranking ASC, p.id_producto DESC
       LIMIT 12
    `;

    const prodsRes = await pool.query(prodsQuery, params);
    const productosEncontrados = prodsRes.rows;

    const productos = productosEncontrados.slice(0, 5).map((p) => ({
      id_producto: p.id_producto,
      nombre: p.nombre,
      marca: p.marca,
      modelo: p.modelo,
      precio: p.precio,
      imagen: p.imagen,
      empresa: p.empresa,
      empresa_slug: p.empresa_slug,
      categoria: p.categoria,
    }));

    const marcasVistas = new Set();
    const marcasList = [];
    for (const p of productosEncontrados) {
      if (p.marca && !marcasVistas.has(p.marca.toLowerCase())) {
        marcasVistas.add(p.marca.toLowerCase());
        marcasList.push(p.marca);
      }
    }
    if (marcasList.length < 4) {
      const marcasDir = await pool.query(
        `SELECT DISTINCT p.marca
           FROM producto p
           JOIN v_empresas_publicas e ON e.id_empresa = p.id_empresa
          WHERE p.disponible = TRUE AND (p.stock_actual IS NULL OR p.stock_actual > 0)
            AND p.marca IS NOT NULL AND TRIM(p.marca) != ''
            AND ${unaccent ? 'unaccent(p.marca) ILIKE unaccent($1::text)' : 'p.marca ILIKE $1'}
          LIMIT 4`,
        [patLike]
      );
      for (const row of marcasDir.rows) {
        if (!marcasVistas.has(row.marca.toLowerCase())) {
          marcasVistas.add(row.marca.toLowerCase());
          marcasList.push(row.marca);
          if (marcasList.length >= 4) break;
        }
      }
    }
    const marcas = marcasList.slice(0, 4).map((m) => ({ marca: m }));

    const modelosVistos = new Set();
    const modelosList = [];
    for (const p of productosEncontrados) {
      if (p.modelo && !modelosVistos.has(p.modelo.toLowerCase())) {
        modelosVistos.add(p.modelo.toLowerCase());
        modelosList.push({ modelo: p.modelo, marca: p.marca || '' });
      }
    }
    if (modelosList.length < 4) {
      const modelosDir = await pool.query(
        `SELECT DISTINCT p.modelo, p.marca
           FROM producto p
           JOIN v_empresas_publicas e ON e.id_empresa = p.id_empresa
          WHERE p.disponible = TRUE AND (p.stock_actual IS NULL OR p.stock_actual > 0)
            AND p.modelo IS NOT NULL AND TRIM(p.modelo) != ''
            AND ${unaccent ? 'unaccent(p.modelo) ILIKE unaccent($1::text)' : 'p.modelo ILIKE $1'}
          LIMIT 4`,
        [patLike]
      );
      for (const row of modelosDir.rows) {
        if (!modelosVistos.has(row.modelo.toLowerCase())) {
          modelosVistos.add(row.modelo.toLowerCase());
          modelosList.push({ modelo: row.modelo, marca: row.marca || '' });
          if (modelosList.length >= 4) break;
        }
      }
    }
    const modelos = modelosList.slice(0, 4);

    const catsVistas = new Set();
    const catsList = [];
    for (const p of productosEncontrados) {
      if (!catsVistas.has(p.id_categoria)) {
        catsVistas.add(p.id_categoria);
        catsList.push({ id_categoria: p.id_categoria, nombre: p.categoria });
      }
    }
    if (catsList.length < 3) {
      const catsDir = await pool.query(
        `SELECT DISTINCT c.id_categoria, c.nombre
           FROM categoria c
           JOIN producto p ON p.id_categoria = c.id_categoria
           JOIN v_empresas_publicas e ON e.id_empresa = p.id_empresa
          WHERE p.disponible = TRUE AND (p.stock_actual IS NULL OR p.stock_actual > 0)
            AND ${unaccent ? 'unaccent(c.nombre) ILIKE unaccent($1::text)' : 'c.nombre ILIKE $1'}
          LIMIT 3`,
        [patLike]
      );
      for (const row of catsDir.rows) {
        if (!catsVistas.has(row.id_categoria)) {
          catsVistas.add(row.id_categoria);
          catsList.push(row);
          if (catsList.length >= 3) break;
        }
      }
    }
    const categorias = catsList.slice(0, 3);

    const empsVistas = new Set();
    const empsList = [];
    const empsDir = await pool.query(
      `SELECT e.id_empresa, e.razon_social, e.slug, e.logo
         FROM v_empresas_publicas e
        WHERE ${unaccent ? 'unaccent(e.razon_social) ILIKE unaccent($1::text)' : 'e.razon_social ILIKE $1'}
        LIMIT 3`,
      [patLike]
    );
    for (const row of empsDir.rows) {
      if (!empsVistas.has(row.id_empresa)) {
        empsVistas.add(row.id_empresa);
        empsList.push(row);
      }
    }
    for (const p of productosEncontrados) {
      if (empsList.length >= 3) break;
      if (!empsVistas.has(p.id_empresa)) {
        empsVistas.add(p.id_empresa);
        empsList.push({
          id_empresa: p.id_empresa,
          razon_social: p.empresa,
          slug: p.empresa_slug,
          logo: p.empresa_logo,
        });
      }
    }
    const empresas = empsList.slice(0, 3);

    const respuesta = {
      productos,
      marcas,
      modelos,
      categorias,
      empresas,
    };

    setCache(cacheKey, respuesta, 30);
    res.json(respuesta);
  } catch (e) {
    next(e);
  }
});

// CU6 + CU7: catálogo público de productos
router.get('/productos', async (req, res, next) => {
  try {
    const { unaccent, pg_trgm } = await obtenerExtensiones();
    const where = [
      'p.disponible = TRUE',
      '(p.stock_actual IS NULL OR p.stock_actual > 0)',
      '(p.marca IS NULL OR NOT EXISTS (SELECT 1 FROM marca_prohibida mp WHERE LOWER(TRIM(mp.nombre)) = LOWER(TRIM(p.marca))))'
    ];
    const params = [];
    const add = (v) => (params.push(v), `$${params.length}`);

    const q = String(req.query.q || '').trim().slice(0, 100);
    if (q) {
      const qEscapado = q.replace(/[%_\\]/g, '\\$&');
      const pat = add(`%${qEscapado}%`);
      const termExact = add(q);
      if (unaccent && pg_trgm) {
        where.push(`(
          unaccent(p.nombre) ILIKE unaccent(${pat}::text)
          OR (p.marca IS NOT NULL AND unaccent(p.marca) ILIKE unaccent(${pat}::text))
          OR (p.modelo IS NOT NULL AND unaccent(p.modelo) ILIKE unaccent(${pat}::text))
          OR unaccent(c.nombre) ILIKE unaccent(${pat}::text)
          OR unaccent(e.razon_social) ILIKE unaccent(${pat}::text)
          OR similarity(unaccent(p.nombre), unaccent(${termExact}::text)) >= 0.25
          OR word_similarity(unaccent(${termExact}::text), unaccent(p.nombre)) >= 0.25
          OR (p.marca IS NOT NULL AND word_similarity(unaccent(${termExact}::text), unaccent(p.marca)) >= 0.25)
          OR (p.modelo IS NOT NULL AND word_similarity(unaccent(${termExact}::text), unaccent(p.modelo)) >= 0.25)
        )`);
      } else if (unaccent) {
        where.push(`(
          unaccent(p.nombre) ILIKE unaccent(${pat}::text)
          OR (p.marca IS NOT NULL AND unaccent(p.marca) ILIKE unaccent(${pat}::text))
          OR (p.modelo IS NOT NULL AND unaccent(p.modelo) ILIKE unaccent(${pat}::text))
          OR unaccent(c.nombre) ILIKE unaccent(${pat}::text)
          OR unaccent(e.razon_social) ILIKE unaccent(${pat}::text)
        )`);
      } else {
        where.push(`(
          p.nombre ILIKE ${pat}
          OR (p.marca IS NOT NULL AND p.marca ILIKE ${pat})
          OR (p.modelo IS NOT NULL AND p.modelo ILIKE ${pat})
          OR c.nombre ILIKE ${pat}
          OR e.razon_social ILIKE ${pat}
        )`);
      }
    }

    const cat = parseInt(req.query.categoria, 10);
    if (Number.isInteger(cat)) where.push(`p.id_categoria = ${add(cat)}`);

    const marca = String(req.query.marca || '').trim();
    if (marca) {
      where.push(`LOWER(p.marca) = LOWER(${add(marca)})`);
    }

    const min = parseFloat(req.query.min);
    if (Number.isFinite(min)) where.push(`p.precio >= ${add(min)}`);
    const max = parseFloat(req.query.max);
    if (Number.isFinite(max)) where.push(`p.precio <= ${add(max)}`);

    const ordenQuery = String(req.query.orden || 'recientes').toLowerCase();
    let orderBy = 'p.creado_en DESC, p.id_producto DESC';
    if (ordenQuery === 'precio_asc') orderBy = 'p.precio ASC, p.id_producto DESC';
    else if (ordenQuery === 'precio_desc') orderBy = 'p.precio DESC, p.id_producto DESC';
    else if (ordenQuery === 'nombre') orderBy = 'p.nombre ASC';

    const limite = 12;
    const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1);
    const from = `FROM producto p
                  JOIN v_empresas_publicas e ON e.id_empresa = p.id_empresa
                  JOIN categoria c ON c.id_categoria = p.id_categoria
                  WHERE ${where.join(' AND ')}`;

    const total = await pool.query(`SELECT COUNT(*)::int AS n ${from}`, params);
    const { rows } = await pool.query(
      `SELECT p.id_producto, p.nombre, p.marca, p.modelo, p.descripcion, p.precio, p.disponible,
              p.stock_actual, p.stock_minimo, p.sku, p.unidad,
              p.unidad_venta, p.unidades_por_paquete, p.cantidad_minima, p.color_unico,
              c.id_categoria, c.nombre AS categoria,
              e.razon_social AS empresa, e.slug AS empresa_slug, e.logo AS empresa_logo,
              (SELECT ruta FROM imagen_producto i WHERE i.id_producto = p.id_producto ORDER BY id_imagen LIMIT 1) AS imagen,
              (SELECT COALESCE(json_agg(json_build_object('id', pc.id, 'nombre', pc.nombre, 'codigo_hex', pc.codigo_hex)), '[]'::json)
                 FROM producto_color pc WHERE pc.id_producto = p.id_producto AND pc.activo = TRUE) AS colores
       ${from}
       ORDER BY ${orderBy}
       LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`,
      params
    );
    res.json({ total: total.rows[0].n, pagina, paginas: Math.ceil(total.rows[0].n / limite), productos: rows });
  } catch (e) {
    next(e);
  }
});

// Detalle de producto con imágenes, colores y escalas de precio por volumen
router.get('/productos/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador no válido' });
    const { rows } = await pool.query(
      `SELECT p.id_producto, p.nombre, p.marca, p.modelo, p.descripcion, p.precio, p.disponible,
              p.stock_actual, p.stock_minimo, p.sku, p.unidad,
              p.unidad_venta, p.unidades_por_paquete, p.cantidad_minima, p.color_unico,
              c.id_categoria, c.nombre AS categoria, e.id_empresa, e.razon_social AS empresa, e.slug AS empresa_slug, e.logo AS empresa_logo,
              e.sitio_web, e.whatsapp,
              ARRAY(SELECT ruta FROM imagen_producto i WHERE i.id_producto = p.id_producto ORDER BY id_imagen) AS imagenes
         FROM producto p
         JOIN v_empresas_publicas e ON e.id_empresa = p.id_empresa
         JOIN categoria c ON c.id_categoria = p.id_categoria
        WHERE p.id_producto = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado o empresa no disponible' });

    const prod = rows[0];

    // Cargar colores disponibles
    const coloresRes = await pool.query(
      `SELECT id, nombre, codigo_hex, stock, activo
         FROM producto_color
        WHERE id_producto = $1 AND activo = TRUE
        ORDER BY id ASC`,
      [id]
    );

    // Cargar escalas de precio por volumen
    const escalasRes = await pool.query(
      `SELECT id, desde_unidades, precio_unitario, etiqueta
         FROM producto_precio_escala
        WHERE id_producto = $1
        ORDER BY desde_unidades ASC`,
      [id]
    );

    prod.colores = coloresRes.rows;
    prod.escalas_precio = escalasRes.rows;

    res.json(prod);
  } catch (e) {
    next(e);
  }
});

// Enlace de contacto por WhatsApp de un producto
router.get('/productos/:id/contacto', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identificador no válido' });
    const { rows } = await pool.query(
      `SELECT p.nombre, e.whatsapp, e.razon_social
         FROM producto p
         JOIN v_empresas_publicas e ON e.id_empresa = p.id_empresa
        WHERE p.id_producto = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!rows[0].whatsapp) return res.status(404).json({ error: 'La empresa no tiene un canal de WhatsApp disponible' });
    const texto = `Hola ${rows[0].razon_social}, me interesa el producto "${rows[0].nombre}" que vi en UNIMARKET BO.`;
    res.json({ url: `https://wa.me/${rows[0].whatsapp}?text=${encodeURIComponent(texto)}` });
  } catch (e) {
    next(e);
  }
});

// PARTE 6: Registro de Pedido por WhatsApp con validación exhaustiva en servidor
// POST /api/publico/pedidos
const ipPedidosCounts = new Map();
function rateLimitPedidos(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const reg = ipPedidosCounts.get(ip);
  if (!reg || now > reg.resetTime) {
    ipPedidosCounts.set(ip, { count: 1, resetTime: now + 60000 });
    return next();
  }
  if (reg.count >= 20) {
    return res.status(429).json({ error: 'Demasiadas solicitudes de pedido. Por favor espere un momento.' });
  }
  reg.count++;
  next();
}

router.post('/pedidos', rateLimitPedidos, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id_empresa, items, nombre_cliente, ciudad } = req.body;

    if (!id_empresa || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Datos de pedido incompletos' });
    }

    // 1. Validar que la empresa sea pública y activa
    const empRes = await client.query(
      `SELECT id_empresa, razon_social, whatsapp, telefono
         FROM v_empresas_publicas
        WHERE id_empresa = $1`,
      [id_empresa]
    );

    if (!empRes.rowCount) {
      return res.status(404).json({ error: 'La empresa no se encuentra disponible o su suscripción no está activa' });
    }
    const emp = empRes.rows[0];
    const numWhatsapp = String(emp.whatsapp || emp.telefono || '').replace(/\D/g, '');
    if (!numWhatsapp) {
      return res.status(400).json({ error: 'La empresa no tiene número de WhatsApp registrado' });
    }
    const numWaFinal = numWhatsapp.startsWith('591') ? numWhatsapp : `591${numWhatsapp}`;

    await client.query('BEGIN');

    // 2. Generar correlativo PED-000001 único por empresa
    const seqRes = await client.query("SELECT nextval('seq_pedido_whatsapp') AS num");
    const codigoPedido = `PED-${String(seqRes.rows[0].num).padStart(6, '0')}`;

    let totalEstimado = 0;
    const itemsValidados = [];

    // 3. Re-validar en servidor cada producto: precios, escalas, stock y colores
    for (const item of items) {
      const id_producto = parseInt(item.id_producto, 10);
      const cantidad = parseInt(item.cantidad, 10);

      if (!id_producto || !cantidad || cantidad < 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cantidad de producto no válida' });
      }

      const prodRes = await client.query(
        `SELECT id_producto, nombre, sku, precio, stock_actual, cantidad_minima, unidad_venta, color_unico
           FROM producto
          WHERE id_producto = $1 AND id_empresa = $2 AND disponible = TRUE`,
        [id_producto, id_empresa]
      );

      if (!prodRes.rowCount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `El producto ID ${id_producto} no está disponible` });
      }

      const prod = prodRes.rows[0];

      // Validar cantidad mínima
      const minCompra = prod.cantidad_minima || 1;
      if (cantidad < minCompra) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `La cantidad mínima para "${prod.nombre}" es ${minCompra}` });
      }

      // Validar stock si existe
      if (prod.stock_actual !== null && prod.stock_actual !== undefined && cantidad > prod.stock_actual) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Stock insuficiente para "${prod.nombre}". Disponibles: ${prod.stock_actual}` });
      }

      // Calcular precio aplicable según escalas de precio por volumen
      const escalasRes = await client.query(
        `SELECT desde_unidades, precio_unitario
           FROM producto_precio_escala
          WHERE id_producto = $1 AND desde_unidades <= $2
          ORDER BY desde_unidades DESC
          LIMIT 1`,
        [id_producto, cantidad]
      );

      let precioUnitario = Number(prod.precio);
      if (escalasRes.rowCount > 0) {
        precioUnitario = Number(escalasRes.rows[0].precio_unitario);
      }

      const subtotal = Number((precioUnitario * cantidad).toFixed(2));
      totalEstimado += subtotal;

      // Colores
      const desgloseColores = Array.isArray(item.desglose_colores) ? item.desglose_colores : [];

      itemsValidados.push({
        id_producto,
        descripcion: prod.nombre,
        sku: prod.sku || '',
        cantidad_total: cantidad,
        desglose_colores: desgloseColores,
        modo: item.modo || 'unidad',
        precio_unitario: precioUnitario,
        subtotal,
      });
    }

    totalEstimado = Number(totalEstimado.toFixed(2));

    // 4. Guardar pedido_whatsapp
    const pedidoRes = await client.query(
      `INSERT INTO pedido_whatsapp (id_empresa, codigo, nombre_cliente, ciudad, total_estimado, estado)
       VALUES ($1, $2, $3, $4, $5, 'enviado')
       RETURNING id, codigo, creado_en`,
      [id_empresa, codigoPedido, nombre_cliente ? String(nombre_cliente).trim().slice(0, 150) : null, ciudad ? String(ciudad).trim().slice(0, 100) : null, totalEstimado]
    );

    const idPedido = pedidoRes.rows[0].id;

    // 5. Guardar pedido_whatsapp_item
    for (const it of itemsValidados) {
      await client.query(
        `INSERT INTO pedido_whatsapp_item (id_pedido, id_producto, descripcion, sku, cantidad_total, desglose_colores, modo, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [idPedido, it.id_producto, it.descripcion, it.sku, it.cantidad_total, JSON.stringify(it.desglose_colores), it.modo, it.precio_unitario, it.subtotal]
      );
    }

    await client.query('COMMIT');

    // 6. Redactar mensaje de WhatsApp según el formato exacto requerido:
    // "Hola <Empresa>, vi su catálogo en UNIMARKET BO y quiero hacer este pedido (Ref. PED-000123):
    //  1) <Producto> (SKU <sku>) - 7 unidades - Colores: 4 Negro, 3 Blanco - Bs 120,00 c/u - Subtotal Bs 840,00
    //  Total estimado: Bs 840,00
    //  Nombre: <si lo puso> - Ciudad: <si la puso>
    //  ¿Tienen disponibilidad y cómo coordinamos el pago y la entrega?"

    let lineasItems = [];
    itemsValidados.forEach((it, idx) => {
      let textoColores = '';
      if (Array.isArray(it.desglose_colores) && it.desglose_colores.length > 0) {
        const parteColores = it.desglose_colores
          .filter((c) => c.cantidad > 0)
          .map((c) => `${c.cantidad} ${c.nombre}`)
          .join(', ');
        if (parteColores) textoColores = ` - Colores: ${parteColores}`;
      }
      const skuStr = it.sku ? ` (SKU ${it.sku})` : '';
      const precioFmt = `Bs ${Number(it.precio_unitario).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const subtotalFmt = `Bs ${Number(it.subtotal).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      lineasItems.push(`  ${idx + 1}) ${it.descripcion}${skuStr} - ${it.cantidad_total} unidades${textoColores} - ${precioFmt} c/u - Subtotal ${subtotalFmt}`);
    });

    const totalFmt = `Bs ${Number(totalEstimado).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    let datosCliente = [];
    if (nombre_cliente && String(nombre_cliente).trim()) {
      datosCliente.push(`Nombre: ${String(nombre_cliente).trim()}`);
    }
    if (ciudad && String(ciudad).trim()) {
      datosCliente.push(`Ciudad: ${String(ciudad).trim()}`);
    }
    const lineaCliente = datosCliente.length > 0 ? `\n  ${datosCliente.join(' - ')}` : '';

    const mensajeWhatsApp = `Hola ${emp.razon_social}, vi su catálogo en UNIMARKET BO y quiero hacer este pedido (Ref. ${codigoPedido}):\n${lineasItems.join('\n')}\n  Total estimado: ${totalFmt}${lineaCliente}\n  ¿Tienen disponibilidad y cómo coordinamos el pago y la entrega?`;

    const urlWhatsApp = `https://wa.me/${numWaFinal}?text=${encodeURIComponent(mensajeWhatsApp)}`;

    // Envío asíncrono de correo de aviso a la empresa
    (async () => {
      try {
        const { rows: empUserRows } = await pool.query(
          `SELECT u.correo, u.usuario, e.razon_social
             FROM empresa e
             JOIN usuario u ON u.id_usuario = e.id_usuario
            WHERE e.id_empresa = $1`,
          [id_empresa]
        );
        if (empUserRows.length && empUserRows[0].correo) {
          const { enviarCorreo, construirCorreoNuevoPedido, getMailConfig } = require('../servicios/correo');
          const config = getMailConfig();
          const emailData = construirCorreoNuevoPedido({
            empresa: { razon_social: emp.razon_social },
            pedido: {
              codigo: codigoPedido,
              nombre_cliente,
              ciudad,
              total_estimado: totalEstimado,
            },
            items: itemsValidados,
            urlPanel: `${config.appUrl}/panel?tab=pedidos`,
          });
          await enviarCorreo({
            id_empresa,
            tipo: 'nuevo_pedido',
            para: empUserRows[0].correo,
            asunto: emailData.asunto,
            html: emailData.html,
            texto: emailData.texto,
          });
        }
      } catch (errMail) {
        console.error('Error enviando notificación de nuevo pedido a empresa:', errMail.message);
      }
    })();

    res.json({
      ok: true,
      codigo: codigoPedido,
      id_pedido: idPedido,
      total_estimado: totalEstimado,
      url_whatsapp: urlWhatsApp,
      mensaje: mensajeWhatsApp,
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// COMPROBANTE PÚBLICO CON TOKEN TEMPORAL NO ADIVINABLE
// -------------------------------------------------------------
const { generarPdfVenta } = require('../utils/pdf');

// Descargar / visualizar PDF del comprobante con enlace temporal
router.get('/comprobante/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(404).send('Enlace de comprobante no válido');

    const { rows: ventas } = await pool.query(
      `SELECT v.*, c.nombre AS cliente_nombre, c.nit_ci AS cliente_nit,
              c.telefono AS cliente_telefono, c.direccion AS cliente_direccion
         FROM venta v
         LEFT JOIN cliente c ON c.id_cliente = v.id_cliente
        WHERE v.token_publico = $1 AND (v.token_expira IS NULL OR v.token_expira > NOW())`,
      [token]
    );

    if (!ventas.length) {
      return res.status(404).send('Comprobante no encontrado o el enlace temporal ha expirado.');
    }

    const venta = ventas[0];
    venta.correlativo = venta.correlativo || (venta.numero_formato ? `VTA-${venta.numero_formato}` : `VTA-${String(venta.numero || venta.id_venta).padStart(6, '0')}`);

    const { rows: items } = await pool.query(
      `SELECT vi.*, COALESCE(p.nombre, vi.descripcion) AS nombre, COALESCE(vi.sku, p.sku) AS sku, p.unidad
         FROM venta_item vi
         LEFT JOIN producto p ON p.id_producto = vi.id_producto
        WHERE vi.id_venta = $1
        ORDER BY vi.id_venta_item ASC`,
      [venta.id_venta]
    );
    venta.items = items;

    const { rows: empRows } = await pool.query(
      `SELECT e.razon_social, e.nit, e.telefono, e.whatsapp, e.direccion, u.correo
         FROM empresa e
         JOIN usuario u ON u.id_usuario = e.id_usuario
        WHERE e.id_empresa = $1`,
      [venta.id_empresa]
    );
    const empresa = empRows[0] || {};
    const formato = String(req.query.formato || 'a4').toLowerCase() === 'ticket' ? 'ticket' : 'a4';
    const filename = `comprobante-${venta.correlativo}-${formato}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${req.query.descargar ? 'attachment' : 'inline'}; filename="${filename}"`);

    generarPdfVenta({ venta, empresa, formato, stream: res });
  } catch (e) {
    next(e);
  }
});

// Obtener datos del comprobante para visualización web
router.get('/comprobante/:token/datos', async (req, res, next) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(404).json({ error: 'Token no proporcionado' });

    const { rows: ventas } = await pool.query(
      `SELECT v.id_venta, v.numero, v.numero_formato, ('VTA-' || v.anio || '-' || v.numero_formato) AS correlativo,
              v.fecha, v.subtotal, v.descuento, v.total, v.total_literal, v.estado, v.metodo_pago,
              v.nombre_cliente, v.nit_ci_cliente, v.token_expira,
              e.razon_social AS empresa_nombre, e.nit AS empresa_nit, e.telefono AS empresa_telefono,
              e.whatsapp AS empresa_whatsapp, e.direccion AS empresa_direccion, e.logo AS empresa_logo,
              e.slug AS empresa_slug
         FROM venta v
         JOIN empresa e ON e.id_empresa = v.id_empresa
        WHERE v.token_publico = $1 AND (v.token_expira IS NULL OR v.token_expira > NOW())`,
      [token]
    );

    if (!ventas.length) {
      return res.status(404).json({ error: 'Comprobante no encontrado o el enlace temporal ha expirado.' });
    }

    const venta = ventas[0];
    const { rows: items } = await pool.query(
      `SELECT vi.id_venta_item, vi.descripcion, vi.sku, vi.cantidad, vi.precio_unitario, vi.descuento_item, vi.subtotal
         FROM venta_item vi
        WHERE vi.id_venta = $1
        ORDER BY vi.id_venta_item ASC`,
      [venta.id_venta]
    );
    venta.items = items;

    res.json(venta);
  } catch (e) {
    next(e);
  }
});

// CU - Reportar empresa o producto para salvaguardar la confianza pública
router.post('/reportes', async (req, res, next) => {
  try {
    const {
      id_empresa,
      id_producto,
      motivos,
      descripcion,
      nombre_denunciante,
      contacto_denunciante,
    } = req.body;

    const idEmp = parseInt(id_empresa, 10);
    if (!Number.isInteger(idEmp)) {
      return res.status(400).json({ error: 'La empresa a reportar es obligatoria y debe ser válida' });
    }

    // Verificar que la empresa exista
    const { rows: empRows } = await pool.query(
      'SELECT id_empresa, razon_social FROM empresa WHERE id_empresa = $1',
      [idEmp]
    );
    if (!empRows.length) {
      return res.status(404).json({ error: 'La empresa a reportar no existe en la plataforma' });
    }

    // Validar producto si se envió
    let idProd = null;
    if (id_producto) {
      const parsedProd = parseInt(id_producto, 10);
      if (Number.isInteger(parsedProd)) {
        const { rows: prodRows } = await pool.query(
          'SELECT id_producto FROM producto WHERE id_producto = $1 AND id_empresa = $2',
          [parsedProd, idEmp]
        );
        if (prodRows.length) idProd = parsedProd;
      }
    }

    // Validar motivos (al menos uno)
    const motivosArr = Array.isArray(motivos)
      ? motivos.filter((m) => typeof m === 'string' && m.trim().length > 0)
      : typeof motivos === 'string' && motivos.trim()
      ? [motivos.trim()]
      : [];

    if (!motivosArr.length) {
      return res.status(400).json({ error: 'Debe seleccionar al menos un motivo para el reporte' });
    }

    // Validar descripción
    const desc = typeof descripcion === 'string' ? descripcion.trim() : '';
    if (desc.length < 10) {
      return res.status(400).json({ error: 'Debe ingresar una descripción detallada del reporte (mínimo 10 caracteres)' });
    }
    if (desc.length > 3000) {
      return res.status(400).json({ error: 'La descripción es demasiado extensa (máximo 3000 caracteres)' });
    }

    const nombreDen = typeof nombre_denunciante === 'string' ? nombre_denunciante.trim().slice(0, 120) : null;
    const contactoDen = typeof contacto_denunciante === 'string' ? contacto_denunciante.trim().slice(0, 120) : null;

    const { rows: nuevo } = await pool.query(
      `INSERT INTO reporte (id_empresa, id_producto, motivos, descripcion, nombre_denunciante, contacto_denunciante)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_reporte, creado_en`,
      [idEmp, idProd, JSON.stringify(motivosArr), desc, nombreDen || null, contactoDen || null]
    );

    res.status(201).json({
      ok: true,
      mensaje: 'Su reporte ha sido recibido correctamente. El equipo de administración de UNIMARKET BO revisará el caso de manera prioritaria.',
      id_reporte: nuevo[0].id_reporte,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;


// Módulo de Normalización y Validación de Datos - UNIMARKET BO (REQ08)

const limpiar = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

const capitalizar = (v) =>
  limpiar(v)
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

/**
 * Regla 1: Razón Social / Nombre Comercial
 * Letras (con tildes y ñ), números, espacios y signos comerciales comunes (. , & - ' ( ) /).
 * Longitud 3 a 150. Debe contener al menos una letra.
 * Rechaza caracteres como < > { } ; " \ y similares.
 */
function normalizarRazonSocial(v) {
  const crudo = String(v ?? '').trim();
  if (!crudo) return { error: 'Ingrese la razón social o nombre comercial' };
  const limpia = crudo.replace(/\s+/g, ' ');
  if (limpia.length < 3 || limpia.length > 150) {
    return { error: 'La razón social debe tener entre 3 y 150 caracteres' };
  }
  if (!/\p{L}/u.test(limpia)) {
    return { error: 'La razón social debe contener al menos una letra' };
  }
  if (!/^[\p{L}0-9\s.,&\-'()/]+$/u.test(limpia)) {
    return { error: 'La razón social contiene caracteres no permitidos' };
  }
  return { valor: capitalizar(limpia) };
}

/**
 * Regla 2: NIT
 * SOLO dígitos, de 7 a 15. No se permite ningún otro carácter.
 */
function normalizarNit(v) {
  const nit = String(v ?? '').trim();
  if (!/^\d{7,15}$/.test(nit)) {
    return { error: 'El NIT debe contener solo números (7 a 15 dígitos)' };
  }
  return { valor: nit };
}

/**
 * Regla 3: Teléfono de contacto (opcional)
 * SOLO dígitos, 7 u 8 dígitos.
 */
function normalizarTelefono(v, etiqueta = 'teléfono', opcional = true) {
  const t = String(v ?? '').trim();
  if (!t) {
    if (opcional) return { valor: null };
    return { error: `Ingrese el ${etiqueta}` };
  }
  if (!/^\d{7,8}$/.test(t)) {
    return { error: `El ${etiqueta} debe contener solo números (7 u 8 dígitos)` };
  }
  return { valor: t };
}

/**
 * Regla 4: WhatsApp comercial (obligatorio)
 * SOLO dígitos, exactamente 8 dígitos y debe empezar con 6 o 7 (celular boliviano).
 * El sistema antepone 591 internamente al guardar/generar el enlace wa.me.
 */
function normalizarWhatsapp(v) {
  const w = String(v ?? '').trim();
  if (!w) {
    return { error: 'El WhatsApp debe tener 8 dígitos y empezar con 6 o 7' };
  }
  if (!/^[67]\d{7}$/.test(w)) {
    return { error: 'El WhatsApp debe tener 8 dígitos y empezar con 6 o 7' };
  }
  return { valor: `591${w}` };
}

/**
 * Regla 8: Sitio web / Redes sociales
 * Opcional, debe ser una URL que empiece con http:// o https://.
 */
function esUrlValida(url) {
  if (!url) return true;
  const str = String(url).trim();
  if (!/^https?:\/\//i.test(str)) return false;
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Regla 9: Producto (nombre, precio, categoría, descripción)
 * Precio: solo dígitos y un punto o coma decimal con máximo 2 decimales, mayor o igual a 0.
 * Nombre: 3 a 150 caracteres, letras, números y signos comunes (. , & - ' ( ) /).
 */
function validarProducto(body) {
  const errores = {};
  const nombreRaw = String(body.nombre ?? '').replace(/\s+/g, ' ').trim();
  const descripcion = limpiar(body.descripcion);
  const precioRaw = String(body.precio ?? '').trim();
  const id_categoria = parseInt(body.id_categoria, 10);
  const disponible =
    body.disponible === true ||
    body.disponible === 'true' ||
    body.disponible === '1' ||
    body.disponible === 'on';

  // Validación de nombre
  if (nombreRaw.length < 3 || nombreRaw.length > 150) {
    errores.nombre = 'El nombre del producto debe tener entre 3 y 150 caracteres';
  } else if (!/[\p{L}0-9]/u.test(nombreRaw)) {
    errores.nombre = 'El nombre del producto debe contener al menos una letra o número';
  } else if (!/^[\p{L}0-9\s.,&\-'()/]+$/u.test(nombreRaw)) {
    errores.nombre = 'El nombre del producto contiene caracteres no permitidos';
  }

  // Validación de precio estricta: dígitos y máximo 2 decimales con punto o coma
  if (!precioRaw || !/^\d+([.,]\d{1,2})?$/.test(precioRaw)) {
    errores.precio = 'El precio debe ser un número válido (máximo 2 decimales, sin letras ni símbolos)';
  } else {
    const precioNum = Number(precioRaw.replace(',', '.'));
    if (!Number.isFinite(precioNum) || precioNum < 0) {
      errores.precio = 'El precio debe ser un número mayor o igual a 0';
    } else if (precioNum > 99999999) {
      errores.precio = 'El precio es demasiado alto';
    }
  }

  // Validación de marca (opcional)
  let marcaFinal = null;
  const marcaRaw = String(body.marca ?? '').replace(/\s+/g, ' ').trim();
  if (marcaRaw) {
    if (marcaRaw.length < 2 || marcaRaw.length > 60) {
      errores.marca = 'La marca debe tener entre 2 y 60 caracteres';
    } else if (!/^[\p{L}0-9\s.\-&'\/]+$/u.test(marcaRaw)) {
      errores.marca = 'La marca contiene caracteres no permitidos';
    } else {
      marcaFinal = capitalizar(marcaRaw);
    }
  }

  // Validación de modelo (opcional)
  let modeloFinal = null;
  const modeloRaw = String(body.modelo ?? '').replace(/\s+/g, ' ').trim();
  if (modeloRaw) {
    if (modeloRaw.length < 1 || modeloRaw.length > 60) {
      errores.modelo = 'El modelo debe tener entre 1 y 60 caracteres';
    } else if (!/^[\p{L}0-9\s.\-&'\/]+$/u.test(modeloRaw)) {
      errores.modelo = 'El modelo contiene caracteres no permitidos';
    } else {
      modeloFinal = modeloRaw;
    }
  }

  if (!Number.isInteger(id_categoria)) {
    errores.id_categoria = 'Debe seleccionar una categoría';
  }
  if (descripcion.length > 2000) {
    errores.descripcion = 'La descripción es demasiado larga (máx. 2000 caracteres)';
  }

  // Validación de campos de inventario (PARTE 4)
  let skuFinal = null;
  const skuRaw = String(body.sku ?? '').trim();
  if (skuRaw) {
    if (skuRaw.length > 50) {
      errores.sku = 'El código SKU no puede superar 50 caracteres';
    } else if (!/^[A-Za-z0-9\-_.]+$/.test(skuRaw)) {
      errores.sku = 'El SKU solo puede contener letras, números, guiones y puntos';
    } else {
      skuFinal = skuRaw.toUpperCase();
    }
  }

  let numeroSerieFinal = null;
  const serieRaw = String(body.numero_serie ?? '').trim();
  if (serieRaw) {
    if (serieRaw.length > 100) {
      errores.numero_serie = 'El número de serie no puede superar 100 caracteres';
    } else {
      numeroSerieFinal = serieRaw;
    }
  }

  // Stock actual: entero >= 0
  let stockActualFinal = 0;
  if (body.stock_actual !== undefined && body.stock_actual !== null && body.stock_actual !== '') {
    const sNum = Number(body.stock_actual);
    if (!Number.isInteger(sNum) || sNum < 0) {
      errores.stock_actual = 'El stock actual debe ser un número entero mayor o igual a 0';
    } else if (sNum > 10000000) {
      errores.stock_actual = 'El stock actual es demasiado alto';
    } else {
      stockActualFinal = sNum;
    }
  }

  // Stock mínimo: entero >= 0 (default 20)
  let stockMinimoFinal = 20;
  if (body.stock_minimo !== undefined && body.stock_minimo !== null && body.stock_minimo !== '') {
    const sMin = Number(body.stock_minimo);
    if (!Number.isInteger(sMin) || sMin < 0) {
      errores.stock_minimo = 'El stock mínimo debe ser un número entero mayor o igual a 0';
    } else if (sMin > 1000000) {
      errores.stock_minimo = 'El stock mínimo es demasiado alto';
    } else {
      stockMinimoFinal = sMin;
    }
  }

  // Unidad de medida (default 'unidad')
  let unidadFinal = 'unidad';
  const unidadRaw = String(body.unidad ?? '').trim().toLowerCase();
  if (unidadRaw) {
    if (unidadRaw.length > 30) {
      errores.unidad = 'La unidad no puede superar 30 caracteres';
    } else {
      unidadFinal = unidadRaw;
    }
  }

  const precioFinal =
    precioRaw && /^\d+([.,]\d{1,2})?$/.test(precioRaw)
      ? Math.round(Number(precioRaw.replace(',', '.')) * 100) / 100
      : 0;

  // Si stock_actual es 0, no puede estar disponible para venta
  const disponibleFinal = stockActualFinal === 0 ? false : disponible;

  return {
    errores,
    datos: {
      nombre: capitalizar(nombreRaw),
      marca: marcaFinal,
      modelo: modeloFinal,
      descripcion,
      precio: precioFinal,
      id_categoria,
      disponible: disponibleFinal,
      sku: skuFinal,
      numero_serie: numeroSerieFinal,
      stock_actual: stockActualFinal,
      stock_minimo: stockMinimoFinal,
      unidad: unidadFinal,
    },
  };
}

function generarSlugBase(razonSocial) {
  const s = limpiar(razonSocial)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(s\.?r\.?l\.?|s\.?a\.?|s\.?c\.?|e\.?i\.?r\.?l\.?|ltda\.?)\b/gi, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || 'empresa';
}

async function resolverSlugUnico(dbClientOrPool, razonSocial) {
  const base = generarSlugBase(razonSocial);
  const { rows } = await dbClientOrPool.query(
    'SELECT slug FROM empresa WHERE slug = $1 OR slug ~ $2',
    [base, `^${base}(-[0-9]+)?$`]
  );
  if (!rows.some((r) => r.slug === base)) return base;

  const existingNumbers = rows
    .map((r) => {
      if (r.slug === base) return 1;
      const m = r.slug.match(new RegExp(`^${base}-([0-9]+)$`));
      return m ? parseInt(m[1], 10) : null;
    })
    .filter((n) => n !== null);

  const maxNum = existingNumbers.length ? Math.max(...existingNumbers) : 1;
  return `${base}-${maxNum + 1}`;
}

function normalizarRazonSocialParaBusqueda(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(s\.?r\.?l\.?|s\.?a\.?|s\.?c\.?|e\.?i\.?r\.?l\.?|ltda\.?|sociedad anonima|responsabilidad limitada)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convierte un número decimal (ej. 250.50) a su representación literal en bolivianos.
 * Formato: "Doscientos cincuenta 50/100 bolivianos"
 */
function numeroALiteral(monto) {
  const num = Math.round(Number(monto || 0) * 100) / 100;
  const enteros = Math.floor(num);
  const centavos = Math.round((num - enteros) * 100);
  const strCentavos = String(centavos).padStart(2, '0');

  const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const DECENAS_10 = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  function leerCentenas(n) {
    if (n === 0) return '';
    if (n === 100) return 'cien';
    let res = '';
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (c > 0) res += CENTENAS[c] + ' ';

    if (d === 1) {
      res += DECENAS_10[u];
    } else if (d === 2 && u > 0) {
      res += 'veinti' + UNIDADES[u];
    } else {
      if (d > 0) res += DECENAS[d];
      if (d > 0 && u > 0) res += ' y ';
      if (u > 0) res += UNIDADES[u];
    }
    return res.trim();
  }

  function convertirEnteros(n) {
    if (n === 0) return 'cero';
    let res = '';
    const millones = Math.floor(n / 1000000);
    const miles = Math.floor((n % 1000000) / 1000);
    const resto = n % 1000;

    if (millones > 0) {
      if (millones === 1) res += 'un millón ';
      else res += leerCentenas(millones) + ' millones ';
    }

    if (miles > 0) {
      if (miles === 1) res += 'mil ';
      else res += leerCentenas(miles) + ' mil ';
    }

    if (resto > 0) {
      res += leerCentenas(resto);
    }
    return res.trim();
  }

  let literal = convertirEnteros(enteros);
  // Reemplazar 'uno' final por 'un' si aplica
  literal = literal.replace(/\buno\b$/, 'un');
  // Capitalizar la primera letra
  literal = literal.charAt(0).toUpperCase() + literal.slice(1);

  return `${literal} ${strCentavos}/100 bolivianos`;
}

module.exports = {
  limpiar,
  capitalizar,
  normalizarRazonSocial,
  normalizarRazonSocialParaBusqueda,
  normalizarNit,
  normalizarTelefono,
  normalizarWhatsapp,
  generarSlugBase,
  resolverSlugUnico,
  esUrlValida,
  validarProducto,
  numeroALiteral,
};

// Helper reutilizable de validación y control de entradas para UNIMARKET BO

/**
 * Filtra cualquier caracter que no sea un dígito numérico (0-9).
 * Elimina letras, espacios, guiones, puntos, signos +, paréntesis, etc.
 */
export const soloDigitos = (v) => String(v ?? '').replace(/\D/g, '');

/**
 * Bloquea en onKeyDown cualquier tecla no numérica para campos que admiten SOLO dígitos.
 * Permite teclas de control y atajos estándar del sistema (Ctrl/Cmd + C, V, A, X, Z).
 */
export const teclaPermitidaSoloDigitos = (e) => {
  if (
    e.ctrlKey ||
    e.metaKey ||
    [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ].includes(e.key)
  ) {
    return;
  }
  // Bloquear cualquier tecla que no sea un número entre 0 y 9
  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault();
  }
};

/**
 * Controla onKeyDown para el campo de precio.
 * Admite dígitos y a lo sumo un separador decimal (punto o coma).
 */
export const teclaPermitidaPrecio = (e, valorActual = '') => {
  if (
    e.ctrlKey ||
    e.metaKey ||
    [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ].includes(e.key)
  ) {
    return;
  }
  if (e.key === '.' || e.key === ',') {
    if (String(valorActual).includes('.') || String(valorActual).includes(',')) {
      e.preventDefault();
    }
    return;
  }
  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault();
  }
};

/**
 * Filtra y normaliza el valor de un precio mientras se escribe o pega.
 * Permite solo dígitos y como máximo un punto o coma con hasta 2 decimales.
 */
export const filtrarPrecio = (v) => {
  const s = String(v ?? '').replace(/[^\d.,]/g, '');
  const match = s.match(/^(\d*)([.,]?)(\d{0,2})/);
  if (!match) return '';
  return match[1] + (match[2] ? match[2] + match[3] : '');
};

/**
 * Regla 1: Razón social / Nombre comercial
 * Letras (con tildes y ñ), números, espacios y signos comerciales comunes (. , & - ' ( ) /).
 * Longitud 3 a 150. Debe contener al menos una letra.
 * Rechaza caracteres como < > { } ; " \ y similares.
 */
export const validarRazonSocial = (v) => {
  const val = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (!val) return 'La razón social es obligatoria';
  if (val.length < 3 || val.length > 150) {
    return 'La razón social debe tener entre 3 y 150 caracteres';
  }
  if (!/\p{L}/u.test(val)) {
    return 'La razón social debe contener al menos una letra';
  }
  if (!/^[\p{L}0-9\s.,&\-'()/]+$/u.test(val)) {
    return 'La razón social contiene caracteres no permitidos';
  }
  return '';
};

/**
 * Regla 2: NIT
 * SOLO dígitos, de 7 a 15 dígitos.
 */
export const validarNit = (v) => {
  const val = String(v ?? '').trim();
  if (!val) return 'El NIT es obligatorio';
  if (!/^\d{7,15}$/.test(val)) {
    return 'El NIT debe contener solo números (7 a 15 dígitos)';
  }
  return '';
};

/**
 * Regla 3: Teléfono de contacto (opcional)
 * SOLO dígitos, 7 u 8 dígitos.
 */
export const validarTelefono = (v, opcional = true) => {
  const val = String(v ?? '').trim();
  if (!val) {
    if (opcional) return '';
    return 'El teléfono es obligatorio';
  }
  if (!/^\d{7,8}$/.test(val)) {
    return 'El teléfono debe contener solo números (7 u 8 dígitos)';
  }
  return '';
};

/**
 * Regla 4: WhatsApp comercial (obligatorio)
 * SOLO dígitos, exactamente 8 dígitos y debe empezar con 6 o 7 (celular boliviano).
 */
export const validarWhatsapp = (v) => {
  const val = String(v ?? '').trim();
  if (!val) {
    return 'El WhatsApp es obligatorio';
  }
  if (!/^[67]\d{7}$/.test(val)) {
    return 'El WhatsApp debe tener 8 dígitos y empezar con 6 o 7';
  }
  return '';
};

/**
 * Regla 5: Usuario
 * Solo a-z, 0-9 y guion bajo (_), 4 a 30 caracteres.
 */
export const validarUsuario = (v) => {
  const val = String(v ?? '').trim();
  if (!val) return 'El nombre de usuario es obligatorio';
  if (!/^[a-z0-9_]{4,30}$/i.test(val)) {
    return 'Usuario: 4 a 30 caracteres (letras, números o _)';
  }
  return '';
};

/**
 * Regla 6: Correo electrónico
 */
export const validarCorreo = (v) => {
  const val = String(v ?? '').trim();
  if (!val) return 'El correo electrónico es obligatorio';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    return 'Correo electrónico no válido';
  }
  return '';
};

/**
 * Regla 7: Contraseña
 * Mínimo 8 caracteres.
 */
export const validarContrasena = (v) => {
  const val = String(v ?? '');
  if (!val) return 'La contraseña es obligatoria';
  if (val.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres';
  }
  return '';
};

/**
 * Regla 8: Sitio web / redes sociales
 * Opcional, debe ser una URL que empiece con http:// o https://.
 */
export const validarUrl = (v, opcional = true) => {
  const val = String(v ?? '').trim();
  if (!val) {
    if (opcional) return '';
    return 'La URL es obligatoria';
  }
  if (!/^https?:\/\//i.test(val)) {
    return 'La URL debe empezar con http:// o https://';
  }
  try {
    const u = new URL(val);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return 'La URL debe empezar con http:// o https://';
    }
    return '';
  } catch {
    return 'Ingrese una URL válida (ej. https://...)';
  }
};

/**
 * Regla 9: Precio de producto
 * Solo dígitos y un punto o coma decimal con máximo 2 decimales, mayor o igual a 0.
 */
export const validarPrecio = (v) => {
  const val = String(v ?? '').trim();
  if (!val) return 'El precio es obligatorio';
  if (!/^\d+([.,]\d{1,2})?$/.test(val)) {
    return 'El precio debe ser un número válido (máximo 2 decimales)';
  }
  const num = Number(val.replace(',', '.'));
  if (isNaN(num) || num < 0) {
    return 'El precio debe ser mayor o igual a 0';
  }
  if (num > 99999999) {
    return 'El precio es demasiado alto';
  }
  return '';
};

/**
 * Regla 9 (cont.): Nombre de producto
 * 3 a 150 caracteres, letras, números y signos comunes (. , & - ' ( ) /).
 */
export const validarNombreProducto = (v) => {
  const val = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (!val) return 'El nombre del producto es obligatorio';
  if (val.length < 3 || val.length > 150) {
    return 'El nombre del producto debe tener entre 3 y 150 caracteres';
  }
  if (!/[\p{L}0-9]/u.test(val)) {
    return 'El nombre debe contener al menos una letra o número';
  }
  if (!/^[\p{L}0-9\s.,&\-'()/]+$/u.test(val)) {
    return 'El nombre contiene caracteres no permitidos';
  }
  return '';
};

export const validarMarca = (v) => {
  const val = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (!val) return '';
  if (val.length < 2 || val.length > 60) {
    return 'La marca debe tener entre 2 y 60 caracteres';
  }
  if (!/^[\p{L}0-9\s.\-&'\/]+$/u.test(val)) {
    return 'La marca contiene caracteres no permitidos';
  }
  return '';
};

export const validarModelo = (v) => {
  const val = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (!val) return '';
  if (val.length < 1 || val.length > 60) {
    return 'El modelo debe tener entre 1 y 60 caracteres';
  }
  if (!/^[\p{L}0-9\s.\-&'\/]+$/u.test(val)) {
    return 'El modelo contiene caracteres no permitidos';
  }
  return '';
};


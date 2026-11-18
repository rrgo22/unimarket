const BASE = '/api';

export const getToken = () => localStorage.getItem('um_token');
export const setToken = (t) => (t ? localStorage.setItem('um_token', t) : localStorage.removeItem('um_token'));

export class ApiError extends Error {
  constructor(message, status, errores) {
    super(message);
    this.status = status;
    this.errores = errores || {};
  }
}

export async function api(path, { method = 'GET', body, form, raw } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  if (raw) {
    if (!res.ok) throw new ApiError('No se pudo obtener el archivo', res.status);
    return res;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith('/auth/login')) {
      setToken(null);
      window.dispatchEvent(new Event('um:logout'));
    }
    throw new ApiError(data.error || 'Error de comunicación con el servidor', res.status, data.errores);
  }
  return data;
}

export const bs = (n) => 'Bs ' + Number(n).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const imgUrl = (ruta) => (ruta ? `/uploads/productos/${ruta}` : null);
export const empImgUrl = (ruta) => (ruta ? `/uploads/empresas/${ruta}` : null);

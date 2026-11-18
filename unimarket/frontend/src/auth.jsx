import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(!!getToken());

  const refrescar = useCallback(async () => {
    if (!getToken()) return setUser(null);
    try {
      setUser(await api('/auth/me'));
    } catch {
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refrescar().finally(() => setCargando(false));
    const out = () => setUser(null);
    window.addEventListener('um:logout', out);
    return () => window.removeEventListener('um:logout', out);
  }, [refrescar]);

  const login = async (usuario, contrasena) => {
    const r = await api('/auth/login', { method: 'POST', body: { usuario, contrasena } });
    setToken(r.token);
    setUser(r.user);
    return r.user;
  };
  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, cargando, login, logout, refrescar }}>{children}</Ctx.Provider>;
}

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, Lock, Eye, EyeOff, LogIn, AlertCircle, Loader2, ArrowRight, KeyRound, Mail, CheckCircle2, X
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [logoSrc, setLogoSrc] = useState('/Logotipo.png');
  const [logoFallo, setLogoFallo] = useState(false);

  // Estado para modal "Olvidé mi contraseña"
  const [modalOlvide, setModalOlvide] = useState(false);
  const [cuentaOlvide, setCuentaOlvide] = useState('');
  const [enviandoOlvide, setEnviandoOlvide] = useState(false);
  const [mensajeOlvide, setMensajeOlvide] = useState('');
  const [errorOlvide, setErrorOlvide] = useState('');

  const manejarErrorLogo = () => {
    if (logoSrc === '/Logotipo.png') {
      setLogoSrc('/logo1.png');
    } else {
      setLogoFallo(true);
    }
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const u = await login(usuario, contrasena);
      nav(u.rol === 'administrador' ? '/admin' : '/empresa');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const solicitarRecuperacion = async (e) => {
    e.preventDefault();
    setErrorOlvide('');
    setMensajeOlvide('');
    if (!cuentaOlvide.trim()) {
      setErrorOlvide('Ingrese su correo electrónico o nombre de usuario');
      return;
    }
    setEnviandoOlvide(true);
    try {
      const res = await api('/auth/olvide-password', {
        method: 'POST',
        body: { correo: cuentaOlvide.trim() },
      });
      setMensajeOlvide(res.mensaje || 'Si los datos corresponden a una cuenta, recibirá un correo con el enlace temporal.');
    } catch (err) {
      setErrorOlvide(err.message || 'No se pudo enviar la solicitud. Intente nuevamente.');
    } finally {
      setEnviandoOlvide(false);
    }
  };

  return (
    <div className="relative w-full flex-1 min-h-[100dvh] flex items-center justify-center overflow-hidden bg-transparent px-4 pt-28 pb-14">
      {/* Malla de auroras dinámicas y vibrantes animadas */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden">
        {/* Mancha 1: Cian eléctrico en movimiento */}
        <div className="absolute -top-[15%] -left-[10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-gradient-to-tr from-cyan-500/35 via-teal-400/25 to-transparent blur-[110px] mix-blend-screen animate-aurora-1" />

        {/* Mancha 2: Índigo y violeta profundo */}
        <div className="absolute top-[15%] -right-[15%] w-[65vw] h-[65vw] max-w-[750px] max-h-[750px] rounded-full bg-gradient-to-bl from-[#4F46E5]/40 via-[#7C3AED]/28 to-transparent blur-[130px] mix-blend-screen animate-aurora-2" />

        {/* Mancha 3: Violeta y fucsia suave */}
        <div className="absolute -bottom-[20%] left-[20%] w-[55vw] h-[55vw] max-w-[650px] max-h-[650px] rounded-full bg-gradient-to-t from-[#7C3AED]/25 via-[#EC4899]/18 to-transparent blur-[120px] mix-blend-screen animate-aurora-3" />

        {/* Mancha 4: Destello cian central de profundidad detrás de la tarjeta */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] rounded-full bg-cyan-400/15 blur-[95px] mix-blend-screen animate-pulse" />

        {/* Cuadrícula radial suave con viñeta */}
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.45) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
            maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 25%, rgba(0,0,0,0) 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 25%, rgba(0,0,0,0) 80%)',
          }}
        />
      </div>

      {/* Tarjeta central en vidrio oscuro premium con haz de luz */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-20 w-full max-w-md rounded-3xl border border-white/15 bg-white/[0.08] backdrop-blur-2xl p-6 sm:p-9 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_30px_rgba(34,211,238,0.12)] overflow-hidden"
      >
        {/* Resplandor superior en el borde superior de la tarjeta */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent" />

        <div className="text-center space-y-3 pb-5 border-b border-white/10">
          {/* Logo oficial con alto definido y fallbacks */}
          <div className="flex justify-center items-center">
            {!logoFallo ? (
              <div className="p-2.5 rounded-2xl bg-white/[0.07] border border-white/15 inline-flex items-center justify-center shadow-lg shadow-cyan-500/5">
                <img
                  src={logoSrc}
                  alt="UNIMARKET BO"
                  width={180}
                  height={64}
                  className="h-14 sm:h-16 w-auto object-contain"
                  onError={manejarErrorLogo}
                />
              </div>
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/25">
                <LogIn size={26} strokeWidth={2.2} aria-hidden="true" />
              </div>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Iniciar sesión
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Acceso al panel de gestión para empresas y administradores
          </p>
        </div>

        <form onSubmit={enviar} className="space-y-4 pt-5">
          {/* Campo Usuario */}
          <div>
            <label className="label !text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block" htmlFor="login-usuario">
              USUARIO
            </label>
            <div className="relative rounded-xl transition-all focus-within:ring-2 focus-within:ring-cyan-400/60">
              <User
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="login-usuario"
                className="input pl-10 text-base sm:text-sm !border-white/15 focus:!border-cyan-400 focus:!ring-0"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                autoFocus
                autoComplete="username"
                placeholder="Nombre de usuario"
                required
              />
            </div>
          </div>

          {/* Campo Contraseña con Mostrar/Ocultar */}
          <div>
            <label className="label !text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block" htmlFor="login-contrasena">
              CONTRASEÑA
            </label>
            <div className="relative rounded-xl transition-all focus-within:ring-2 focus-within:ring-cyan-400/60">
              <Lock
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="login-contrasena"
                className="input pl-10 pr-11 text-base sm:text-sm !border-white/15 focus:!border-cyan-400 focus:!ring-0"
                type={verClave ? 'text' : 'password'}
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                autoComplete="current-password"
                placeholder="Contraseña de acceso"
                required
              />
              <button
                type="button"
                onClick={() => setVerClave(!verClave)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-white rounded-lg transition-colors"
                aria-label={verClave ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {verClave ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
            {/* Enlace "¿Olvidaste tu contraseña?" */}
            <div className="flex justify-end pt-1.5">
              <button
                type="button"
                onClick={() => {
                  setModalOlvide(true);
                  setCuentaOlvide('');
                  setMensajeOlvide('');
                  setErrorOlvide('');
                }}
                className="text-xs text-cyan-300 hover:text-cyan-200 hover:underline transition-colors focus:outline-none"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-500/15 p-3 border border-rose-500/30 flex items-center gap-2 text-xs font-semibold text-rose-300">
              <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn-cta w-full !py-3 shadow-xs font-bold flex items-center justify-center gap-2"
            disabled={cargando}
          >
            {cargando ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                <span>Verificando credenciales…</span>
              </>
            ) : (
              <>
                <span>Ingresar al panel</span>
                <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-white/10 text-center space-y-2 text-xs text-slate-300">
          <p>
            ¿Su empresa aún no tiene catálogo en UNIMARKET BO?
          </p>
          <Link
            to="/planes"
            className="inline-flex items-center gap-1 font-bold text-cyan-300 hover:text-cyan-200 hover:underline transition-colors"
          >
            <span>Ver planes y registrarse</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {/* Modal "Olvidé mi contraseña" */}
        {modalOlvide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="relative w-full max-w-md rounded-3xl bg-[#0c1638] border border-white/20 p-6 sm:p-7 space-y-5 shadow-2xl">
              <button
                type="button"
                onClick={() => setModalOlvide(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                  <KeyRound size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Recuperar contraseña</h3>
                  <p className="text-xs text-slate-300">Le enviaremos un enlace temporal a su correo</p>
                </div>
              </div>

              {mensajeOlvide ? (
                <div className="space-y-4 py-2">
                  <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-200">
                    <CheckCircle2 size={18} className="shrink-0 text-emerald-400 mt-0.5" />
                    <span>{mensajeOlvide}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Revise su bandeja de entrada o correo no deseado (spam). El enlace tiene una validez de 60 minutos.
                  </p>
                  <button
                    type="button"
                    onClick={() => setModalOlvide(false)}
                    className="btn-cta w-full !py-2.5 text-xs font-bold"
                  >
                    Entendido, volver al login
                  </button>
                </div>
              ) : (
                <form onSubmit={solicitarRecuperacion} className="space-y-4">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Ingrese el correo electrónico o el nombre de usuario de su cuenta en UNIMARKET BO:
                  </p>

                  <div className="relative rounded-xl transition-all focus-within:ring-2 focus-within:ring-cyan-400/60">
                    <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      className="input pl-10 text-sm !border-white/15 focus:!border-cyan-400 focus:!ring-0"
                      placeholder="correo@empresa.com o usuario"
                      value={cuentaOlvide}
                      onChange={(e) => setCuentaOlvide(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  {errorOlvide && (
                    <div className="rounded-xl bg-rose-500/15 p-3 border border-rose-500/30 flex items-center gap-2 text-xs font-semibold text-rose-300">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{errorOlvide}</span>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setModalOlvide(false)}
                      className="btn-light text-xs !py-2.5 !px-4"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn-cta text-xs !py-2.5 !px-5 font-bold flex items-center gap-1.5"
                      disabled={enviandoOlvide}
                    >
                      {enviandoOlvide ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Enviando enlace…</span>
                        </>
                      ) : (
                        <span>Enviar enlace de recuperación</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

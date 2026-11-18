import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowRight, KeyRound, ArrowLeft
} from 'lucide-react';
import { api } from '../api.js';
import Logo from '../components/Logo.jsx';

export default function RecuperarPassword() {
  const { token } = useParams();
  const nav = useNavigate();

  const [verificando, setVerificando] = useState(true);
  const [tokenValido, setTokenValido] = useState(false);
  const [datosUsuario, setDatosUsuario] = useState(null);

  const [nuevaClave, setNuevaClave] = useState('');
  const [confirmarClave, setConfirmarClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [verConfirmar, setVerConfirmar] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  const [modalReenviar, setModalReenviar] = useState(false);
  const [correoReenviar, setCorreoReenviar] = useState('');
  const [enviandoReenlace, setEnviandoReenlace] = useState(false);
  const [mensajeReenlace, setMensajeReenlace] = useState('');

  useEffect(() => {
    let cancelado = false;
    const verificar = async () => {
      setVerificando(true);
      setError('');
      try {
        const res = await api(`/auth/verificar-token-reset/${token}`);
        if (!cancelado) {
          if (res?.valido) {
            setTokenValido(true);
            setDatosUsuario(res);
          } else {
            setTokenValido(false);
            setError(res?.error || 'El enlace de recuperación es inválido o ha expirado.');
          }
        }
      } catch (err) {
        if (!cancelado) {
          setTokenValido(false);
          setError(err.message || 'El enlace no es válido o ha expirado.');
        }
      } finally {
        if (!cancelado) setVerificando(false);
      }
    };
    if (token) verificar();
    return () => { cancelado = true; };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (nuevaClave.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (nuevaClave !== confirmarClave) {
      setError('Las contraseñas no coinciden. Verifique ambas casillas.');
      return;
    }

    setGuardando(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: { token, contrasena: nuevaClave },
      });
      setExito(true);
    } catch (err) {
      setError(err.message || 'Error al restablecer la contraseña.');
    } finally {
      setGuardando(false);
    }
  };

  const handleSolicitarNuevo = async (e) => {
    e.preventDefault();
    if (!correoReenviar.trim()) return;
    setEnviandoReenlace(true);
    setMensajeReenlace('');
    try {
      const res = await api('/auth/olvide-password', {
        method: 'POST',
        body: { correo: correoReenviar.trim() },
      });
      setMensajeReenlace(res.mensaje || 'Enlace enviado.');
    } catch (err) {
      setMensajeReenlace(err.message || 'Error al procesar la solicitud.');
    } finally {
      setEnviandoReenlace(false);
    }
  };

  return (
    <div className="relative w-full flex-1 min-h-[100dvh] flex items-center justify-center overflow-hidden bg-transparent px-4 pt-28 pb-14">
      {/* Fondo auroras decorativas */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden">
        <div className="absolute -top-[15%] -left-[10%] w-[60vw] h-[60vw] max-w-[650px] max-h-[650px] rounded-full bg-gradient-to-tr from-cyan-500/30 via-teal-400/20 to-transparent blur-[110px] mix-blend-screen" />
        <div className="absolute top-[20%] -right-[15%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-gradient-to-bl from-[#4F46E5]/35 via-[#7C3AED]/25 to-transparent blur-[120px] mix-blend-screen" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-20 w-full max-w-md rounded-3xl border border-white/15 bg-white/[0.08] backdrop-blur-2xl p-6 sm:p-9 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_30px_rgba(34,211,238,0.12)] overflow-hidden"
      >
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent" />

        <div className="text-center space-y-3 pb-5 border-b border-white/10">
          <div className="flex justify-center items-center">
            <Logo tamano="navbar" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            <KeyRound size={22} className="text-cyan-400" />
            <span>Recuperar contraseña</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Cree una nueva contraseña segura para ingresar a su cuenta
          </p>
        </div>

        {verificando ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 size={32} className="animate-spin text-cyan-400 mx-auto" />
            <p className="text-sm text-slate-300">Verificando enlace temporal…</p>
          </div>
        ) : exito ? (
          <div className="py-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 size={36} />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white">¡Contraseña restablecida!</h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Su contraseña ha sido actualizada con éxito. Ya puede iniciar sesión con su nueva clave de acceso.
              </p>
            </div>
            <Link
              to="/login"
              className="btn-cta w-full !py-3 font-bold flex items-center justify-center gap-2"
            >
              <span>Iniciar sesión ahora</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : !tokenValido ? (
          <div className="py-6 space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle size={30} />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">Enlace no válido o expirado</h2>
              <p className="text-xs text-rose-300 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                {error || 'El enlace para restablecer su contraseña ha expirado o ya fue utilizado.'}
              </p>
            </div>
            <p className="text-xs text-slate-300">
              Por razones de seguridad, los enlaces de recuperación solo son válidos por 60 minutos.
            </p>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => setModalReenviar(true)}
                className="btn-cta w-full !py-2.5 text-xs font-bold"
              >
                Solicitar un nuevo enlace
              </button>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors pt-2"
              >
                <ArrowLeft size={14} />
                <span>Volver al inicio de sesión</span>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-5">
            {datosUsuario?.usuario && (
              <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/25 p-3 text-xs text-cyan-200">
                Restableciendo contraseña para la cuenta: <strong className="text-white">{datosUsuario.usuario}</strong>
              </div>
            )}

            {/* Campo Nueva Contraseña */}
            <div>
              <label className="label !text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block" htmlFor="nueva-clave">
                NUEVA CONTRASEÑA
              </label>
              <div className="relative rounded-xl transition-all focus-within:ring-2 focus-within:ring-cyan-400/60">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="nueva-clave"
                  className="input pl-10 pr-11 text-base sm:text-sm !border-white/15 focus:!border-cyan-400 focus:!ring-0"
                  type={verClave ? 'text' : 'password'}
                  value={nuevaClave}
                  onChange={(e) => setNuevaClave(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setVerClave(!verClave)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-white rounded-lg transition-colors"
                >
                  {verClave ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Campo Confirmar Nueva Contraseña */}
            <div>
              <label className="label !text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block" htmlFor="confirmar-clave">
                CONFIRMAR CONTRASEÑA
              </label>
              <div className="relative rounded-xl transition-all focus-within:ring-2 focus-within:ring-cyan-400/60">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="confirmar-clave"
                  className="input pl-10 pr-11 text-base sm:text-sm !border-white/15 focus:!border-cyan-400 focus:!ring-0"
                  type={verConfirmar ? 'text' : 'password'}
                  value={confirmarClave}
                  onChange={(e) => setConfirmarClave(e.target.value)}
                  placeholder="Repita la nueva contraseña"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setVerConfirmar(!verConfirmar)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-white rounded-lg transition-colors"
                >
                  {verConfirmar ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-500/15 p-3 border border-rose-500/30 flex items-center gap-2 text-xs font-semibold text-rose-300">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn-cta w-full !py-3 shadow-xs font-bold flex items-center justify-center gap-2"
              disabled={guardando}
            >
              {guardando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Guardando contraseña…</span>
                </>
              ) : (
                <>
                  <span>Guardar nueva contraseña</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Modal auxiliar para solicitar nuevo enlace */}
        {modalReenviar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-[#0c1638] border border-white/20 p-5 space-y-4 shadow-2xl">
              <h3 className="font-bold text-white text-base">Solicitar nuevo enlace</h3>
              <p className="text-xs text-slate-300">
                Ingrese su correo electrónico o usuario registrado:
              </p>
              <form onSubmit={handleSolicitarNuevo} className="space-y-3">
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="usuario@empresa.com o usuario"
                  value={correoReenviar}
                  onChange={(e) => setCorreoReenviar(e.target.value)}
                  required
                  autoFocus
                />
                {mensajeReenlace && (
                  <p className="text-xs text-cyan-300 bg-cyan-500/10 p-2.5 rounded-lg border border-cyan-500/20">
                    {mensajeReenlace}
                  </p>
                )}
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => { setModalReenviar(false); setMensajeReenlace(''); }}
                    className="btn-light text-xs !py-2 !px-3"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    className="btn-cta text-xs !py-2 !px-3 font-bold"
                    disabled={enviandoReenlace}
                  >
                    {enviandoReenlace ? 'Enviando…' : 'Enviar enlace'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

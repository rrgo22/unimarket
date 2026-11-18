import { useState } from 'react';
import {
  X, Lock, Key, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle
} from 'lucide-react';
import { api } from '../api.js';
import { toast } from 'sonner';

export default function ModalCambiarPassword({ abierto, onCerrar }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');

  const [verActual, setVerActual] = useState(false);
  const [verNueva, setVerNueva] = useState(false);
  const [verConfirmar, setVerConfirmar] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  if (!abierto) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (nueva.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (nueva !== confirmar) {
      setError('Las contraseñas no coinciden. Verifique ambas casillas.');
      return;
    }

    if (actual === nueva) {
      setError('La nueva contraseña debe ser diferente de la actual.');
      return;
    }

    setGuardando(true);
    try {
      await api('/auth/cambiar-password', {
        method: 'PUT',
        body: {
          contrasena_actual: actual,
          nueva_contrasena: nueva,
        },
      });
      setExito(true);
      toast.success('Contraseña modificada correctamente');
      setTimeout(() => {
        onCerrar();
        setExito(false);
        setActual('');
        setNueva('');
        setConfirmar('');
      }, 1800);
    } catch (err) {
      setError(err.message || 'Error al cambiar la contraseña');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-3xl bg-[#0c1638] border border-white/20 p-6 sm:p-7 space-y-5 shadow-2xl overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent" />

        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Key size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Cambiar Contraseña
              </h2>
              <p className="text-xs text-slate-300">
                Actualice su clave de acceso para mayor seguridad
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {exito ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 size={40} className="text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-white">¡Contraseña actualizada!</h3>
            <p className="text-xs text-slate-300">
              Su clave ha sido cambiada con éxito en el sistema.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
            {/* Contraseña Actual */}
            <div>
              <label className="label !text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                CONTRASEÑA ACTUAL
              </label>
              <div className="relative rounded-xl transition-all focus-within:ring-2 focus-within:ring-cyan-400/60">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type={verActual ? 'text' : 'password'}
                  className="input pl-10 pr-10 text-xs sm:text-sm !border-white/15 focus:!border-cyan-400"
                  placeholder="Ingrese su clave actual"
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setVerActual(!verActual)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                >
                  {verActual ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Nueva Contraseña */}
            <div>
              <label className="label !text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                NUEVA CONTRASEÑA
              </label>
              <div className="relative rounded-xl transition-all focus-within:ring-2 focus-within:ring-cyan-400/60">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type={verNueva ? 'text' : 'password'}
                  className="input pl-10 pr-10 text-xs sm:text-sm !border-white/15 focus:!border-cyan-400"
                  placeholder="Mínimo 8 caracteres"
                  value={nueva}
                  onChange={(e) => setNueva(e.target.value)}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setVerNueva(!verNueva)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                >
                  {verNueva ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirmar Contraseña */}
            <div>
              <label className="label !text-slate-200 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                CONFIRMAR NUEVA CONTRASEÑA
              </label>
              <div className="relative rounded-xl transition-all focus-within:ring-2 focus-within:ring-cyan-400/60">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type={verConfirmar ? 'text' : 'password'}
                  className="input pl-10 pr-10 text-xs sm:text-sm !border-white/15 focus:!border-cyan-400"
                  placeholder="Repita la nueva clave"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setVerConfirmar(!verConfirmar)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                >
                  {verConfirmar ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onCerrar}
                className="btn-light text-xs !py-2.5 !px-4"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="btn-cta text-xs !py-2.5 !px-5 font-bold flex items-center gap-1.5"
              >
                {guardando ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Guardando…</span>
                  </>
                ) : (
                  <span>Actualizar contraseña</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

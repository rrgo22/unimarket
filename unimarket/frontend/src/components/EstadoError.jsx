import { AlertTriangle, RotateCw } from 'lucide-react';

export default function EstadoError({
  mensaje = 'No se pudo cargar la información.',
  onReintentar,
  compacto = false,
}) {
  if (compacto) {
    return (
      <div
        role="alert"
        className="flex items-center justify-center gap-2.5 p-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] text-rose-200 text-xs text-center"
      >
        <AlertTriangle size={15} className="text-rose-400 shrink-0" aria-hidden="true" />
        <span>{mensaje}</span>
        {onReintentar && (
          <button
            type="button"
            onClick={onReintentar}
            className="ml-2 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium flex items-center gap-1 transition-colors"
          >
            <RotateCw size={12} className="shrink-0" />
            <span>Reintentar</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="w-full flex flex-col items-center justify-center py-10 px-4 rounded-2xl border border-white/10 bg-white/[0.02] text-center space-y-3"
    >
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
        <AlertTriangle size={20} aria-hidden="true" />
      </div>
      <p className="text-sm text-slate-300 max-w-md">{mensaje}</p>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          className="btn-light !px-4 !py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all"
        >
          <RotateCw size={14} className="shrink-0" />
          <span>Reintentar</span>
        </button>
      )}
    </div>
  );
}

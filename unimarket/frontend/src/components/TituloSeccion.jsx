import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function TituloSeccion({
  icono: Icono,
  titulo,
  subtitulo,
  enlaceTexto,
  enlaceRuta,
  accion,
  sinLinea = false,
  className = '',
}) {
  return (
    <div className={`space-y-2 pb-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icono && (
            <div className="grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-500 text-white shadow-xs shrink-0">
              <Icono size={20} strokeWidth={2.2} aria-hidden="true" />
            </div>
          )}
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-snug">
              {titulo}
            </h2>
            {subtitulo && (
              <p className="text-xs sm:text-sm text-slate-300 leading-normal mt-0.5">
                {subtitulo}
              </p>
            )}
          </div>
        </div>

        {/* Enlace o acción opcional a la derecha */}
        {enlaceTexto && enlaceRuta && (
          <Link
            to={enlaceRuta}
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors py-1"
          >
            <span>{enlaceTexto}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        )}

        {accion && <div className="shrink-0">{accion}</div>}
      </div>

      {/* Línea fina degradada debajo de la sección (opcional) */}
      {!sinLinea && (
        <div className="h-[1px] w-full bg-gradient-to-r from-cyan-500/25 via-brand-500/20 to-transparent rounded-full mt-2" />
      )}
    </div>
  );
}

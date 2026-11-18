import React, { useState } from 'react';

/**
 * Componente oficial Logo para UNIMARKET BO
 * - Muestra /logo1.png con fallback al icono cuadrado UM anterior ante error de carga
 * - Tamaños: 'navbar' (36-40px, eager loading) y 'footer' (40-44px, lazy loading)
 * - Mantiene aspecto y dimensiones explícitas para evitar Cumulative Layout Shift (CLS)
 * - Texto: 'UNIMARKET' en blanco y 'BO' en cian #22D3EE
 */
export default function Logo({
  tamano = 'navbar', // 'navbar' | 'footer'
  mostrarTexto = true,
  className = '',
}) {
  const [errorImagen, setErrorImagen] = useState(false);

  const esFooter = tamano === 'footer';
  const altoClase = esFooter ? 'h-10 sm:h-11 max-h-11' : 'h-9 sm:h-10 max-h-10';
  const cuadroTam = esFooter ? 'h-10 w-10 text-sm' : 'h-9 w-9 text-xs sm:text-sm';
  const loadingModo = esFooter ? 'lazy' : 'eager';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Imagen del logo con fallback al diseño previo */}
      {!errorImagen ? (
        <img
          src="/logo1.png"
          alt="UNIMARKET BO"
          width={40}
          height={38}
          loading={loadingModo}
          onError={() => setErrorImagen(true)}
          className={`${altoClase} w-auto object-contain shrink-0 transition-transform duration-200 group-hover:scale-105`}
        />
      ) : (
        <span
          className={`grid ${cuadroTam} place-items-center rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-cyan-400 font-extrabold text-white shadow-sm shrink-0 transition-transform duration-200 group-hover:scale-105`}
          aria-hidden="true"
        >
          UM
        </span>
      )}

      {mostrarTexto && (
        <span
          className={`tracking-tight font-extrabold text-white ${
            esFooter ? 'text-lg sm:text-xl' : 'text-lg'
          }`}
        >
          UNIMARKET <span className="text-cyan-400 font-bold">BO</span>
        </span>
      )}
    </div>
  );
}

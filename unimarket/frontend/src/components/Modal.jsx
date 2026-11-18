import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

export default function Modal({
  abierto = true,
  onCerrar,
  titulo,
  subtitulo,
  headerPersonalizado,
  footer,
  children,
  maxWidth = 'max-w-3xl',
  ariaLabelledBy = 'modal-dialog-titulo',
  mostrarBotonCerrar = true,
  manijaMovil = true,
  classNameContenedor = '',
  classNameCuerpo = '',
  sinPaddingCuerpo = false,
}) {
  const dialogRef = useRef(null);
  const elementoPrevioRef = useRef(null);
  const reducido = useReducedMotion();

  // Guardar elemento enfocado antes de abrir y restaurarlo al cerrar
  useEffect(() => {
    if (abierto) {
      elementoPrevioRef.current = document.activeElement;
    }
    return () => {
      if (elementoPrevioRef.current && typeof elementoPrevioRef.current.focus === 'function') {
        elementoPrevioRef.current.focus();
      }
    };
  }, [abierto]);

  // Bloquear scroll de la página completa y prevenir saltos de scrollbar
  useEffect(() => {
    if (!abierto) return;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const bodyOverflowPrev = document.body.style.overflow;
    const bodyPaddingRightPrev = document.body.style.paddingRight;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = bodyOverflowPrev;
      document.body.style.paddingRight = bodyPaddingRightPrev;
    };
  }, [abierto]);

  // Manejo de tecla Escape
  const handleKeyDown = useCallback(
    (e) => {
      if (!abierto) return;

      if (e.key === 'Escape') {
        e.stopPropagation();
        onCerrar?.();
        return;
      }

      // Atrapado de foco (Focus Trap)
      if (e.key === 'Tab' && dialogRef.current) {
        const elementosFoco = dialogRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (elementosFoco.length === 0) {
          e.preventDefault();
          return;
        }

        const primerElemento = elementosFoco[0];
        const ultimoElemento = elementosFoco[elementosFoco.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === primerElemento || document.activeElement === dialogRef.current) {
            e.preventDefault();
            ultimoElemento.focus();
          }
        } else {
          if (document.activeElement === ultimoElemento) {
            e.preventDefault();
            primerElemento.focus();
          }
        }
      }
    },
    [abierto, onCerrar]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Enfocar el primer elemento interactivo o el diálogo al abrir
  useEffect(() => {
    if (abierto) {
      const timer = setTimeout(() => {
        if (!dialogRef.current) return;
        const primerElemento = dialogRef.current.querySelector(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (primerElemento) {
          primerElemento.focus();
        } else {
          dialogRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [abierto]);

  if (typeof document === 'undefined') return null;

  const animacionFondo = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: reducido ? 0.05 : 0.2 },
  };

  const animacionDialogo = reducido
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.1 },
      }
    : {
        initial: { opacity: 0, y: 35, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 25, scale: 0.98 },
        transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
      };

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/70 p-0 sm:p-4 backdrop-blur-xs sm:backdrop-blur-sm transition-opacity"
          onClick={onCerrar}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledBy}
        >
          <motion.div
            {...animacionFondo}
            className="fixed inset-0 pointer-events-none"
            aria-hidden="true"
          />

          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            {...animacionDialogo}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full ${maxWidth} bg-[#0E1A44] text-white rounded-t-3xl sm:rounded-2xl shadow-floating border border-white/10 max-h-[92dvh] sm:max-h-[90dvh] flex flex-col overflow-hidden outline-none ${classNameContenedor}`}
          >
            {/* Manija táctil en móvil */}
            {manijaMovil && (
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-3 sm:hidden shrink-0" />
            )}

            {/* Cabecera personalizada o estándar */}
            {headerPersonalizado ? (
              <div className="shrink-0">{headerPersonalizado}</div>
            ) : titulo ? (
              <div className="flex items-center justify-between border-b border-white/10 px-5 sm:px-6 py-3.5 shrink-0 bg-[#0E1A44]">
                <div>
                  {subtitulo && (
                    <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 block">
                      {subtitulo}
                    </span>
                  )}
                  <h2
                    id={ariaLabelledBy}
                    className="text-lg sm:text-xl font-bold text-white tracking-tight"
                  >
                    {titulo}
                  </h2>
                </div>

                {mostrarBotonCerrar && (
                  <button
                    type="button"
                    onClick={onCerrar}
                    className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    aria-label="Cerrar modal"
                  >
                    <X size={20} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </div>
            ) : null}

            {/* Contenido con scroll interno */}
            <div
              className={`overflow-y-auto flex-1 ${
                sinPaddingCuerpo ? '' : 'p-5 sm:p-6'
              } ${classNameCuerpo}`}
            >
              {children}
            </div>

            {/* Pie de modal opcional */}
            {footer && <div className="shrink-0 border-t border-white/10 bg-white/[0.03] px-5 sm:px-6 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

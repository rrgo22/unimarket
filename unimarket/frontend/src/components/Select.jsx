import { useState, useRef, useEffect, useId, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, X } from 'lucide-react';

/**
 * Componente Select oscuro y accesible según patrón WAI-ARIA Listbox.
 * - En escritorio: menú desplegable con fondo azul noche sólido (#0E1A44), bordes suaves y sombra.
 * - En móvil (< 768px): hoja inferior (bottom sheet / modal) accesible.
 * - Navegación completa por teclado (Flechas, Home, End, escribir para saltar, Enter/Espacio, Esc).
 */
export default function Select({
  value,
  onChange,
  options = [],
  name,
  id,
  placeholder = 'Seleccione una opción',
  disabled = false,
  className = '',
  botonClassName = '',
  ariaLabel,
  icono: Icono,
}) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const listboxId = `${selectId}-listbox`;

  const [abierto, setAbierto] = useState(false);
  const [indiceResaltado, setIndiceResaltado] = useState(-1);
  const [esMovil, setEsMovil] = useState(false);

  const contenedorRef = useRef(null);
  const botonRef = useRef(null);
  const listaRef = useRef(null);
  const busquedaTecladoRef = useRef({ buffer: '', timer: null });

  // Normalizar opciones a formato { value, label, sublabel, disabled }
  const opcionesNormalizadas = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: String(opt.value ?? ''),
        label: opt.label ?? String(opt.value ?? ''),
        sublabel: opt.sublabel ?? null,
        disabled: Boolean(opt.disabled),
      };
    }
    return {
      value: String(opt ?? ''),
      label: String(opt ?? ''),
      sublabel: null,
      disabled: false,
    };
  });

  const opcionSeleccionada = opcionesNormalizadas.find(
    (o) => String(o.value) === String(value)
  );

  // Detectar vista móvil (< 768px)
  useEffect(() => {
    const verificarMovil = () => {
      setEsMovil(window.innerWidth < 768);
    };
    verificarMovil();
    window.addEventListener('resize', verificarMovil);
    return () => window.removeEventListener('resize', verificarMovil);
  }, []);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!abierto) return;
    const clickAfuera = (e) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', clickAfuera);
    document.addEventListener('touchstart', clickAfuera);
    return () => {
      document.removeEventListener('mousedown', clickAfuera);
      document.removeEventListener('touchstart', clickAfuera);
    };
  }, [abierto]);

  // Actualizar índice resaltado al abrir
  useEffect(() => {
    if (abierto) {
      const idx = opcionesNormalizadas.findIndex(
        (o) => String(o.value) === String(value)
      );
      setIndiceResaltado(idx >= 0 ? idx : 0);
    }
  }, [abierto, value, opcionesNormalizadas.length]);

  // Scroll automático a la opción resaltada
  useEffect(() => {
    if (abierto && listaRef.current && indiceResaltado >= 0) {
      const el = listaRef.current.children[indiceResaltado];
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [abierto, indiceResaltado]);

  const seleccionar = useCallback(
    (opcion) => {
      if (opcion.disabled) return;
      if (onChange) {
        const syntheticEvent = {
          target: { value: opcion.value, name: name || '' },
          currentTarget: { value: opcion.value, name: name || '' },
          value: opcion.value,
        };
        onChange(syntheticEvent);
      }
      setAbierto(false);
      if (botonRef.current) {
        botonRef.current.focus();
      }
    },
    [onChange, name]
  );

  // Manejador de teclado
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!abierto) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setAbierto(true);
        return;
      }
    }

    if (abierto) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setAbierto(false);
        botonRef.current?.focus();
        return;
      }

      if (e.key === 'Tab') {
        setAbierto(false);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndiceResaltado((prev) => {
          let next = prev + 1;
          while (next < opcionesNormalizadas.length && opcionesNormalizadas[next].disabled) {
            next++;
          }
          return next < opcionesNormalizadas.length ? next : prev;
        });
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndiceResaltado((prev) => {
          let prevIdx = prev - 1;
          while (prevIdx >= 0 && opcionesNormalizadas[prevIdx].disabled) {
            prevIdx--;
          }
          return prevIdx >= 0 ? prevIdx : prev;
        });
        return;
      }

      if (e.key === 'Home') {
        e.preventDefault();
        const first = opcionesNormalizadas.findIndex((o) => !o.disabled);
        if (first >= 0) setIndiceResaltado(first);
        return;
      }

      if (e.key === 'End') {
        e.preventDefault();
        for (let i = opcionesNormalizadas.length - 1; i >= 0; i--) {
          if (!opcionesNormalizadas[i].disabled) {
            setIndiceResaltado(i);
            break;
          }
        }
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (indiceResaltado >= 0 && opcionesNormalizadas[indiceResaltado]) {
          seleccionar(opcionesNormalizadas[indiceResaltado]);
        }
        return;
      }

      // Escribir para saltar a una opción
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const char = e.key.toLowerCase();
        const buffer = busquedaTecladoRef.current.buffer + char;
        busquedaTecladoRef.current.buffer = buffer;
        if (busquedaTecladoRef.current.timer) {
          clearTimeout(busquedaTecladoRef.current.timer);
        }
        busquedaTecladoRef.current.timer = setTimeout(() => {
          busquedaTecladoRef.current.buffer = '';
        }, 500);

        const matchIdx = opcionesNormalizadas.findIndex(
          (o) =>
            !o.disabled &&
            o.label.toLowerCase().startsWith(buffer)
        );
        if (matchIdx >= 0) {
          setIndiceResaltado(matchIdx);
        }
      }
    }
  };

  return (
    <div
      ref={contenedorRef}
      className={`relative inline-block w-full text-left ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Botón activador del Select */}
      <button
        ref={botonRef}
        type="button"
        id={selectId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={() => !disabled && setAbierto((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 select-none shadow-sm outline-none focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-[#070F2B] disabled:opacity-50 disabled:cursor-not-allowed ${
          abierto
            ? 'bg-[#0E1A44] border-cyan-400 text-white ring-1 ring-cyan-400'
            : 'bg-white/5 border border-white/15 text-slate-100 hover:bg-white/10 hover:border-white/25'
        } ${botonClassName}`}
      >
        <span className="flex items-center gap-2 truncate">
          {Icono && <Icono size={16} className="text-cyan-400 shrink-0" aria-hidden="true" />}
          {opcionSeleccionada ? (
            <span className="truncate text-white">{opcionSeleccionada.label}</span>
          ) : (
            <span className="truncate text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${
            abierto ? 'rotate-180 text-cyan-400' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Menú Desplegable (Escritorio o Móvil) */}
      <AnimatePresence>
        {abierto && (
          <>
            {/* Versión Móvil: Hoja Inferior (Bottom Sheet Modal) */}
            {esMovil ? (
              <div className="fixed inset-0 z-50 flex items-end sm:hidden">
                {/* Telón de fondo */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setAbierto(false)}
                  className="fixed inset-0 bg-black/70 backdrop-blur-xs"
                />

                {/* Hoja modal inferior */}
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="relative z-10 w-full max-h-[75vh] flex flex-col rounded-t-2xl border-t border-white/15 bg-[#0E1A44] p-4 text-white shadow-2xl"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <span className="text-sm font-bold text-slate-200">
                      {ariaLabel || placeholder}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAbierto(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                      aria-label="Cerrar opciones"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <ul
                    ref={listaRef}
                    id={listboxId}
                    role="listbox"
                    aria-label={ariaLabel || placeholder}
                    className="mt-2 flex-1 overflow-y-auto divide-y divide-white/5 py-1 text-sm focus:outline-none"
                  >
                    {opcionesNormalizadas.map((opcion, idx) => {
                      const seleccionada = String(opcion.value) === String(value);
                      return (
                        <li
                          key={opcion.value || idx}
                          role="option"
                          aria-selected={seleccionada}
                          aria-disabled={opcion.disabled}
                          onClick={() => seleccionar(opcion)}
                          className={`flex items-center justify-between px-3 py-3 rounded-xl transition-colors ${
                            opcion.disabled
                              ? 'opacity-40 cursor-not-allowed'
                              : seleccionada
                              ? 'bg-cyan-500/20 text-cyan-300 font-semibold cursor-pointer'
                              : 'text-slate-200 hover:bg-white/10 cursor-pointer'
                          }`}
                        >
                          <div className="flex flex-col truncate pr-2">
                            <span className="truncate">{opcion.label}</span>
                            {opcion.sublabel && (
                              <span className="text-xs text-slate-400">{opcion.sublabel}</span>
                            )}
                          </div>
                          {seleccionada && (
                            <Check size={18} className="text-cyan-400 shrink-0" aria-hidden="true" />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              </div>
            ) : (
              /* Versión Escritorio: Desplegable bajo el botón */
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                className="absolute left-0 mt-1.5 w-full min-w-[200px] z-50 rounded-xl border border-white/15 bg-[#0E1A44] py-1.5 text-white shadow-2xl backdrop-blur-md"
                style={{ backgroundColor: '#0E1A44' }}
              >
                <ul
                  ref={listaRef}
                  id={listboxId}
                  role="listbox"
                  aria-label={ariaLabel || placeholder}
                  className="max-h-60 overflow-y-auto p-1 text-sm focus:outline-none"
                >
                  {opcionesNormalizadas.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-slate-400 text-center">
                      Sin opciones disponibles
                    </li>
                  ) : (
                    opcionesNormalizadas.map((opcion, idx) => {
                      const seleccionada = String(opcion.value) === String(value);
                      const resaltada = idx === indiceResaltado;

                      return (
                        <li
                          key={opcion.value || idx}
                          id={`${selectId}-opt-${idx}`}
                          role="option"
                          aria-selected={seleccionada}
                          aria-disabled={opcion.disabled}
                          onMouseEnter={() => !opcion.disabled && setIndiceResaltado(idx)}
                          onClick={() => seleccionar(opcion)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors select-none ${
                            opcion.disabled
                              ? 'opacity-40 cursor-not-allowed'
                              : seleccionada
                              ? 'bg-cyan-500/20 text-cyan-300 font-semibold cursor-pointer'
                              : resaltada
                              ? 'bg-white/10 text-white cursor-pointer'
                              : 'text-slate-200 hover:bg-white/10 cursor-pointer'
                          }`}
                        >
                          <div className="flex flex-col truncate pr-2">
                            <span className="truncate">{opcion.label}</span>
                            {opcion.sublabel && (
                              <span className="text-xs text-slate-400">{opcion.sublabel}</span>
                            )}
                          </div>
                          {seleccionada && (
                            <Check size={16} className="text-cyan-400 shrink-0 ml-2" aria-hidden="true" />
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

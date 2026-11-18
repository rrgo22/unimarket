import { useState, useEffect, useRef, useId, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Package,
  Tag,
  Cpu,
  LayoutGrid,
  Store,
  BadgeCheck,
  History,
  Trash2,
  Loader2,
  ArrowRight,
} from 'lucide-react';

const HISTORIAL_KEY = 'unimarket_busquedas_recientes';

function obtenerHistorial() {
  try {
    const raw = localStorage.getItem(HISTORIAL_KEY);
    return raw ? JSON.parse(raw).slice(0, 5) : [];
  } catch {
    return [];
  }
}

function guardarEnHistorial(termino) {
  const t = String(termino || '').trim();
  if (!t || t.length < 2) return;
  try {
    const actual = obtenerHistorial().filter(
      (item) => item.toLowerCase() !== t.toLowerCase()
    );
    const nuevo = [t, ...actual].slice(0, 5);
    localStorage.setItem(HISTORIAL_KEY, JSON.stringify(nuevo));
  } catch {
    // Si localStorage no está disponible, continuar sin fallar
  }
}

function limpiarHistorialStorage() {
  try {
    localStorage.removeItem(HISTORIAL_KEY);
  } catch {
    // ignore
  }
}

// Resaltar el término coincidente dentro del texto
function TextoResaltado({ texto, termino }) {
  if (!texto) return null;
  const str = String(texto);
  const term = String(termino || '').trim();
  if (!term) return <span>{str}</span>;

  // Quitar tildes para búsqueda de coincidencia
  const strNorm = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const termNorm = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const idx = strNorm.indexOf(termNorm);

  if (idx === -1) return <span>{str}</span>;

  const antes = str.slice(0, idx);
  const coincidencia = str.slice(idx, idx + term.length);
  const despues = str.slice(idx + term.length);

  return (
    <span>
      {antes}
      <strong className="text-cyan-300 font-bold underline decoration-cyan-400/50">
        {coincidencia}
      </strong>
      {despues}
    </span>
  );
}

export default function BuscadorAvanzado({
  valorInicial = '',
  placeholder = 'Buscar productos, marcas, modelos o empresas…',
  onSearch,
  className = '',
  autoFocus = false,
  tamano = 'md', // 'lg' para hero, 'md' para catálogo
}) {
  const nav = useNavigate();
  const idUnico = useId();
  const inputId = `buscador-input-${idUnico}`;
  const listboxId = `buscador-listbox-${idUnico}`;

  const [query, setQuery] = useState(valorInicial);
  const [sugerencias, setSugerencias] = useState({
    productos: [],
    marcas: [],
    modelos: [],
    categorias: [],
    empresas: [],
  });
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [indiceResaltado, setIndiceResaltado] = useState(-1);
  const [historial, setHistorial] = useState([]);
  const [anuncioLectora, setAnuncioLectora] = useState('');

  const contenedorRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Sincronizar si cambia valorInicial
  useEffect(() => {
    setQuery(valorInicial);
  }, [valorInicial]);

  // Cargar historial al montar
  useEffect(() => {
    setHistorial(obtenerHistorial());
  }, []);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickFuera = (e) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickFuera);
    document.addEventListener('touchstart', handleClickFuera);
    return () => {
      document.removeEventListener('mousedown', handleClickFuera);
      document.removeEventListener('touchstart', handleClickFuera);
    };
  }, []);

  // Búsqueda con debounce de 200 ms y cancelación AbortController
  useEffect(() => {
    const qLimpia = query.trim();
    if (qLimpia.length < 2) {
      setSugerencias({ productos: [], marcas: [], modelos: [], categorias: [], empresas: [] });
      setCargando(false);
      setIndiceResaltado(-1);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setCargando(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/publico/sugerencias?q=${encodeURIComponent(qLimpia)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error('Error al obtener sugerencias');
        const data = await res.json();
        setSugerencias(data);
        setIndiceResaltado(-1);

        const totalItems =
          (data.productos?.length || 0) +
          (data.marcas?.length || 0) +
          (data.modelos?.length || 0) +
          (data.categorias?.length || 0) +
          (data.empresas?.length || 0);

        setAnuncioLectora(
          totalItems > 0
            ? `${totalItems} sugerencias encontradas.`
            : 'No se encontraron sugerencias; presione Enter para buscar.'
        );
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error en sugerencias:', err);
        }
      } finally {
        setCargando(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Lista aplanada de todas las sugerencias activas para navegación con teclado
  const itemsAplanados = [];
  const qLimpia = query.trim();

  if (qLimpia.length >= 2) {
    (sugerencias.productos || []).forEach((p) => {
      itemsAplanados.push({
        tipo: 'producto',
        id: `prod-${p.id_producto}`,
        datos: p,
      });
    });
    (sugerencias.marcas || []).forEach((m) => {
      itemsAplanados.push({
        tipo: 'marca',
        id: `marca-${m.marca}`,
        datos: m,
      });
    });
    (sugerencias.modelos || []).forEach((mdl) => {
      itemsAplanados.push({
        tipo: 'modelo',
        id: `mdl-${mdl.modelo}-${mdl.marca}`,
        datos: mdl,
      });
    });
    (sugerencias.categorias || []).forEach((c) => {
      itemsAplanados.push({
        tipo: 'categoria',
        id: `cat-${c.id_categoria}`,
        datos: c,
      });
    });
    (sugerencias.empresas || []).forEach((emp) => {
      itemsAplanados.push({
        tipo: 'empresa',
        id: `emp-${emp.id_empresa}`,
        datos: emp,
      });
    });
    // Fila fija final: "Ver todos los resultados"
    itemsAplanados.push({
      tipo: 'todos',
      id: 'todos-resultados',
      datos: { q: qLimpia },
    });
  } else if (qLimpia.length === 0 && historial.length > 0) {
    historial.forEach((h, i) => {
      itemsAplanados.push({
        tipo: 'historial',
        id: `hist-${i}`,
        datos: { texto: h },
      });
    });
  }

  const ejecutarBusqueda = useCallback(
    (termino) => {
      const t = String(termino ?? query).trim();
      guardarEnHistorial(t);
      setAbierto(false);
      setIndiceResaltado(-1);
      if (onSearch) {
        onSearch(t);
      } else {
        nav(t ? `/catalogo?q=${encodeURIComponent(t)}` : '/catalogo');
      }
    },
    [query, onSearch, nav]
  );

  const seleccionarItem = useCallback(
    (item) => {
      if (!item) return;
      setAbierto(false);
      setIndiceResaltado(-1);

      switch (item.tipo) {
        case 'producto':
          guardarEnHistorial(item.datos.nombre);
          nav(`/catalogo?q=${encodeURIComponent(item.datos.nombre)}&producto=${item.datos.id_producto}`);
          break;
        case 'marca':
          guardarEnHistorial(item.datos.marca);
          nav(`/catalogo?marca=${encodeURIComponent(item.datos.marca)}`);
          break;
        case 'modelo':
          guardarEnHistorial(item.datos.modelo);
          nav(`/catalogo?q=${encodeURIComponent(item.datos.modelo)}`);
          break;
        case 'categoria':
          nav(`/catalogo?categoria=${item.datos.id_categoria}`);
          break;
        case 'empresa':
          nav(`/tienda/${item.datos.slug}`);
          break;
        case 'historial':
          setQuery(item.datos.texto);
          ejecutarBusqueda(item.datos.texto);
          break;
        case 'todos':
        default:
          ejecutarBusqueda(item.datos?.q || query);
          break;
      }
    },
    [nav, query, ejecutarBusqueda]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (indiceResaltado >= 0 && itemsAplanados[indiceResaltado]) {
      seleccionarItem(itemsAplanados[indiceResaltado]);
    } else {
      ejecutarBusqueda(query);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAbierto(true);
      setIndiceResaltado((prev) =>
        prev < itemsAplanados.length - 1 ? prev + 1 : 0
      );
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAbierto(true);
      setIndiceResaltado((prev) =>
        prev > 0 ? prev - 1 : itemsAplanados.length - 1
      );
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setAbierto(false);
      setIndiceResaltado(-1);
      return;
    }

    if (e.key === 'Tab') {
      setAbierto(false);
      return;
    }
  };

  const handleBorrarHistorial = (e) => {
    e.stopPropagation();
    limpiarHistorialStorage();
    setHistorial([]);
    setIndiceResaltado(-1);
  };

  const haySugerencias =
    (sugerencias.productos?.length || 0) > 0 ||
    (sugerencias.marcas?.length || 0) > 0 ||
    (sugerencias.modelos?.length || 0) > 0 ||
    (sugerencias.categorias?.length || 0) > 0 ||
    (sugerencias.empresas?.length || 0) > 0;

  const mostrarPanel =
    abierto && (qLimpia.length >= 2 || (qLimpia.length === 0 && historial.length > 0));

  const itemActivoId =
    indiceResaltado >= 0 && itemsAplanados[indiceResaltado]
      ? itemsAplanados[indiceResaltado].id
      : undefined;

  return (
    <div ref={contenedorRef} className={`relative w-full ${className}`}>
      {/* Región accesible aria-live para lectores de pantalla */}
      <span className="sr-only" role="status" aria-live="polite">
        {anuncioLectora}
      </span>

      {/* Formulario de búsqueda con píldora redondeada */}
      <form
        role="search"
        onSubmit={handleSubmit}
        className={`relative flex items-center w-full rounded-full transition-all duration-200 ${
          tamano === 'lg'
            ? 'p-1.5 sm:p-2 bg-slate-900/80 border border-white/15 backdrop-blur-md'
            : 'p-1 sm:p-1.5 bg-slate-900/70 border border-white/15 backdrop-blur-sm'
        } focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/50 focus-within:shadow-[0_0_24px_rgba(34,211,238,0.25)]`}
      >
        {/* Icono de búsqueda / spinner discreto */}
        <div className="pl-3 sm:pl-4 pr-2 text-slate-400 flex items-center shrink-0">
          {cargando ? (
            <Loader2
              size={tamano === 'lg' ? 22 : 18}
              className="animate-spin text-cyan-400"
              aria-hidden="true"
            />
          ) : (
            <Search
              size={tamano === 'lg' ? 22 : 18}
              className="text-slate-400"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Input combobox accesible - .input-bare sin recuadros ni bordes internos */}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={query}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck="false"
          role="combobox"
          aria-expanded={mostrarPanel}
          aria-controls={listboxId}
          aria-activedescendant={itemActivoId}
          aria-autocomplete="list"
          aria-label="Buscar productos, marcas, modelos o empresas en UNIMARKET BO"
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => {
            setHistorial(obtenerHistorial());
            setAbierto(true);
          }}
          onKeyDown={handleKeyDown}
          className={`input-bare flex-1 w-full bg-transparent text-white placeholder-slate-400 font-medium ${
            tamano === 'lg' ? 'text-base sm:text-lg py-2' : 'text-sm sm:text-base py-1.5'
          } border-0 outline-none shadow-none ring-0 focus:outline-none focus:ring-0 focus:border-0`}
        />

        {/* Botón para limpiar campo */}
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
              setAbierto(true);
            }}
            className="p-1.5 mr-1 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}

        {/* Botón Buscar con token CTA índigo-violeta */}
        <button
          type="submit"
          className={`btn-cta rounded-full font-bold flex items-center justify-center shrink-0 transition-all ${
            tamano === 'lg'
              ? '!px-6 sm:!px-8 !py-3 text-sm sm:text-base'
              : '!px-4 sm:!px-5 !py-2 text-xs sm:text-sm'
          }`}
        >
          <span>Buscar</span>
        </button>
      </form>

      {/* Panel Desplegable de Autocompletado y Búsquedas Recientes */}
      <AnimatePresence>
        {mostrarPanel && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            id={listboxId}
            role="listbox"
            aria-label="Sugerencias de búsqueda"
            className="absolute left-0 right-0 mt-2 z-50 max-h-[60vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#0E1A44] p-2 text-white shadow-2xl backdrop-blur-xl divide-y divide-white/10"
            style={{ backgroundColor: '#0E1A44' }}
          >
            {/* ESTADO 1: Búsquedas Recientes (con campo vacío) */}
            {qLimpia.length === 0 && historial.length > 0 && (
              <div className="py-1">
                <div className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <History size={13} className="text-cyan-400" aria-hidden="true" />
                    <span>Búsquedas recientes</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleBorrarHistorial}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-300 transition-colors"
                  >
                    <Trash2 size={12} />
                    <span>Borrar historial</span>
                  </button>
                </div>
                <div className="mt-1 space-y-0.5">
                  {historial.map((h, i) => {
                    const idxGlobal = i;
                    const resaltado = idxGlobal === indiceResaltado;
                    return (
                      <div
                        key={`hist-${i}`}
                        id={`hist-${i}`}
                        role="option"
                        aria-selected={resaltado}
                        onMouseEnter={() => setIndiceResaltado(idxGlobal)}
                        onClick={() => {
                          setQuery(h);
                          ejecutarBusqueda(h);
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors cursor-pointer select-none ${
                          resaltado
                            ? 'bg-white/10 text-white'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <History size={15} className="text-slate-400 shrink-0" />
                          <span className="truncate">{h}</span>
                        </span>
                        <ArrowRight size={14} className="text-slate-500 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ESTADO 2: Sugerencias por secciones (con texto >= 2 caracteres) */}
            {qLimpia.length >= 2 && haySugerencias && (
              <>
                {/* SECCIÓN 1: PRODUCTOS */}
                {sugerencias.productos?.length > 0 && (
                  <div className="py-2">
                    <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Package size={13} className="text-cyan-400" aria-hidden="true" />
                      <span>Productos</span>
                    </div>
                    <div className="mt-1 space-y-1">
                      {sugerencias.productos.map((prod) => {
                        const idxGlobal = itemsAplanados.findIndex(
                          (it) => it.id === `prod-${prod.id_producto}`
                        );
                        const resaltado = idxGlobal === indiceResaltado;

                        return (
                          <div
                            key={`prod-${prod.id_producto}`}
                            id={`prod-${prod.id_producto}`}
                            role="option"
                            aria-selected={resaltado}
                            onMouseEnter={() => setIndiceResaltado(idxGlobal)}
                            onClick={() => seleccionarItem({ tipo: 'producto', datos: prod })}
                            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors cursor-pointer select-none ${
                              resaltado
                                ? 'bg-white/10 text-white'
                                : 'text-slate-200 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-800/80 border border-white/10 flex items-center justify-center overflow-hidden">
                              {prod.imagen ? (
                                <img
                                  src={`/uploads/productos/${prod.imagen}`}
                                  alt=""
                                  className="h-full w-full object-contain p-0.5"
                                />
                              ) : (
                                <Package size={18} className="text-slate-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 pr-2">
                              <p className="text-sm font-semibold truncate text-white">
                                <TextoResaltado texto={prod.nombre} termino={qLimpia} />
                              </p>
                              <p className="text-xs text-slate-400 truncate">
                                {[prod.marca, prod.modelo, prod.empresa]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-sm font-bold text-cyan-300">
                                Bs {Number(prod.precio).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* SECCIÓN 2: MARCAS */}
                {sugerencias.marcas?.length > 0 && (
                  <div className="py-2">
                    <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Tag size={13} className="text-cyan-400" aria-hidden="true" />
                      <span>Marcas</span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {sugerencias.marcas.map((m) => {
                        const idxGlobal = itemsAplanados.findIndex(
                          (it) => it.id === `marca-${m.marca}`
                        );
                        const resaltado = idxGlobal === indiceResaltado;

                        return (
                          <div
                            key={`marca-${m.marca}`}
                            id={`marca-${m.marca}`}
                            role="option"
                            aria-selected={resaltado}
                            onMouseEnter={() => setIndiceResaltado(idxGlobal)}
                            onClick={() => seleccionarItem({ tipo: 'marca', datos: m })}
                            className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-sm transition-colors cursor-pointer select-none ${
                              resaltado
                                ? 'bg-white/10 text-white'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <Tag size={14} className="text-slate-400 shrink-0" />
                              <TextoResaltado texto={m.marca} termino={qLimpia} />
                            </span>
                            <span className="text-xs text-cyan-400/80 font-medium">
                              Filtrar por marca
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* SECCIÓN 3: MODELOS */}
                {sugerencias.modelos?.length > 0 && (
                  <div className="py-2">
                    <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Cpu size={13} className="text-cyan-400" aria-hidden="true" />
                      <span>Modelos</span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {sugerencias.modelos.map((mdl) => {
                        const idxGlobal = itemsAplanados.findIndex(
                          (it) => it.id === `mdl-${mdl.modelo}-${mdl.marca}`
                        );
                        const resaltado = idxGlobal === indiceResaltado;

                        return (
                          <div
                            key={`mdl-${mdl.modelo}-${mdl.marca}`}
                            id={`mdl-${mdl.modelo}-${mdl.marca}`}
                            role="option"
                            aria-selected={resaltado}
                            onMouseEnter={() => setIndiceResaltado(idxGlobal)}
                            onClick={() => seleccionarItem({ tipo: 'modelo', datos: mdl })}
                            className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-sm transition-colors cursor-pointer select-none ${
                              resaltado
                                ? 'bg-white/10 text-white'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <Cpu size={14} className="text-slate-400 shrink-0" />
                              <span className="truncate">
                                <TextoResaltado texto={mdl.modelo} termino={qLimpia} />
                                {mdl.marca && (
                                  <span className="text-xs text-slate-400 ml-1.5">
                                    ({mdl.marca})
                                  </span>
                                )}
                              </span>
                            </span>
                            <ArrowRight size={13} className="text-slate-500 shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* SECCIÓN 4: CATEGORÍAS */}
                {sugerencias.categorias?.length > 0 && (
                  <div className="py-2">
                    <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <LayoutGrid size={13} className="text-cyan-400" aria-hidden="true" />
                      <span>Categorías</span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {sugerencias.categorias.map((cat) => {
                        const idxGlobal = itemsAplanados.findIndex(
                          (it) => it.id === `cat-${cat.id_categoria}`
                        );
                        const resaltado = idxGlobal === indiceResaltado;

                        return (
                          <div
                            key={`cat-${cat.id_categoria}`}
                            id={`cat-${cat.id_categoria}`}
                            role="option"
                            aria-selected={resaltado}
                            onMouseEnter={() => setIndiceResaltado(idxGlobal)}
                            onClick={() => seleccionarItem({ tipo: 'categoria', datos: cat })}
                            className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-sm transition-colors cursor-pointer select-none ${
                              resaltado
                                ? 'bg-white/10 text-white'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <LayoutGrid size={14} className="text-slate-400 shrink-0" />
                              <TextoResaltado texto={cat.nombre} termino={qLimpia} />
                            </span>
                            <span className="text-xs text-cyan-400/80 font-medium">
                              Explorar categoría
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* SECCIÓN 5: EMPRESAS */}
                {sugerencias.empresas?.length > 0 && (
                  <div className="py-2">
                    <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Store size={13} className="text-cyan-400" aria-hidden="true" />
                      <span>Empresas Verificadas</span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {sugerencias.empresas.map((emp) => {
                        const idxGlobal = itemsAplanados.findIndex(
                          (it) => it.id === `emp-${emp.id_empresa}`
                        );
                        const resaltado = idxGlobal === indiceResaltado;

                        return (
                          <div
                            key={`emp-${emp.id_empresa}`}
                            id={`emp-${emp.id_empresa}`}
                            role="option"
                            aria-selected={resaltado}
                            onMouseEnter={() => setIndiceResaltado(idxGlobal)}
                            onClick={() => seleccionarItem({ tipo: 'empresa', datos: emp })}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors cursor-pointer select-none ${
                              resaltado
                                ? 'bg-white/10 text-white'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <Store size={15} className="text-slate-400 shrink-0" />
                              <TextoResaltado texto={emp.razon_social} termino={qLimpia} />
                              <BadgeCheck size={14} className="text-emerald-400 shrink-0" />
                            </span>
                            <span className="text-xs text-slate-400">Ver portal</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ESTADO 3: Sin sugerencias para la búsqueda actual */}
            {qLimpia.length >= 2 && !cargando && !haySugerencias && (
              <div className="px-4 py-4 text-center text-sm text-slate-300">
                <p>No encontramos sugerencias directas para «{qLimpia}».</p>
                <p className="text-xs text-slate-400 mt-1">
                  Presiona <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-200">Enter</kbd> o el botón Buscar para ver el catálogo completo.
                </p>
              </div>
            )}

            {/* FILA FIJA FINAL: Ver todos los resultados para «texto» */}
            {qLimpia.length >= 2 && (
              <div className="pt-2 pb-1">
                {(() => {
                  const idxGlobal = itemsAplanados.findIndex((it) => it.id === 'todos-resultados');
                  const resaltado = idxGlobal === indiceResaltado;

                  return (
                    <div
                      id="todos-resultados"
                      role="option"
                      aria-selected={resaltado}
                      onMouseEnter={() => setIndiceResaltado(idxGlobal)}
                      onClick={() => ejecutarBusqueda(qLimpia)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer select-none ${
                        resaltado
                          ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400'
                          : 'text-cyan-300 hover:bg-white/10'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Search size={16} className="text-cyan-400 shrink-0" />
                        <span className="truncate">
                          Ver todos los resultados para «<strong>{qLimpia}</strong>»
                        </span>
                      </span>
                      <ArrowRight size={16} className="text-cyan-400 shrink-0" />
                    </div>
                  );
                })()}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

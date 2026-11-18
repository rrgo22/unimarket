import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  Store,
  BadgeCheck,
  Search,
  Package,
  PackageOpen,
  ArrowRight,
  Laptop,
  Shirt,
  Home,
  UtensilsCrossed,
  Wrench,
  PenLine,
  Sparkles,
  Dumbbell,
  Tag,
  Loader2,
  X,
} from 'lucide-react';
import { api, bs, imgUrl, empImgUrl } from '../api.js';
import Modal from './Modal.jsx';

export function obtenerIconoCategoria(nombre = '') {
  const n = String(nombre).toLowerCase().trim();
  if (n.includes('electrónica') || n.includes('electronica')) return Laptop;
  if (n.includes('ropa') || n.includes('calzado') || n.includes('moda')) return Shirt;
  if (n.includes('hogar')) return Home;
  if (n.includes('alimento') || n.includes('bebida')) return UtensilsCrossed;
  if (n.includes('herramienta')) return Wrench;
  if (n.includes('papelería') || n.includes('papeleria')) return PenLine;
  if (n.includes('salud') || n.includes('belleza')) return Sparkles;
  if (n.includes('deporte')) return Dumbbell;
  return Tag;
}

export default function MenuExplorar({ esBotonMovil = false, onNavegarMovil, esOscuro = true }) {
  const [abierto, setAbierto] = useState(false);
  const [pestana, setPestana] = useState('categorias'); // 'categorias' | 'empresas'
  const [categorias, setCategorias] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [cargandoDatos, setCargandoDatos] = useState(false);

  // Detección de tamaño de pantalla (< 1024px móvil y tablet)
  const [esPantallaPequena, setEsPantallaPequena] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );
  const [headerBottom, setHeaderBottom] = useState(64);

  // Categoría activa en mega menú de escritorio
  const [catSeleccionada, setCatSeleccionada] = useState(null); // id_categoria o null ("Todas")
  const [resumenActivo, setResumenActivo] = useState(null);
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const cacheResumenes = useRef(new Map());

  // Búsqueda en pestaña empresas
  const [busquedaEmpresas, setBusquedaEmpresas] = useState('');

  // Acordeón para móvil
  const [acordeonMovil, setAcordeonMovil] = useState(null);
  const [resumenMovil, setResumenMovil] = useState({});
  const [cargandoResumenMovil, setCargandoResumenMovil] = useState(false);

  const contenedorRef = useRef(null);
  const botonRef = useRef(null);
  const nav = useNavigate();

  // Escuchar redimensionamiento de ventana
  useEffect(() => {
    const handleResize = () => {
      const pequenia = window.innerWidth < 1024;
      setEsPantallaPequena(pequenia);

      const header = document.querySelector('header');
      if (header) {
        setHeaderBottom(header.getBoundingClientRect().bottom);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calcular la posición exacta inferior de la Navbar al abrir
  useEffect(() => {
    if (abierto) {
      const header = document.querySelector('header');
      if (header) {
        setHeaderBottom(header.getBoundingClientRect().bottom);
      }
    }
  }, [abierto]);

  // Cargar datos únicamente la primera vez que se abre el menú
  const datosCargadosRef = useRef(false);
  const cargarDatosIniciales = useCallback(async () => {
    if (datosCargadosRef.current) return;
    setCargandoDatos(true);
    try {
      const [catsRes, empsRes] = await Promise.all([
        api('/publico/categorias').catch(() => []),
        api('/publico/empresas?limite=30').catch(() => ({ empresas: [] })),
      ]);

      // Ordenar categorías: primero las que tienen productos (de mayor a menor), luego las vacías
      const catsOrdenadas = (catsRes || []).slice().sort((a, b) => {
        const prodA = a.total_productos || a.productos || 0;
        const prodB = b.total_productos || b.productos || 0;
        if (prodA > 0 && prodB === 0) return -1;
        if (prodA === 0 && prodB > 0) return 1;
        return prodB - prodA;
      });

      setCategorias(catsOrdenadas);
      setEmpresas(Array.isArray(empsRes) ? empsRes : empsRes.empresas || []);
      datosCargadosRef.current = true;

      // Seleccionar por defecto la primera categoría con productos
      const primeraConProds = catsOrdenadas.find(
        (c) => (c.total_productos || c.productos || 0) > 0
      );
      if (primeraConProds) {
        setCatSeleccionada(primeraConProds.id_categoria);
      } else if (catsOrdenadas.length > 0) {
        setCatSeleccionada(catsOrdenadas[0].id_categoria);
      }
    } catch {
      // Ignorar error de red
    } finally {
      setCargandoDatos(false);
    }
  }, []);

  const toggleMenu = () => {
    if (!abierto) {
      cargarDatosIniciales();
    }
    setAbierto(!abierto);
  };

  const cerrarMenu = useCallback(() => {
    setAbierto(false);
    onNavegarMovil?.();
  }, [onNavegarMovil]);

  // Cerrar al hacer clic fuera en escritorio
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(e.target) &&
        botonRef.current &&
        !botonRef.current.contains(e.target)
      ) {
        setAbierto(false);
      }
    };
    if (abierto && !esPantallaPequena) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [abierto, esPantallaPequena]);

  // Manejo de tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && abierto) {
        setAbierto(false);
        botonRef.current?.focus();
      }
    };
    if (abierto) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [abierto]);

  // Cargar resumen de categoría seleccionada en escritorio con caché
  const cargarResumen = useCallback(async (idCat) => {
    if (!idCat) {
      setResumenActivo(null);
      return;
    }
    if (cacheResumenes.current.has(idCat)) {
      setResumenActivo(cacheResumenes.current.get(idCat));
      return;
    }
    setCargandoResumen(true);
    try {
      const data = await api(`/publico/categorias/${idCat}/resumen`);
      cacheResumenes.current.set(idCat, data);
      setResumenActivo(data);
    } catch {
      setResumenActivo(null);
    } finally {
      setCargandoResumen(false);
    }
  }, []);

  useEffect(() => {
    if (abierto && catSeleccionada) {
      cargarResumen(catSeleccionada);
    }
  }, [abierto, catSeleccionada, cargarResumen]);

  // Cargar resumen para acordeón móvil
  const toggleAcordeonMovil = async (idCat) => {
    if (acordeonMovil === idCat) {
      setAcordeonMovil(null);
      return;
    }
    setAcordeonMovil(idCat);
    if (!resumenMovil[idCat]) {
      setCargandoResumenMovil(true);
      try {
        const data = await api(`/publico/categorias/${idCat}/resumen`);
        setResumenMovil((prev) => ({ ...prev, [idCat]: data }));
      } catch {
        // error silencioso
      } finally {
        setCargandoResumenMovil(false);
      }
    }
  };

  // Navegar a categoría en el catálogo
  const navegarCategoria = (idCat) => {
    cerrarMenu();
    if (idCat) {
      nav(`/catalogo?categoria=${idCat}`);
    } else {
      nav('/catalogo');
    }
  };

  const empresasFiltradas = empresas.filter((emp) =>
    emp.razon_social.toLowerCase().includes(busquedaEmpresas.toLowerCase())
  );

  // Categoría seleccionada actual
  const objCatSeleccionada = categorias.find((c) => c.id_categoria === catSeleccionada);
  const totalProdsCatSeleccionada =
    objCatSeleccionada?.total_productos || objCatSeleccionada?.productos || 0;
  const esCategoriaVacia = catSeleccionada !== null && totalProdsCatSeleccionada === 0;

  // Botón especial cuando se invoca desde el interior del cajón móvil de App.jsx
  if (esBotonMovil) {
    return (
      <button
        type="button"
        onClick={() => {
          cargarDatosIniciales();
          setAbierto(true);
        }}
        className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-200 bg-white/10 hover:bg-white/15 border border-white/15 active:bg-white/20 transition-colors min-h-[44px]"
        aria-expanded={abierto}
        aria-label="Abrir explorador de categorías y empresas"
      >
        <div className="flex items-center gap-3">
          <LayoutGrid size={18} className="text-cyan-300" aria-hidden="true" />
          <span className="font-bold text-white">Explorar por categoría y empresa</span>
        </div>
        <ChevronRight size={18} className="text-cyan-300" aria-hidden="true" />
      </button>
    );
  }

  return (
    <>
      {/* Botón Explorar en la Navbar */}
      <button
        ref={botonRef}
        type="button"
        onClick={toggleMenu}
        aria-expanded={abierto}
        aria-haspopup="menu"
        aria-controls="menu-explorar-panel"
        className={`!px-3.5 !py-2 flex items-center gap-2 text-sm font-medium rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
          abierto
            ? '!bg-white/15 text-cyan-300 font-semibold'
            : 'text-slate-200 hover:bg-white/10 hover:text-white'
        }`}
      >
        <LayoutGrid
          size={16}
          strokeWidth={2}
          className={abierto ? 'text-cyan-300' : 'text-cyan-300'}
          aria-hidden="true"
        />
        <span>Explorar</span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`transition-transform duration-200 ${
            abierto ? 'rotate-180 text-cyan-300' : 'text-slate-300'
          }`}
          aria-hidden="true"
        />
      </button>

      {/* CASO A: Mega Menú para Escritorio (>= 1024 px) con Portal en document.body */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {abierto && !esPantallaPequena && (
              <div
                className="fixed inset-x-0 z-40 pointer-events-none"
                style={{ top: `${headerBottom}px` }}
              >
                {/* Telón de fondo semitransparente para cerrar al hacer clic fuera */}
                <div
                  className="fixed inset-0 bg-[#070F2B]/60 backdrop-blur-xs pointer-events-auto transition-opacity"
                  style={{ top: `${headerBottom}px` }}
                  onClick={() => setAbierto(false)}
                  aria-hidden="true"
                />

                {/* Contenedor exactamente centrado y con el mismo max-w y padding que la Navbar */}
                <div className="relative mx-auto max-w-6xl px-4 sm:px-6 w-full pointer-events-auto pt-2">
                  <motion.div
                    ref={contenedorRef}
                    id="menu-explorar-panel"
                    role="menu"
                    initial={{ opacity: 0, y: -6, scale: 0.995 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.995 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="w-full max-w-5xl mx-auto bg-[#0A1338]/95 backdrop-blur-xl rounded-2xl shadow-floating border border-white/10 overflow-hidden flex flex-col text-white"
                    style={{
                      maxHeight: `calc(100dvh - ${headerBottom}px - 20px)`,
                    }}
                  >
                    {/* Encabezado del panel: Pestañas a la izquierda */}
                    <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-6 py-2.5 shrink-0">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setPestana('categorias')}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            pestana === 'categorias'
                              ? 'btn-cta !px-3.5 !py-1.5 !text-xs !shadow-xs'
                              : 'text-slate-300 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          Por categoría
                        </button>
                        <button
                          type="button"
                          onClick={() => setPestana('empresas')}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            pestana === 'empresas'
                              ? 'btn-cta !px-3.5 !py-1.5 !text-xs !shadow-xs'
                              : 'text-slate-300 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          Empresas
                        </button>
                      </div>

                      <span className="hidden xl:inline text-[11px] text-slate-400 font-medium">
                        Catálogo multiempresa verificado
                      </span>
                    </div>

                    {/* Cuerpo del Mega Menú con Scroll Interno */}
                    <div className="overflow-y-auto flex-1 min-h-0">
                      {cargandoDatos ? (
                        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                          <Loader2 size={28} className="animate-spin text-cyan-300" aria-hidden="true" />
                          <p className="text-xs">Cargando directorio…</p>
                        </div>
                      ) : pestana === 'categorias' ? (
                        <div className="grid grid-cols-[290px_1fr] divide-x divide-white/10 min-h-[380px] max-h-[500px]">
                          {/* Columna Izquierda: Lista de Categorías */}
                          <div className="p-3 overflow-y-auto space-y-1">
                            <button
                              type="button"
                              onClick={() => navegarCategoria(null)}
                              onMouseEnter={() => setCatSeleccionada(null)}
                              onFocus={() => setCatSeleccionada(null)}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors text-left ${
                                catSeleccionada === null
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <Tag size={16} className="text-cyan-300" aria-hidden="true" />
                                <span>Todas las categorías</span>
                              </div>
                              <ArrowRight size={14} className="text-slate-400" />
                            </button>

                            <div className="h-px bg-white/10 my-1" />

                            {categorias.map((cat) => {
                              const Icono = obtenerIconoCategoria(cat.nombre);
                              const activo = catSeleccionada === cat.id_categoria;
                              const numProds = cat.total_productos || cat.productos || 0;
                              const esVacia = numProds === 0;

                              return (
                                <button
                                  key={cat.id_categoria}
                                  type="button"
                                  onClick={() => navegarCategoria(cat.id_categoria)}
                                  onMouseEnter={() => setCatSeleccionada(cat.id_categoria)}
                                  onFocus={() => setCatSeleccionada(cat.id_categoria)}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left ${
                                    activo
                                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 font-bold'
                                      : esVacia
                                      ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                                      : 'text-slate-300 hover:bg-white/[0.06] hover:text-white font-medium'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                    <Icono
                                      size={16}
                                      className={`shrink-0 ${
                                        activo
                                          ? 'text-cyan-300'
                                          : esVacia
                                          ? 'text-slate-500'
                                          : 'text-cyan-400/80'
                                      }`}
                                      aria-hidden="true"
                                    />
                                    <span className="truncate">{cat.nombre}</span>
                                  </div>
                                  <span
                                    className={`text-[11px] font-normal shrink-0 ${
                                      esVacia ? 'text-slate-500' : 'text-slate-400'
                                    }`}
                                  >
                                    ({numProds})
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Columna Derecha: Panel Flexible con min-w-0 */}
                          <div className="flex flex-col justify-between overflow-y-auto bg-white/[0.02] relative min-w-0">
                            {catSeleccionada === null ? (
                              /* Estado: Todas las Categorías */
                              <div className="p-6 flex flex-col justify-between h-full space-y-4">
                                <div className="space-y-4">
                                  <div>
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                                      Explorar catálogo completo
                                    </span>
                                    <h3 className="text-lg font-bold text-white mt-0.5">
                                      Todas las categorías de UNIMARKET BO
                                    </h3>
                                    <p className="text-xs text-slate-300 mt-1 max-w-md">
                                      Navega por todos los productos de empresas verificadas en Bolivia.
                                    </p>
                                  </div>

                                  <div>
                                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
                                      Tiendas oficiales destacadas
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2.5">
                                      {empresas.slice(0, 4).map((em) => (
                                        <Link
                                          key={em.id_empresa}
                                          to={`/tienda/${em.slug}`}
                                          onClick={cerrarMenu}
                                          className="flex items-center gap-2.5 p-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-cyan-400/40 transition-all min-w-0"
                                        >
                                          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 text-xs font-bold text-white overflow-hidden shrink-0 border border-white/20">
                                            {em.logo ? (
                                              <img
                                                src={empImgUrl(em.logo)}
                                                alt=""
                                                className="h-full w-full object-cover"
                                              />
                                            ) : (
                                              em.razon_social?.charAt(0)
                                            )}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-semibold text-white truncate">
                                              {em.razon_social}
                                            </p>
                                            <p className="text-[11px] text-slate-400">
                                              {em.productos || 0} productos
                                            </p>
                                          </div>
                                        </Link>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                <div className="sticky bottom-0 bg-[#0A1338]/95 backdrop-blur-xs pt-3 pb-2 border-t border-white/10 -mx-6 -mb-6 px-6">
                                  <button
                                    type="button"
                                    onClick={() => navegarCategoria(null)}
                                    className="btn-cta w-full justify-center !py-2.5 text-xs font-semibold shadow-xs"
                                  >
                                    <span>Ver todo el catálogo</span>
                                    <ArrowRight size={14} aria-hidden="true" />
                                  </button>
                                </div>
                              </div>
                            ) : cargandoResumen ? (
                              /* Estado: Cargando resumen */
                              <div className="p-8 flex flex-col items-center justify-center gap-2 text-slate-400 h-full">
                                <Loader2 size={24} className="animate-spin text-cyan-300" />
                                <p className="text-xs">Cargando destacados…</p>
                              </div>
                            ) : esCategoriaVacia ||
                              (!resumenActivo?.empresas?.length && !resumenActivo?.destacados?.length) ? (
                              /* Estado: Categoría vacía con PackageOpen */
                              <div className="p-6 flex flex-col justify-between h-full space-y-4">
                                <div>
                                  <div className="flex items-baseline justify-between border-b border-white/10 pb-3 gap-2">
                                    <div className="min-w-0 flex-1">
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 block">
                                        Rubro comercial
                                      </span>
                                      <h3 className="text-base font-bold text-white truncate">
                                        {objCatSeleccionada?.nombre || 'Categoría'}
                                      </h3>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-400 shrink-0 text-right whitespace-nowrap ml-2">
                                      0 productos
                                    </span>
                                  </div>

                                  <div className="flex flex-col items-center justify-center p-8 text-center text-slate-300 space-y-2.5 my-4">
                                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 border border-white/15 text-cyan-300 shadow-2xs">
                                      <PackageOpen size={28} strokeWidth={1.5} aria-hidden="true" />
                                    </div>
                                    <p className="text-sm font-semibold text-white">
                                      Aún no hay productos en esta categoría
                                    </p>
                                    <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                                      Las empresas verificadas aún no han publicado artículos en este rubro.
                                    </p>
                                  </div>
                                </div>

                                <div className="sticky bottom-0 bg-[#0A1338]/95 backdrop-blur-xs pt-3 pb-2 border-t border-white/10 -mx-6 -mb-6 px-6">
                                  <button
                                    type="button"
                                    onClick={() => navegarCategoria(null)}
                                    className="btn-light w-full justify-center !py-2.5 text-xs font-semibold"
                                  >
                                    <span>Ver todo el catálogo</span>
                                    <ArrowRight size={14} aria-hidden="true" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Estado: Categoría con contenido */
                              <div className="p-6 flex flex-col justify-between h-full space-y-4">
                                <div className="space-y-4">
                                  <div className="flex items-baseline justify-between border-b border-white/10 pb-3 gap-2">
                                    <div className="min-w-0 flex-1">
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 block">
                                        Rubro comercial
                                      </span>
                                      <h3 className="text-base font-bold text-white truncate">
                                        {resumenActivo?.categoria?.nombre ||
                                          objCatSeleccionada?.nombre ||
                                          'Categoría'}
                                      </h3>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-300 shrink-0 text-right whitespace-nowrap ml-2">
                                      {resumenActivo?.categoria?.total_productos ||
                                        totalProdsCatSeleccionada}{' '}
                                      producto(s)
                                    </span>
                                  </div>

                                  {/* Tiendas verificadas que venden en la categoría */}
                                  {resumenActivo?.empresas?.length > 0 && (
                                    <div>
                                      <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                                        Empresas verificadas en este rubro
                                      </h4>
                                      <div className="flex flex-wrap gap-2">
                                        {resumenActivo.empresas.map((em) => (
                                          <Link
                                            key={em.id_empresa}
                                            to={`/tienda/${em.slug}`}
                                            onClick={cerrarMenu}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-xs text-white shadow-2xs hover:border-cyan-400/40 hover:bg-white/[0.08] transition-colors"
                                          >
                                            <Store size={13} className="text-cyan-300" aria-hidden="true" />
                                            <span className="font-semibold truncate max-w-[130px]">
                                              {em.razon_social}
                                            </span>
                                            <span className="text-[11px] text-slate-400">
                                              ({em.productos_en_categoria})
                                            </span>
                                          </Link>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Productos destacados de esta categoría */}
                                  {resumenActivo?.destacados?.length > 0 && (
                                    <div>
                                      <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                                        Productos destacados
                                      </h4>
                                      <div className="grid grid-cols-2 gap-2.5">
                                        {resumenActivo.destacados.map((p) => (
                                          <div
                                            key={p.id_producto}
                                            onClick={() => navegarCategoria(catSeleccionada)}
                                            className="flex items-center gap-2.5 p-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-cyan-400/40 cursor-pointer shadow-2xs group min-w-0"
                                          >
                                            <div className="h-10 w-10 rounded-lg bg-white/10 overflow-hidden shrink-0 flex items-center justify-center border border-white/10">
                                              {p.imagen ? (
                                                <img
                                                  src={imgUrl(p.imagen)}
                                                  alt=""
                                                  className="h-full w-full object-contain p-0.5"
                                                />
                                              ) : (
                                                <Package size={18} className="text-slate-400" />
                                              )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <p className="text-xs font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">
                                                {p.nombre}
                                              </p>
                                              <p className="text-xs font-extrabold text-cyan-200 tracking-tight">
                                                {bs(p.precio)}
                                              </p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Botón ver todos los productos sticky al fondo */}
                                <div className="sticky bottom-0 bg-[#0A1338]/95 backdrop-blur-xs pt-3 pb-2 border-t border-white/10 -mx-6 -mb-6 px-6">
                                  <button
                                    type="button"
                                    onClick={() => navegarCategoria(catSeleccionada)}
                                    className="btn-cta w-full justify-center !py-2.5 text-xs font-semibold shadow-xs"
                                  >
                                    <span className="truncate">
                                      Ver todos los productos de{' '}
                                      {resumenActivo?.categoria?.nombre ||
                                        objCatSeleccionada?.nombre ||
                                        'esta categoría'}
                                    </span>
                                    <ArrowRight size={14} aria-hidden="true" className="shrink-0" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Pestaña de Empresas en Escritorio */
                        <div className="p-6 flex flex-col justify-between min-h-[380px]">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <h3 className="text-base font-bold text-white">
                                  Directorio de Empresas Verificadas
                                </h3>
                                <p className="text-xs text-slate-300">
                                  Empresas y marcas legales activas en Bolivia
                                </p>
                              </div>

                              <div className="relative w-64">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder="Buscar empresa…"
                                  value={busquedaEmpresas}
                                  onChange={(e) => setBusquedaEmpresas(e.target.value)}
                                  className="input text-xs pl-8 w-full !py-1.5"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1">
                              {empresasFiltradas.length > 0 ? (
                                empresasFiltradas.map((em) => (
                                  <Link
                                    key={em.id_empresa}
                                    to={`/tienda/${em.slug}`}
                                    onClick={cerrarMenu}
                                    className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-cyan-400/40 transition-all group min-w-0"
                                  >
                                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 text-xs font-bold text-white overflow-hidden shrink-0 border border-white/20">
                                      {em.logo ? (
                                        <img src={empImgUrl(em.logo)} alt="" className="h-full w-full object-cover" />
                                      ) : (
                                        em.razon_social?.charAt(0)
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-bold text-white group-hover:text-cyan-300 truncate flex items-center gap-1">
                                        <span className="truncate">{em.razon_social}</span>
                                        <BadgeCheck size={13} className="text-emerald-400 shrink-0" />
                                      </p>
                                      <p className="text-[11px] text-slate-300 mt-0.5">
                                        {em.productos || 0} producto(s)
                                      </p>
                                    </div>
                                  </Link>
                                ))
                              ) : (
                                <p className="col-span-3 text-xs text-slate-400 py-12 text-center">
                                  No se encontraron empresas con ese término.
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                            <span className="text-xs text-slate-300">
                              {empresas.length} empresa(s) verificada(s) disponibles
                            </span>
                            <Link
                              to="/empresas"
                              onClick={cerrarMenu}
                              className="btn-light !py-2 !px-4 text-xs font-semibold"
                            >
                              <span>Ver todas las empresas</span>
                              <ArrowRight size={13} aria-hidden="true" />
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* CASO B: Cajón para Móvil y Tablet (< 1024px) */}
      <Modal
        abierto={abierto && esPantallaPequena}
        onCerrar={cerrarMenu}
        maxWidth="max-w-lg"
        ariaLabelledBy="menu-explorar-movil-titulo"
        headerPersonalizado={
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-[#0E1A44]">
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <LayoutGrid size={20} className="text-cyan-300" aria-hidden="true" />
              <span id="menu-explorar-movil-titulo">Explorar UNIMARKET BO</span>
            </div>
            <button
              type="button"
              onClick={cerrarMenu}
              className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Cerrar explorador"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        }
      >
        {/* Pestañas móvil */}
        <div className="flex border-b border-white/10 mb-4 shrink-0">
          <button
            type="button"
            onClick={() => setPestana('categorias')}
            className={`flex-1 py-3 text-center text-sm font-bold min-h-[44px] transition-colors border-b-2 -mb-px ${
              pestana === 'categorias'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Por categoría
          </button>
          <button
            type="button"
            onClick={() => setPestana('empresas')}
            className={`flex-1 py-3 text-center text-sm font-bold min-h-[44px] transition-colors border-b-2 -mb-px ${
              pestana === 'empresas'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Empresas
          </button>
        </div>

        {cargandoDatos ? (
          <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 size={24} className="animate-spin text-cyan-300" aria-hidden="true" />
            <p className="text-xs">Cargando categorías y tiendas…</p>
          </div>
        ) : pestana === 'categorias' ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => navegarCategoria(null)}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.05] font-bold text-white text-sm min-h-[44px] active:bg-white/10 hover:border-cyan-400/40 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Tag size={18} className="text-cyan-300" aria-hidden="true" />
                <span>Ver todas las categorías</span>
              </div>
              <ArrowRight size={16} className="text-slate-400" aria-hidden="true" />
            </button>

            {categorias.map((cat) => {
              const Icono = obtenerIconoCategoria(cat.nombre);
              const desplegado = acordeonMovil === cat.id_categoria;
              const resumen = resumenMovil[cat.id_categoria];
              const numProds = cat.total_productos || cat.productos || 0;
              const esVacia = numProds === 0;

              return (
                <div
                  key={cat.id_categoria}
                  className={`border border-white/10 rounded-xl overflow-hidden bg-white/[0.04] ${
                    esVacia ? 'opacity-60' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleAcordeonMovil(cat.id_categoria)}
                    className="w-full flex items-center justify-between p-3.5 text-left text-sm font-semibold text-white min-h-[44px] hover:bg-white/[0.06] transition-colors"
                    aria-expanded={desplegado}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <Icono
                        size={18}
                        className={`shrink-0 ${esVacia ? 'text-slate-500' : 'text-cyan-300'}`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{cat.nombre}</span>
                      <span className="text-xs font-normal text-slate-400 shrink-0">
                        ({numProds})
                      </span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-slate-400 transition-transform ${
                        desplegado ? 'rotate-180 text-cyan-300' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {desplegado && (
                    <div className="p-3.5 bg-white/[0.02] border-t border-white/10 space-y-3">
                      {cargandoResumenMovil && !resumen ? (
                        <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                          <Loader2 size={14} className="animate-spin text-cyan-300" />
                          <span>Cargando tiendas…</span>
                        </div>
                      ) : esVacia ||
                        (!resumen?.empresas?.length && !resumen?.destacados?.length) ? (
                        <div className="py-3 text-center space-y-1.5">
                          <PackageOpen size={24} className="mx-auto text-slate-400" />
                          <p className="text-xs font-semibold text-slate-300">
                            Aún no hay productos en esta categoría
                          </p>
                          <button
                            type="button"
                            onClick={() => navegarCategoria(null)}
                            className="btn-light w-full justify-center !py-2.5 text-xs font-semibold min-h-[44px] mt-2"
                          >
                            <span>Ver todo el catálogo</span>
                            <ArrowRight size={14} aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <>
                          {resumen?.empresas?.length > 0 && (
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-2">
                                Tiendas en este rubro
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {resumen.empresas.map((em) => (
                                  <Link
                                    key={em.id_empresa}
                                    to={`/tienda/${em.slug}`}
                                    onClick={cerrarMenu}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-xs text-white shadow-2xs hover:border-cyan-400/40 min-h-[44px]"
                                  >
                                    <Store size={13} className="text-cyan-300" aria-hidden="true" />
                                    <span className="font-medium truncate max-w-[140px]">
                                      {em.razon_social}
                                    </span>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => navegarCategoria(cat.id_categoria)}
                            className="btn-cta w-full justify-center !py-2.5 text-xs font-semibold min-h-[44px]"
                          >
                            <span>Ver todos los productos de {cat.nombre}</span>
                            <ArrowRight size={14} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar empresa verificada…"
                value={busquedaEmpresas}
                onChange={(e) => setBusquedaEmpresas(e.target.value)}
                className="input text-sm pl-9 w-full min-h-[44px]"
              />
            </div>

            <div className="divide-y divide-white/10 max-h-[50dvh] overflow-y-auto">
              {empresasFiltradas.length > 0 ? (
                empresasFiltradas.map((emp) => (
                  <Link
                    key={emp.id_empresa}
                    to={`/tienda/${emp.slug}`}
                    onClick={cerrarMenu}
                    className="flex items-center justify-between py-3 px-1 hover:bg-white/[0.05] min-h-[44px] rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 border border-white/20 text-xs font-bold text-white overflow-hidden">
                        {emp.logo ? (
                          <img src={empImgUrl(emp.logo)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          emp.razon_social?.charAt(0)
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate flex items-center gap-1">
                          <span>{emp.razon_social}</span>
                          <BadgeCheck size={14} className="text-emerald-400 shrink-0" />
                        </p>
                        <p className="text-xs text-slate-300">
                          {emp.productos || 0} producto(s)
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400 shrink-0" />
                  </Link>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No se encontraron empresas con ese nombre.
                </p>
              )}
            </div>

            <Link
              to="/empresas"
              onClick={cerrarMenu}
              className="btn-light w-full justify-center !py-2.5 text-xs font-semibold min-h-[44px]"
            >
              <span>Ver todas las empresas</span>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        )}
      </Modal>
    </>
  );
}

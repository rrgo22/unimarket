import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Search,
  Sparkles,
  ShieldCheck,
  MessageCircle,
  ArrowRight,
  ShoppingBag,
  Store,
  Package,
  Laptop,
  Shirt,
  Home,
  UtensilsCrossed,
  Wrench,
  BookOpen,
  Heart,
  Dumbbell,
  Gamepad2,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { api } from '../api.js';
import HeroFondo from '../components/HeroFondo.jsx';
import ContadorAnimado from '../components/ContadorAnimado.jsx';
import TituloSeccion from '../components/TituloSeccion.jsx';
import BuscadorAvanzado from '../components/BuscadorAvanzado.jsx';

const PALABRAS_ROTATORIAS = [
  'deportes',
  'electrónica',
  'herramientas',
  'hogar',
  'juegos',
  'tecnología',
];

// Asignación de iconos temáticos por categoría
function obtenerIconoCategoria(nombre) {
  const n = String(nombre || '').toLowerCase();
  if (n.includes('electr') || n.includes('tecno') || n.includes('comput')) return Laptop;
  if (n.includes('ropa') || n.includes('calzado') || n.includes('moda')) return Shirt;
  if (n.includes('hogar') || n.includes('mueble')) return Home;
  if (n.includes('alimento') || n.includes('bebida')) return UtensilsCrossed;
  if (n.includes('herramienta') || n.includes('ferret')) return Wrench;
  if (n.includes('papel') || n.includes('libr')) return BookOpen;
  if (n.includes('salud') || n.includes('belleza')) return Heart;
  if (n.includes('deporte')) return Dumbbell;
  if (n.includes('juego') || n.includes('game') || n.includes('gamer') || n.includes('juguete')) return Gamepad2;
  return Package;
}

export default function Inicio() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  const [cats, setCats] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [errorEstadisticas, setErrorEstadisticas] = useState(false);
  const [cargandoEstadisticas, setCargandoEstadisticas] = useState(true);
  const [indicePalabra, setIndicePalabra] = useState(0);

  // Redireccionar si el usuario entra a / con parámetros antiguos del catálogo o hash #catalogo
  useEffect(() => {
    const paramsAntiguos = ['q', 'categoria', 'marca', 'min', 'max', 'disponible', 'orden', 'pagina', 'producto'];
    const tieneParams = paramsAntiguos.some((p) => searchParams.has(p));
    if (tieneParams) {
      nav(`/catalogo?${searchParams.toString()}`, { replace: true });
      return;
    }
    if (location.hash === '#catalogo') {
      nav('/catalogo', { replace: true });
    }
  }, [searchParams, location.hash, nav]);

  // Rotación de palabras del Hero cada 2.5s
  useEffect(() => {
    if (shouldReduceMotion) return;
    const interval = setInterval(() => {
      if (!document.hidden) {
        setIndicePalabra((prev) => (prev + 1) % PALABRAS_ROTATORIAS.length);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [shouldReduceMotion]);

  // Cargar categorías y estadísticas en vivo (al montar, al recuperar foco y cada 30 segundos)
  const cargarEstadisticas = () => {
    api('/publico/estadisticas')
      .then((datos) => {
        if (datos && typeof datos.empresas === 'number') {
          setEstadisticas(datos);
          setErrorEstadisticas(false);
        }
      })
      .catch(() => {
        setErrorEstadisticas(true);
      })
      .finally(() => {
        setCargandoEstadisticas(false);
      });
  };

  useEffect(() => {
    let activo = true;

    const cargarCategorias = () => {
      api('/publico/categorias')
        .then((res) => {
          if (activo) setCats(Array.isArray(res) ? res : []);
        })
        .catch(() => {});
    };

    cargarCategorias();
    cargarEstadisticas();

    // Polling cada 30 segundos
    const intervalo = setInterval(() => {
      if (!document.hidden) {
        cargarEstadisticas();
      }
    }, 30000);

    // Refetch al recuperar el foco (tab / ventana)
    const alCambiarVisibilidad = () => {
      if (!document.hidden) {
        cargarEstadisticas();
      }
    };
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    window.addEventListener('focus', alCambiarVisibilidad);

    return () => {
      activo = false;
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      window.removeEventListener('focus', alCambiarVisibilidad);
    };
  }, []);

  const palabraActual = shouldReduceMotion
    ? 'lo que necesitas'
    : PALABRAS_ROTATORIAS[indicePalabra] || PALABRAS_ROTATORIAS[0];

  // Solo categorías con productos visibles (> 0)
  const categoriasVisibles = cats.filter(
    (c) => (c.total_productos || c.productos || 0) > 0
  );

  return (
    <div className="w-full">
      {/* =========================================================================
          1. HERO DE BIENVENIDA (CENTRADO, AURORA, BUSCADOR AVANZADO Y MÉTRICAS)
         ========================================================================= */}
      <section className="relative w-full overflow-hidden bg-gradient-to-b from-[#0B1437] via-[#091133] to-[#070F2B] text-white pt-24 sm:pt-28 pb-16 sm:pb-24">
        {/* Fondo interactivo con aurora y partículas */}
        <HeroFondo />

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 w-full text-center space-y-7">
          {/* Titular grande y dinámico */}
          <h1
            aria-label="Encuentra lo que necesitas en un solo lugar"
            className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.2] text-white"
          >
            Encuentra{' '}
            <span className="inline-block relative min-w-[190px] sm:min-w-[280px] text-center align-baseline py-1">
              <AnimatePresence mode="wait">
                <motion.span
                  key={palabraActual}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="inline-block bg-gradient-to-r from-[#22D3EE] via-indigo-300 to-[#A78BFA] bg-clip-text text-transparent font-black px-1.5 pt-1 pb-2 sm:pb-3 -mb-2 sm:-mb-3"
                >
                  {palabraActual}
                </motion.span>
              </AnimatePresence>
            </span>{' '}
            <br className="hidden sm:inline" />
            en un solo lugar
          </h1>

          {/* Subtítulo */}
          <p className="text-sm sm:text-base lg:text-lg text-slate-200/90 leading-relaxed max-w-2xl mx-auto">
            Catálogos digitales de empresas bolivianas verificadas. Compara precios y contacta directo
            por WhatsApp sin intermediarios ni comisiones.
          </p>

          {/* Buscador Avanzado tipo píldora con autocompletado inteligente */}
          <div className="pt-2 max-w-3xl mx-auto">
            <BuscadorAvanzado
              placeholder="Buscar productos, marcas, modelos o empresas bolivianas…"
              tamano="lg"
              onSearch={(termino) => {
                nav(termino ? `/catalogo?q=${encodeURIComponent(termino)}` : '/catalogo');
              }}
            />
          </div>

          {/* Botones de acción principales */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
            <Link
              to="/catalogo"
              className="btn-cta !px-7 !py-3 text-sm font-bold shadow-md flex items-center gap-2 rounded-xl"
            >
              <ShoppingBag size={17} strokeWidth={2.2} aria-hidden="true" />
              <span>Ver el catálogo</span>
              <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
            </Link>

            <Link
              to="/planes"
              className="btn-light !px-6 !py-3 text-sm font-semibold rounded-xl flex items-center gap-2"
            >
              <Store size={17} className="text-cyan-400" aria-hidden="true" />
              <span>Registrar mi empresa</span>
            </Link>
          </div>

          {/* Métricas Reales Públicas */}
          <div className="pt-6 sm:pt-8 border-t border-white/10 max-w-2xl mx-auto">
            {errorEstadisticas && !estadisticas ? (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-center gap-3 p-3 sm:p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] text-amber-200 text-xs sm:text-sm text-center"
              >
                <AlertTriangle size={16} className="text-amber-400 shrink-0" aria-hidden="true" />
                <span>No se pudieron sincronizar las estadísticas en tiempo real.</span>
                <button
                  type="button"
                  onClick={() => {
                    setCargandoEstadisticas(true);
                    setErrorEstadisticas(false);
                    cargarEstadisticas();
                  }}
                  className="btn-light !px-3 !py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all"
                >
                  <RotateCw size={12} className="shrink-0" />
                  <span>Reintentar</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:gap-6">
                <div className="text-center p-2 rounded-xl bg-white/[0.02]">
                  <div className="text-xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center justify-center min-h-[2rem]">
                    {estadisticas ? (
                      <ContadorAnimado valor={estadisticas.empresas} />
                    ) : (
                      <div className="h-7 w-12 rounded-md bg-white/10 animate-pulse" />
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-300 font-medium mt-1">
                    Empresas verificadas
                  </p>
                </div>

                <div className="text-center p-2 rounded-xl bg-white/[0.02]">
                  <div className="text-xl sm:text-3xl font-extrabold text-cyan-400 tracking-tight flex items-center justify-center min-h-[2rem]">
                    {estadisticas ? (
                      <ContadorAnimado valor={estadisticas.productos} />
                    ) : (
                      <div className="h-7 w-12 rounded-md bg-cyan-400/20 animate-pulse" />
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-300 font-medium mt-1">
                    Productos activos
                  </p>
                </div>

                <div className="text-center p-2 rounded-xl bg-white/[0.02]">
                  <div className="text-xl sm:text-3xl font-extrabold text-indigo-300 tracking-tight flex items-center justify-center min-h-[2rem]">
                    {estadisticas ? (
                      <ContadorAnimado valor={estadisticas.rubros ?? estadisticas.categorias} />
                    ) : (
                      <div className="h-7 w-12 rounded-md bg-indigo-400/20 animate-pulse" />
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-300 font-medium mt-1">
                    Rubros comerciales
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. SECCIÓN: EXPLORA POR CATEGORÍA (SOLO CATEGORÍAS CON > 0 PRODUCTOS)
         ========================================================================= */}
      {categoriasVisibles.length > 0 && (
        <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pt-12 sm:pt-16 pb-6 sm:pb-8">
          <TituloSeccion
            titulo="Explora por categoría"
            subtitulo="Accede directamente a los rubros comerciales con productos disponibles"
            enlaceTexto="Ver catálogo completo"
            enlaceTo="/catalogo"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-8">
            {categoriasVisibles.map((cat) => {
              const IconoComponente = obtenerIconoCategoria(cat.nombre);
              const cantidad = cat.total_productos || cat.productos || 0;

              return (
                <Link
                  key={cat.id_categoria}
                  to={`/catalogo?categoria=${cat.id_categoria}`}
                  className="group relative p-5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-cyan-400/40 hover:shadow-glow-cyan transition-all duration-200 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-400/30 text-cyan-300 group-hover:scale-105 transition-transform">
                      <IconoComponente size={22} strokeWidth={2} aria-hidden="true" />
                    </div>
                    <ArrowRight
                      size={16}
                      className="text-slate-500 group-hover:text-cyan-300 group-hover:translate-x-1 transition-all"
                      aria-hidden="true"
                    />
                  </div>

                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-cyan-200 transition-colors">
                      {cat.nombre}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {cantidad === 1 ? '1 producto disponible' : `${cantidad} productos disponibles`}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* =========================================================================
          3. SECCIÓN: CÓMO FUNCIONA (PARA VISITANTES EN 3 PASOS CON ICONOS)
         ========================================================================= */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pt-6 sm:pt-8 pb-14 sm:pb-20">
        <TituloSeccion
          titulo="Cómo funciona"
          subtitulo="Tres sencillos pasos para comprar o cotizar de forma directa y segura"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mt-10">
          {/* Paso 1 */}
          <div className="p-6 sm:p-7 rounded-2xl border border-white/10 bg-white/[0.03] space-y-4 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300">
                <Search size={26} strokeWidth={2} aria-hidden="true" />
              </div>
              <span className="text-3xl font-black text-white/10">01</span>
            </div>
            <h3 className="text-lg font-bold text-white">1. Busca lo que necesitas</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Explora el catálogo o usa el buscador inteligente con sugerencias de marcas y modelos para encontrar exactamente el artículo que buscas.
            </p>
          </div>

          {/* Paso 2 */}
          <div className="p-6 sm:p-7 rounded-2xl border border-white/10 bg-white/[0.03] space-y-4 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-500/15 border border-indigo-400/30 text-indigo-300">
                <ShieldCheck size={26} strokeWidth={2} aria-hidden="true" />
              </div>
              <span className="text-3xl font-black text-white/10">02</span>
            </div>
            <h3 className="text-lg font-bold text-white">2. Compara precios y empresas</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Visualiza precios reales, disponibilidad y detalles de empresas legalmente establecidas en Bolivia con NIT verificado por nuestra plataforma.
            </p>
          </div>

          {/* Paso 3 */}
          <div className="p-6 sm:p-7 rounded-2xl border border-white/10 bg-white/[0.03] space-y-4 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
                <MessageCircle size={26} strokeWidth={2} aria-hidden="true" />
              </div>
              <span className="text-3xl font-black text-white/10">03</span>
            </div>
            <h3 className="text-lg font-bold text-white">3. Contacta directo por WhatsApp</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Haz clic en el enlace oficial de WhatsApp del producto y comunícate de inmediato con el vendedor sin intermediarios ni comisiones extras.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. PANEL LLAMADA A LA ACCIÓN (CTA) PARA EMPRESAS CON BORDE DE DEGRADADO
         ========================================================================= */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20">
        <div className="relative rounded-3xl p-[1px] bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-600 shadow-2xl overflow-hidden">
          <div className="rounded-[23px] bg-[#0A1238]/95 p-8 sm:p-12 backdrop-blur-xl flex flex-col lg:flex-row items-center justify-between gap-8 text-center lg:text-left">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Sparkles size={13} aria-hidden="true" />
                <span>Para empresas bolivianas</span>
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                ¿Tienes una empresa? Publica tu catálogo y llega a más clientes
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Obtén tu propio portal comercial en UNIMARKET BO, verificación de NIT, posicionamiento digital y contacto directo por WhatsApp con clientes de todo el país.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full sm:w-auto">
              <Link
                to="/planes"
                className="btn-light w-full sm:w-auto !px-6 !py-3.5 text-sm font-semibold rounded-xl"
              >
                <span>Ver plan (Bs 200/mes)</span>
              </Link>

              <Link
                to="/registro"
                className="btn-cta w-full sm:w-auto !px-7 !py-3.5 text-sm font-bold shadow-lg rounded-xl flex items-center justify-center gap-2"
              >
                <span>Registrarse</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

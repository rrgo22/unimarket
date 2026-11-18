import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  SearchX,
  Tag,
  ArrowUpDown,
  Filter,
  Check,
  Package,
} from 'lucide-react';
import { api } from '../api.js';
import Encabezado from '../components/Encabezado.jsx';
import BuscadorAvanzado from '../components/BuscadorAvanzado.jsx';
import TarjetaProducto from '../components/TarjetaProducto.jsx';
import ModalDetalleProducto from '../components/ModalDetalleProducto.jsx';
import Modal from '../components/Modal.jsx';
import Select from '../components/Select.jsx';

function SkeletonCard() {
  return (
    <div className="card p-0 overflow-hidden flex flex-col justify-between animate-pulse">
      <div>
        <div className="aspect-[4/3] w-full bg-slate-800/60" />
        <div className="p-4 space-y-2.5">
          <div className="h-3 w-20 rounded bg-slate-800/80" />
          <div className="h-4 w-full rounded bg-slate-800/80" />
          <div className="h-4 w-3/4 rounded bg-slate-800/80" />
          <div className="h-3 w-1/2 rounded bg-slate-800/80 pt-1" />
        </div>
      </div>
      <div className="border-t border-white/5 px-4 py-3 flex items-center justify-between bg-white/[0.01]">
        <div className="h-5 w-20 rounded bg-slate-800/80" />
        <div className="h-7 w-16 rounded bg-slate-800/80" />
      </div>
    </div>
  );
}

export default function Catalogo() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Estados sincronizados con la URL
  const qParam = searchParams.get('q') || '';
  const catParam = searchParams.get('categoria') || '';
  const marcaParam = searchParams.get('marca') || '';
  const minParam = searchParams.get('min') || '';
  const maxParam = searchParams.get('max') || '';
  const dispParam = searchParams.get('disponible') || '';
  const ordenParam = searchParams.get('orden') || 'recientes';
  const pagParam = Math.max(1, parseInt(searchParams.get('pagina'), 10) || 1);
  const productoModalParam = searchParams.get('producto') || null;

  const [categorias, setCategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [data, setData] = useState({ productos: [], total: 0, pagina: 1, paginas: 1 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modalProductoId, setModalProductoId] = useState(productoModalParam);
  const [mostrarFiltrosMovil, setMostrarFiltrosMovil] = useState(false);

  // Sincronizar producto modal con la URL
  useEffect(() => {
    setModalProductoId(productoModalParam);
  }, [productoModalParam]);

  // Cargar categorías y marcas al montar
  useEffect(() => {
    api('/publico/categorias')
      .then((res) => setCategorias(Array.isArray(res) ? res : []))
      .catch(() => setCategorias([]));

    api('/publico/marcas')
      .then((res) => setMarcas(Array.isArray(res) ? res : []))
      .catch(() => setMarcas([]));
  }, []);

  // Función genérica para actualizar parámetros en la URL
  const actualizarParametros = useCallback(
    (cambios, resetearPagina = true) => {
      setSearchParams(
        (prev) => {
          const nuevo = new URLSearchParams(prev);
          Object.entries(cambios).forEach(([clave, valor]) => {
            if (valor === '' || valor === null || valor === undefined) {
              nuevo.delete(clave);
            } else {
              nuevo.set(clave, String(valor));
            }
          });
          if (resetearPagina && !('pagina' in cambios)) {
            nuevo.delete('pagina');
          }
          return nuevo;
        },
        { replace: false }
      );
    },
    [setSearchParams]
  );

  // Limpiar todos los filtros activos
  const limpiarTodosLosFiltros = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: false });
  }, [setSearchParams]);

  // Cargar productos con los parámetros de búsqueda actuales
  const consultarProductos = useCallback(async () => {
    setCargando(true);
    setError('');

    const qs = new URLSearchParams();
    if (qParam) qs.set('q', qParam);
    if (catParam) qs.set('categoria', catParam);
    if (marcaParam) qs.set('marca', marcaParam);
    if (minParam) qs.set('min', minParam);
    if (maxParam) qs.set('max', maxParam);
    if (dispParam) qs.set('disponible', dispParam);
    if (ordenParam) qs.set('orden', ordenParam);
    qs.set('pagina', String(pagParam));
    qs.set('limite', '12');

    try {
      const res = await api(`/publico/productos?${qs}`);
      setData(res);
    } catch (err) {
      setError(err.message || 'Error al cargar productos');
      setData({ productos: [], total: 0, pagina: 1, paginas: 1 });
    } finally {
      setCargando(false);
    }
  }, [qParam, catParam, marcaParam, minParam, maxParam, dispParam, ordenParam, pagParam]);

  useEffect(() => {
    const t = setTimeout(consultarProductos, 80);
    const alCambiarVisibilidad = () => {
      if (!document.hidden) consultarProductos();
    };
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    window.addEventListener('focus', alCambiarVisibilidad);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      window.removeEventListener('focus', alCambiarVisibilidad);
    };
  }, [consultarProductos]);

  // Opciones de categoría: Todas las categorías definidas por el administrador
  const opcionesCategorias = useMemo(() => {
    return [
      { value: '', label: 'Todas las categorías' },
      ...categorias.map((c) => ({
        value: String(c.id_categoria),
        label: `${c.nombre} (${c.total_productos || c.productos || 0})`,
      })),
    ];
  }, [categorias]);

  // Opciones de marca: marcas visibles con cantidad
  const opcionesMarcas = useMemo(() => {
    return [
      { value: '', label: 'Todas las marcas' },
      ...marcas.map((m) => ({
        value: m.marca,
        label: `${m.marca} (${m.total_productos})`,
      })),
    ];
  }, [marcas]);

  // Opciones de ordenamiento
  const opcionesOrden = [
    { value: 'recientes', label: 'Más recientes' },
    { value: 'precio_asc', label: 'Precio: Menor a Mayor' },
    { value: 'precio_desc', label: 'Precio: Mayor a Menor' },
    { value: 'nombre', label: 'Nombre A-Z' },
  ];

  // Opciones de disponibilidad
  const opcionesDisponibilidad = [
    { value: '', label: 'Todos los estados' },
    { value: 'true', label: 'Solo disponibles' },
    { value: 'false', label: 'Agotados' },
  ];

  // Identificar nombres de filtros activos para los chips
  const nombreCategoriaActiva = useMemo(() => {
    if (!catParam) return '';
    const encontrada = categorias.find((c) => String(c.id_categoria) === String(catParam));
    return encontrada ? encontrada.nombre : `Categoría #${catParam}`;
  }, [catParam, categorias]);

  const hayFiltrosActivos =
    Boolean(qParam) ||
    Boolean(catParam) ||
    Boolean(marcaParam) ||
    Boolean(minParam) ||
    Boolean(maxParam) ||
    Boolean(dispParam) ||
    ordenParam !== 'recientes';

  // Controles de filtros compartidos (Escritorio en barra lateral y Móvil en Modal)
  const ControlesFiltros = ({ esModal = false }) => (
    <div className="space-y-5">
      {/* 1. Categoría */}
      <div>
        <label className="label" htmlFor={esModal ? 'm-fil-cat' : 'd-fil-cat'}>
          Categoría
        </label>
        <Select
          id={esModal ? 'm-fil-cat' : 'd-fil-cat'}
          value={catParam}
          placeholder="Todas las categorías"
          ariaLabel="Filtrar por categoría"
          options={opcionesCategorias}
          onChange={(e) => actualizarParametros({ categoria: e.target.value })}
        />
      </div>

      {/* 2. Marca */}
      <div>
        <label className="label" htmlFor={esModal ? 'm-fil-marca' : 'd-fil-marca'}>
          Marca
        </label>
        <Select
          id={esModal ? 'm-fil-marca' : 'd-fil-marca'}
          value={marcaParam}
          placeholder="Todas las marcas"
          ariaLabel="Filtrar por marca"
          options={opcionesMarcas}
          onChange={(e) => actualizarParametros({ marca: e.target.value })}
        />
      </div>

      {/* 3. Rango de precio */}
      <div>
        <label className="label">Rango de precio (Bs)</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Mín"
            value={minParam}
            onChange={(e) => actualizarParametros({ min: e.target.value })}
            className="input text-sm"
            aria-label="Precio mínimo en bolivianos"
          />
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Máx"
            value={maxParam}
            onChange={(e) => actualizarParametros({ max: e.target.value })}
            className="input text-sm"
            aria-label="Precio máximo en bolivianos"
          />
        </div>
      </div>

      {/* 4. Disponibilidad */}
      <div>
        <label className="label" htmlFor={esModal ? 'm-fil-disp' : 'd-fil-disp'}>
          Disponibilidad
        </label>
        <Select
          id={esModal ? 'm-fil-disp' : 'd-fil-disp'}
          value={dispParam}
          placeholder="Todos los estados"
          ariaLabel="Filtrar por disponibilidad"
          options={opcionesDisponibilidad}
          onChange={(e) => actualizarParametros({ disponible: e.target.value })}
        />
      </div>

      {/* 5. Ordenar por */}
      <div>
        <label className="label" htmlFor={esModal ? 'm-fil-orden' : 'd-fil-orden'}>
          Ordenar por
        </label>
        <Select
          id={esModal ? 'm-fil-orden' : 'd-fil-orden'}
          value={ordenParam}
          placeholder="Más recientes"
          ariaLabel="Ordenar catálogo por"
          options={opcionesOrden}
          onChange={(e) => actualizarParametros({ orden: e.target.value })}
        />
      </div>

      {hayFiltrosActivos && (
        <button
          type="button"
          onClick={() => {
            limpiarTodosLosFiltros();
            if (esModal) setMostrarFiltrosMovil(false);
          }}
          className="btn-light w-full justify-center !py-2 text-xs font-semibold gap-1.5"
        >
          <RotateCcw size={13} aria-hidden="true" />
          <span>Limpiar todos los filtros</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="w-full">
      {/* Encabezado a pantalla completa igual que Empresas */}
      <Encabezado
        titulo="Catálogo de productos"
        subtitulo="Explora los productos de todas las empresas verificadas en Bolivia con garantía y contacto directo"
        migas={[{ etiqueta: 'Catálogo de productos' }]}
        icono={Package}
      />

      <div className="-mt-8 relative z-20 mx-auto max-w-6xl px-4 sm:px-6 pb-12 space-y-8">
        {/* Buscador Avanzado en píldora con autocompletado accesible */}
        <div className="w-full max-w-3xl mx-auto">
          <BuscadorAvanzado
            valorInicial={qParam}
            placeholder="Buscar por producto, marca, modelo o empresa…"
            tamano="md"
            onSearch={(termino) => actualizarParametros({ q: termino })}
          />
        </div>

      {/* Barra superior de estado: contador + botón filtros móvil + selector de orden rápido */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        {/* Contador de resultados */}
        <div className="flex items-center gap-2">
          {cargando ? (
            <div className="h-5 w-44 rounded bg-white/10 animate-pulse" />
          ) : (
            <p className="text-sm font-semibold text-slate-200">
              {data.total === 1 ? '1 producto encontrado' : `${data.total} productos encontrados`}
              {qParam && (
                <span className="text-slate-400 font-normal">
                  {' '}para «<strong className="text-white">{qParam}</strong>»
                </span>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Botón Filtros para móvil (< 1024px) */}
          <button
            type="button"
            onClick={() => setMostrarFiltrosMovil(true)}
            className="lg:hidden btn-light !px-3.5 !py-2 text-xs font-semibold flex items-center gap-2"
            aria-label="Abrir panel de filtros"
          >
            <SlidersHorizontal size={15} className="text-cyan-400" aria-hidden="true" />
            <span>Filtros</span>
            {hayFiltrosActivos && (
              <span className="h-2 w-2 rounded-full bg-cyan-400 ring-2 ring-[#070F2B]" />
            )}
          </button>

          {/* Ordenar rápido para escritorio */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300">
            <span className="font-semibold text-slate-400">Ordenar:</span>
            <div className="w-48">
              <Select
                value={ordenParam}
                options={opcionesOrden}
                onChange={(e) => actualizarParametros({ orden: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Chips de filtros activos */}
      {hayFiltrosActivos && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Filter size={12} className="text-cyan-400" />
            <span>Filtros activos:</span>
          </span>

          {qParam && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
              <span>Búsqueda: «{qParam}»</span>
              <button
                type="button"
                onClick={() => actualizarParametros({ q: '' })}
                className="hover:text-white"
                aria-label="Quitar filtro de búsqueda"
              >
                <X size={13} />
              </button>
            </span>
          )}

          {catParam && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
              <span>Rubro: {nombreCategoriaActiva}</span>
              <button
                type="button"
                onClick={() => actualizarParametros({ categoria: '' })}
                className="hover:text-white"
                aria-label="Quitar filtro de categoría"
              >
                <X size={13} />
              </button>
            </span>
          )}

          {marcaParam && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
              <Tag size={11} className="text-cyan-400" />
              <span>Marca: {marcaParam}</span>
              <button
                type="button"
                onClick={() => actualizarParametros({ marca: '' })}
                className="hover:text-white"
                aria-label="Quitar filtro de marca"
              >
                <X size={13} />
              </button>
            </span>
          )}

          {(minParam || maxParam) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
              <span>Precio: Bs {minParam || 0} - {maxParam ? `Bs ${maxParam}` : 'sin límite'}</span>
              <button
                type="button"
                onClick={() => actualizarParametros({ min: '', max: '' })}
                className="hover:text-white"
                aria-label="Quitar filtro de precio"
              >
                <X size={13} />
              </button>
            </span>
          )}

          {dispParam && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
              <span>{dispParam === 'true' ? 'Solo disponibles' : 'Agotados'}</span>
              <button
                type="button"
                onClick={() => actualizarParametros({ disponible: '' })}
                className="hover:text-white"
                aria-label="Quitar filtro de disponibilidad"
              >
                <X size={13} />
              </button>
            </span>
          )}

          {ordenParam !== 'recientes' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
              <ArrowUpDown size={11} className="text-cyan-400" />
              <span>Orden: {opcionesOrden.find((o) => o.value === ordenParam)?.label}</span>
              <button
                type="button"
                onClick={() => actualizarParametros({ orden: 'recientes' })}
                className="hover:text-white"
                aria-label="Quitar orden personalizado"
              >
                <X size={13} />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={limpiarTodosLosFiltros}
            className="text-xs text-rose-400 hover:text-rose-300 font-semibold underline underline-offset-4 ml-1"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Contenido principal: Barra lateral en escritorio + Grilla de productos */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Barra lateral de escritorio (Tarjeta de Vidrio) */}
        <aside className="hidden lg:block lg:col-span-1 tarjeta-vidrio p-5 sticky top-24">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-cyan-400" aria-hidden="true" />
              <span>Filtros</span>
            </h2>
            {hayFiltrosActivos && (
              <button
                type="button"
                onClick={limpiarTodosLosFiltros}
                className="text-[11px] text-cyan-400 hover:underline"
              >
                Restablecer
              </button>
            )}
          </div>
          <ControlesFiltros esModal={false} />
        </aside>

        {/* Grilla de productos */}
        <div className="lg:col-span-3 space-y-8">
          {error && (
            <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm">
              {error}
            </div>
          )}

          {/* Estado Cargando con Esqueletos */}
          {cargando ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {Array.from({ length: 9 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : data.productos.length > 0 ? (
            /* Grilla de productos encontrados */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {data.productos.map((prod) => (
                <TarjetaProducto
                  key={prod.id_producto}
                  p={prod}
                  onVer={(id) => {
                    setModalProductoId(id);
                    actualizarParametros({ producto: id }, false);
                  }}
                />
              ))}
            </div>
          ) : (
            /* Estado Vacío Accesible */
            <div className="p-10 sm:p-16 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col items-center justify-center text-center space-y-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/5 border border-white/10 text-slate-400">
                <SearchX size={32} strokeWidth={1.5} className="text-cyan-400" aria-hidden="true" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="text-lg font-bold text-white">
                  No encontramos productos con estos criterios
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Prueba modificando el texto de búsqueda, seleccionando otra marca o limpiando los filtros para ver todos los productos.
                </p>
              </div>
              {hayFiltrosActivos && (
                <button
                  type="button"
                  onClick={limpiarTodosLosFiltros}
                  className="btn-cta !px-5 !py-2.5 text-xs font-bold gap-2"
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  <span>Limpiar todos los filtros</span>
                </button>
              )}
            </div>
          )}

          {/* Paginación */}
          {!cargando && data.paginas > 1 && (
            <nav
              role="navigation"
              aria-label="Paginación del catálogo"
              className="flex items-center justify-center gap-2 pt-6 border-t border-white/10"
            >
              <button
                type="button"
                disabled={pagParam <= 1}
                onClick={() => actualizarParametros({ pagina: pagParam - 1 }, false)}
                className="btn-light !px-3 !py-2 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                aria-label="Ir a la página anterior"
              >
                <ChevronLeft size={16} />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              <div className="flex items-center gap-1 px-2">
                {Array.from({ length: data.paginas }).map((_, i) => {
                  const pNum = i + 1;
                  const esActual = pNum === pagParam;
                  // Limitar páginas visibles si son muchas
                  if (
                    data.paginas > 7 &&
                    Math.abs(pNum - pagParam) > 2 &&
                    pNum !== 1 &&
                    pNum !== data.paginas
                  ) {
                    if (pNum === 2 || pNum === data.paginas - 1) {
                      return (
                        <span key={pNum} className="px-1 text-slate-500 text-xs">
                          …
                        </span>
                      );
                    }
                    return null;
                  }

                  return (
                    <button
                      key={pNum}
                      type="button"
                      aria-current={esActual ? 'page' : undefined}
                      onClick={() => actualizarParametros({ pagina: pNum }, false)}
                      className={`h-9 w-9 rounded-xl text-xs font-bold transition-colors ${
                        esActual
                          ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={pagParam >= data.paginas}
                onClick={() => actualizarParametros({ pagina: pagParam + 1 }, false)}
                className="btn-light !px-3 !py-2 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                aria-label="Ir a la página siguiente"
              >
                <span className="hidden sm:inline">Siguiente</span>
                <ChevronRight size={16} />
              </button>
            </nav>
          )}
        </div>
      </div>

      {/* Cajón de filtros móvil (Modal accesible) */}
      <Modal
        abierto={mostrarFiltrosMovil}
        onCerrar={() => setMostrarFiltrosMovil(false)}
        maxWidth="max-w-md"
        ariaLabelledBy="filtros-movil-title"
        titulo={
          <span className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-cyan-400" aria-hidden="true" />
            <span>Filtros del catálogo</span>
          </span>
        }
      >
        <div className="space-y-4 pt-1">
          <ControlesFiltros esModal={true} />
          <div className="pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setMostrarFiltrosMovil(false)}
              className="btn-cta w-full justify-center !py-2.5 text-sm font-bold"
            >
              Ver resultados {data.total > 0 && `(${data.total})`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Detalle de Producto */}
      {modalProductoId && (
        <ModalDetalleProducto
          id={modalProductoId}
          onCerrar={() => {
            setModalProductoId(null);
            actualizarParametros({ producto: null }, false);
          }}
        />
      )}
      </div>
    </div>
  );
}

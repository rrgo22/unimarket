import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Store,
  BadgeCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  PackageSearch,
  RotateCcw,
} from 'lucide-react';
import { api, empImgUrl } from '../api.js';
import Encabezado from '../components/Encabezado.jsx';
import Select from '../components/Select.jsx';

export default function Empresas() {
  const [searchParams, setSearchParams] = useSearchParams();

  const qParam = searchParams.get('q') || '';
  const catParam = searchParams.get('categoria') || '';
  const pagParam = parseInt(searchParams.get('pagina'), 10) || 1;

  const [categorias, setCategorias] = useState([]);
  const [res, setRes] = useState({ total: 0, pagina: 1, paginas: 1, empresas: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Cargar categorías disponibles para el filtro
  useEffect(() => {
    api('/publico/categorias')
      .then((cats) => setCategorias(cats || []))
      .catch(() => {});
  }, []);

  // Consultar empresas según filtros y paginación
  const buscarEmpresas = useCallback(async () => {
    setCargando(true);
    setError('');
    const qs = new URLSearchParams();
    if (qParam) qs.set('q', qParam);
    if (catParam) qs.set('categoria', catParam);
    if (pagParam > 1) qs.set('pagina', String(pagParam));
    qs.set('limite', '12');

    try {
      const data = await api(`/publico/empresas?${qs}`);
      setRes(data || { total: 0, pagina: 1, paginas: 1, empresas: [] });
    } catch (e) {
      setError(e.message || 'Error al cargar el directorio de empresas');
    } finally {
      setCargando(false);
    }
  }, [qParam, catParam, pagParam]);

  useEffect(() => {
    const t = setTimeout(buscarEmpresas, 200);
    const alCambiarVisibilidad = () => {
      if (!document.hidden) buscarEmpresas();
    };
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    window.addEventListener('focus', alCambiarVisibilidad);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      window.removeEventListener('focus', alCambiarVisibilidad);
    };
  }, [buscarEmpresas]);

  const actualizarParametro = (clave, valor) => {
    const nuevosParams = new URLSearchParams(searchParams);
    if (valor) {
      nuevosParams.set(clave, valor);
    } else {
      nuevosParams.delete(clave);
    }
    // Si se modifica búsqueda o categoría, regresar a página 1
    if (clave !== 'pagina') {
      nuevosParams.delete('pagina');
    }
    setSearchParams(nuevosParams, { replace: true });
  };

  const limpiarFiltros = () => {
    setSearchParams({}, { replace: true });
  };

  return (
    <div className="w-full">
      {/* Cabecera con Encabezado visual compartido */}
      <Encabezado
        migas={[{ etiqueta: 'Empresas' }]}
        titulo="Empresas y Marcas Verificadas"
        subtitulo="Conoce todas las empresas formalmente registradas en UNIMARKET BO. Ingresa a sus portales para explorar sus catálogos completos y contactar directamente."
        icono={Store}
      />

      <div className="-mt-8 relative z-20 mx-auto max-w-6xl px-4 sm:px-6 space-y-6 pb-12">
        {/* Barra de Filtros y Búsqueda */}
        <div className="card p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4 border-white/10 bg-white/[0.05] backdrop-blur-md">
          {/* Buscador de empresa */}
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              className="input text-sm pl-10 w-full"
              placeholder="Buscar empresa por nombre o descripción…"
              value={qParam}
              onChange={(e) => actualizarParametro('q', e.target.value)}
            />
          </div>

          {/* Selector de categoría */}
          <div className="flex items-center gap-2">
            <div className="w-full sm:w-64">
              <Select
                value={catParam}
                placeholder="Todos los rubros"
                ariaLabel="Filtrar empresas por rubro"
                options={[
                  { value: '', label: 'Todos los rubros' },
                  ...categorias
                    .filter((c) => (c.total_productos || 0) > 0)
                    .map((c) => ({
                      value: String(c.id_categoria),
                      label: `${c.nombre} (${c.total_productos || 0})`,
                    })),
                ]}
                onChange={(e) => actualizarParametro('categoria', e.target.value)}
              />
            </div>

            {(qParam || catParam) && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="btn-light !px-3 !py-2 text-xs shrink-0"
                title="Limpiar filtros"
              >
                <RotateCcw size={14} aria-hidden="true" />
                <span className="hidden sm:inline">Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {/* Resultados de Empresas */}
        <section className="space-y-6">
          {error && <p className="err">{error}</p>}

          {cargando ? (
            /* Esqueletos de carga oscuros */
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card p-5 space-y-3 animate-pulse border-white/10 bg-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-white/10 shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 bg-white/10 rounded w-3/4" />
                      <div className="h-3 bg-white/[0.06] rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-10 bg-white/[0.04] rounded" />
                  <div className="h-8 bg-white/[0.06] rounded" />
                </div>
              ))}
            </div>
          ) : res.empresas.length === 0 ? (
            /* Estado Vacío */
            <div className="card p-12 text-center text-slate-300 space-y-3 border-white/10 bg-white/[0.05]">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10 text-cyan-300 mx-auto border border-white/15">
                <PackageSearch size={32} strokeWidth={1.5} aria-hidden="true" />
              </div>
              <h3 className="font-bold text-white text-base">No se encontraron empresas</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Intenta con otra palabra clave o restablece los filtros para ver todas las empresas.
              </p>
              <button type="button" onClick={limpiarFiltros} className="btn-light text-xs mt-2">
                Ver todas las empresas
              </button>
            </div>
          ) : (
            /* Grilla de Tarjetas de Empresas */
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {res.empresas.map((emp) => (
                <Link
                  key={emp.id_empresa}
                  to={`/tienda/${emp.slug}`}
                  className="card group flex flex-col justify-between p-5 border border-white/10 bg-white/[0.05] hover:bg-white/[0.08] hover:border-cyan-400/40 hover:shadow-elevated transition-all duration-200 rounded-2xl"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3.5">
                      {/* Logo o inicial en cuadro degradado cian a violeta con letra blanca */}
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 border border-white/20 overflow-hidden text-base font-bold text-white shadow-xs">
                        {emp.logo ? (
                          <img
                            src={empImgUrl(emp.logo)}
                            alt={emp.razon_social}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          emp.razon_social?.charAt(0)?.toUpperCase() || 'E'
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h2 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                            {emp.razon_social}
                          </h2>
                          <BadgeCheck size={16} className="text-emerald-400 shrink-0" aria-hidden="true" />
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                          {emp.productos || 0} producto(s) publicado(s)
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                      {emp.descripcion || 'Empresa formalmente registrada en UNIMARKET BO.'}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-cyan-300 group-hover:text-cyan-200 transition-colors">
                    <span>Visitar tienda oficial</span>
                    <ExternalLink size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Paginación */}
          {res.paginas > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                className="btn-light !px-3 !py-2 text-xs"
                disabled={pagParam <= 1}
                onClick={() => actualizarParametro('pagina', String(pagParam - 1))}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
                <span>Anterior</span>
              </button>

              <span className="text-xs font-semibold text-slate-300 px-2">
                Página {res.pagina} de {res.paginas} ({res.total} empresas)
              </span>

              <button
                type="button"
                className="btn-light !px-3 !py-2 text-xs"
                disabled={pagParam >= res.paginas}
                onClick={() => actualizarParametro('pagina', String(pagParam + 1))}
                aria-label="Página siguiente"
              >
                <span>Siguiente</span>
                <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

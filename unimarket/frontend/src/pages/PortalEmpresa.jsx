import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import {
  Store,
  BadgeCheck,
  MapPin,
  Globe,
  MessageCircle,
  ExternalLink,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Loader2,
  PackageSearch,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { api, empImgUrl } from '../api.js';
import TarjetaProducto from '../components/TarjetaProducto.jsx';
import ModalDetalleProducto from '../components/ModalDetalleProducto.jsx';
import ModalReportar from '../components/ModalReportar.jsx';
import Modal from '../components/Modal.jsx';
import Select from '../components/Select.jsx';

export default function PortalEmpresa() {
  const { slug } = useParams();

  const [empresa, setEmpresa] = useState(null);
  const [cargandoEmpresa, setCargandoEmpresa] = useState(true);
  const [errorEmpresa, setErrorEmpresa] = useState('');

  const [cats, setCats] = useState([]);
  const [f, setF] = useState({ q: '', categoria: '', min: '', max: '', disponible: '' });
  const [pagina, setPagina] = useState(1);
  const [res, setRes] = useState({ total: 0, pagina: 1, paginas: 1, productos: [] });
  const [cargandoProds, setCargandoProds] = useState(false);
  const [errorProds, setErrorProds] = useState('');

  const [ver, setVer] = useState(null);
  const [mostrarFiltrosMovil, setMostrarFiltrosMovil] = useState(false);
  const [contactando, setContactando] = useState(false);
  const [mostrarModalReportar, setMostrarModalReportar] = useState(false);

  // Cargar datos de la empresa por su slug
  useEffect(() => {
    setCargandoEmpresa(true);
    setErrorEmpresa('');
    api(`/publico/empresa/${slug}`)
      .then((data) => setEmpresa(data))
      .catch((e) => setErrorEmpresa(e.message || 'Empresa no encontrada'))
      .finally(() => setCargandoEmpresa(false));
  }, [slug]);

  // Cargar categorías disponibles de esta empresa
  useEffect(() => {
    if (empresa?.id_empresa) {
      api(`/publico/empresa/${slug}/categorias`)
        .then((data) => setCats(data || []))
        .catch(() => {});
    }
  }, [empresa, slug]);

  // Buscar productos filtrados
  const buscar = useCallback(async () => {
    if (!empresa?.id_empresa) return;
    setCargandoProds(true);
    setErrorProds('');
    const qs = new URLSearchParams();
    if (f.q) qs.set('q', f.q);
    if (f.categoria) qs.set('categoria', f.categoria);
    if (f.min) qs.set('min', f.min);
    if (f.max) qs.set('max', f.max);
    if (f.disponible) qs.set('disponible', f.disponible);
    if (pagina > 1) qs.set('pagina', String(pagina));
    qs.set('limite', '12');

    try {
      const data = await api(`/publico/empresa/${slug}/productos?${qs}`);
      setRes(data || { total: 0, pagina: 1, paginas: 1, productos: [] });
    } catch (e) {
      setErrorProds(e.message || 'Error al cargar los productos');
    } finally {
      setCargandoProds(false);
    }
  }, [empresa, slug, f, pagina]);

  useEffect(() => {
    const t = setTimeout(buscar, 200);
    return () => clearTimeout(t);
  }, [buscar]);

  const cambiar = (k, v) => {
    setF((prev) => ({ ...prev, [k]: v }));
    setPagina(1);
  };

  const limpiarFiltros = () => {
    setF({ q: '', categoria: '', min: '', max: '', disponible: '' });
    setPagina(1);
  };

  const contactarWhatsapp = async () => {
    if (!empresa?.whatsapp) return;
    setContactando(true);
    try {
      await api(`/publico/empresa/${slug}/contacto-whatsapp`, {
        method: 'POST',
        body: JSON.stringify({ mensaje: 'Contacto desde el portal de la empresa' }),
      });
    } catch {
      // Ignorar fallo de métrica
    } finally {
      setContactando(false);
      const tel = empresa.whatsapp.replace(/\D/g, '');
      const num = tel.startsWith('591') ? tel : `591${tel}`;
      const msg = encodeURIComponent(
        `Hola, me comunico a través del catálogo oficial de ${empresa.razon_social} en UNIMARKET BO.`
      );
      window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
    }
  };

  const filtrosActivos = Object.entries(f).filter(([, v]) => Boolean(v));

  if (cargandoEmpresa) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center p-8 text-slate-400">
        <Loader2 size={32} className="animate-spin text-cyan-300" aria-hidden="true" />
      </div>
    );
  }

  if (errorEmpresa || !empresa) {
    return (
      <div className="card mx-auto mt-12 max-w-md p-8 text-center space-y-4 shadow-floating border border-white/10 bg-white/[0.05] backdrop-blur-xl text-white rounded-3xl">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-white/10 text-cyan-300 mx-auto border border-white/15">
          <Store size={32} aria-hidden="true" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Esta empresa no está disponible</h1>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          La tienda consultada no existe, su proceso de verificación está pendiente o su suscripción no se encuentra activa.
        </p>
        <div className="pt-2">
          <Link to="/" className="btn-cta w-full justify-center">
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Ver catálogo general</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-16 space-y-8">
      {/* Portada y Cabecera de la Empresa */}
      <section className="card overflow-hidden p-0 border border-white/10 bg-white/[0.05] backdrop-blur-xl shadow-elevated rounded-3xl">
        {/* Banner de Portada */}
        <div className="relative h-44 sm:h-56 w-full bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-950">
          {empresa.portada && (
            <img
              src={empImgUrl(empresa.portada)}
              alt={`Portada de ${empresa.razon_social}`}
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-[#070F2B]/30" />
        </div>

        {/* Datos Principales */}
        <div className="relative px-5 sm:px-8 pb-6 pt-4 sm:pt-0">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-14 mb-4">
            <div className="flex items-end gap-4">
              <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-2xl bg-[#0A1338] p-1.5 shadow-floating ring-2 ring-white/20 shrink-0 overflow-hidden">
                {empresa.logo ? (
                  <img
                    src={empImgUrl(empresa.logo)}
                    alt={empresa.razon_social}
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 text-white font-extrabold text-2xl shadow-xs">
                    <Store size={36} aria-hidden="true" />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {empresa.razon_social}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                    <BadgeCheck size={14} aria-hidden="true" />
                    <span>Empresa verificada</span>
                  </span>
                </div>
                {empresa.direccion && (
                  <p className="text-xs text-slate-300 flex items-center gap-1.5">
                    <MapPin size={13} className="text-cyan-400 shrink-0" aria-hidden="true" />
                    <span>{empresa.direccion}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Acciones: WhatsApp y Reportar */}
            <div className="flex flex-wrap items-center gap-2">
              {empresa.whatsapp && (
                <button
                  type="button"
                  onClick={contactarWhatsapp}
                  disabled={contactando}
                  className="btn-success shadow-sm flex items-center justify-center gap-2 !px-5 !py-2.5 rounded-xl text-sm font-semibold"
                >
                  {contactando ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <MessageCircle size={17} strokeWidth={2} aria-hidden="true" />
                  )}
                  <span>{contactando ? 'Conectando…' : 'Contactar por WhatsApp'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setMostrarModalReportar(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-xs font-semibold text-slate-400 hover:text-rose-300 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors"
                title="Reportar irregularidad o incumplimiento de esta empresa"
              >
                <ShieldAlert size={15} className="text-rose-400" />
                <span>Reportar</span>
              </button>
            </div>
          </div>

          {/* Acerca de y Canales Oficiales */}
          <div className="grid gap-4 border-t border-white/10 pt-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Acerca de la empresa
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {empresa.descripcion || 'Empresa boliviana legalmente establecida y verificada en UNIMARKET BO.'}
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Canales oficiales
              </h2>
              <div className="flex flex-wrap gap-2 text-xs">
                {empresa.sitio_web && (
                  <a
                    href={empresa.sitio_web}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-white hover:border-cyan-400/40 hover:bg-white/15 transition-colors shadow-2xs font-medium"
                  >
                    <Globe size={13} className="text-cyan-300" aria-hidden="true" />
                    <span>Sitio Web</span>
                  </a>
                )}
                {empresa.facebook && (
                  <a
                    href={empresa.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-cyan-300 hover:border-cyan-400/40 hover:bg-white/15 transition-colors shadow-2xs font-medium"
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                    <span>Facebook</span>
                  </a>
                )}
                {empresa.instagram && (
                  <a
                    href={empresa.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-violet-300 hover:border-violet-400/40 hover:bg-white/15 transition-colors shadow-2xs font-medium"
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                    <span>Instagram</span>
                  </a>
                )}
                {empresa.tiktok && (
                  <a
                    href={empresa.tiktok}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-white hover:border-cyan-400/40 hover:bg-white/15 transition-colors shadow-2xs font-medium"
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                    <span>TikTok</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Barra de Filtros Activos y Móvil */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMostrarFiltrosMovil(true)}
            className="md:hidden btn-light !py-2 !px-3 text-xs"
          >
            <SlidersHorizontal size={15} aria-hidden="true" />
            <span>Filtros</span>
            {filtrosActivos.length > 0 && (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-cyan-500 text-[10px] font-bold text-white">
                {filtrosActivos.length}
              </span>
            )}
          </button>
          <p className="text-xs sm:text-sm text-slate-300">
            {cargandoProds ? 'Filtrando…' : `${res.total} producto(s) en este portal`}
          </p>
        </div>

        <Link to="/" className="text-xs text-cyan-300 font-semibold hover:text-cyan-200 hover:underline flex items-center gap-1">
          <ArrowLeft size={13} aria-hidden="true" />
          <span>Volver al catálogo general</span>
        </Link>
      </div>

      {/* Grilla y Filtros de la Empresa */}
      <div className="grid gap-6 md:grid-cols-[240px_1fr] items-start">
        {/* Filtros Escritorio */}
        <aside className="card hidden md:block space-y-4 p-5 sticky top-20 border-white/10 bg-white/[0.05] backdrop-blur-md rounded-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-cyan-300" aria-hidden="true" />
              <span>Filtros</span>
            </h2>
            {filtrosActivos.length > 0 && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="text-[11px] font-semibold text-cyan-300 hover:underline"
              >
                Restablecer
              </button>
            )}
          </div>

          <div>
            <label className="label !text-slate-200">Búsqueda en esta tienda</label>
            <input
              className="input text-sm"
              placeholder="Buscar producto…"
              value={f.q}
              onChange={(e) => cambiar('q', e.target.value)}
            />
          </div>

          <div>
            <label className="label !text-slate-200">Categoría</label>
            <Select
              value={f.categoria}
              placeholder="Todas las categorías"
              options={[
                { value: '', label: 'Todas las categorías' },
                ...cats.map((c) => ({
                  value: String(c.id_categoria),
                  label: c.nombre,
                })),
              ]}
              onChange={(e) => cambiar('categoria', e.target.value)}
            />
          </div>

          <div>
            <label className="label !text-slate-200">Precio (Bs)</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input text-sm"
                type="number"
                min="0"
                placeholder="Mín"
                value={f.min}
                onChange={(e) => cambiar('min', e.target.value)}
              />
              <input
                className="input text-sm"
                type="number"
                min="0"
                placeholder="Máx"
                value={f.max}
                onChange={(e) => cambiar('max', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label !text-slate-200">Disponibilidad</label>
            <Select
              value={f.disponible}
              placeholder="Todos"
              options={[
                { value: '', label: 'Todos' },
                { value: 'true', label: 'Solo disponibles' },
                { value: 'false', label: 'Agotados' },
              ]}
              onChange={(e) => cambiar('disponible', e.target.value)}
            />
          </div>
        </aside>

        {/* Panel Filtros Móvil (Modal) */}
        <Modal
          abierto={mostrarFiltrosMovil}
          onCerrar={() => setMostrarFiltrosMovil(false)}
          maxWidth="max-w-md"
          ariaLabelledBy="filtros-empresa-movil-title"
          classNameContenedor="md:hidden"
          titulo={
            <span className="flex items-center gap-2 text-white">
              <SlidersHorizontal size={18} className="text-cyan-300" aria-hidden="true" />
              <span>Filtros de la tienda</span>
            </span>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="label !text-slate-200">Búsqueda rápida</label>
              <input
                className="input text-base"
                placeholder="Buscar producto…"
                value={f.q}
                onChange={(e) => cambiar('q', e.target.value)}
              />
            </div>

            <div>
              <label className="label !text-slate-200">Categoría</label>
              <Select
                value={f.categoria}
                placeholder="Todas las categorías"
                options={[
                  { value: '', label: 'Todas las categorías' },
                  ...cats.map((c) => ({
                    value: String(c.id_categoria),
                    label: c.nombre,
                  })),
                ]}
                onChange={(e) => cambiar('categoria', e.target.value)}
              />
            </div>

            <div>
              <label className="label !text-slate-200">Rango de precio (Bs)</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input text-base"
                  type="number"
                  min="0"
                  placeholder="Mínimo"
                  value={f.min}
                  onChange={(e) => cambiar('min', e.target.value)}
                />
                <input
                  className="input text-base"
                  type="number"
                  min="0"
                  placeholder="Máximo"
                  value={f.max}
                  onChange={(e) => cambiar('max', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label !text-slate-200">Disponibilidad</label>
              <Select
                value={f.disponible}
                placeholder="Todos"
                options={[
                  { value: '', label: 'Todos' },
                  { value: 'true', label: 'Solo disponibles' },
                  { value: 'false', label: 'Agotados' },
                ]}
                onChange={(e) => cambiar('disponible', e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                className="btn-light flex-1 !py-3"
                onClick={() => {
                  limpiarFiltros();
                  setMostrarFiltrosMovil(false);
                }}
              >
                Restablecer
              </button>
              <button
                type="button"
                className="btn-cta flex-1 !py-3"
                onClick={() => setMostrarFiltrosMovil(false)}
              >
                Aplicar
              </button>
            </div>
          </div>
        </Modal>

        {/* Grilla de Productos */}
        <section className="space-y-6">
          {errorProds && <p className="err mb-4">{errorProds}</p>}

          {!cargandoProds && !res.productos.length && !errorProds && (
            <div className="card p-12 text-center text-slate-300 space-y-3 border-white/10 bg-white/[0.05] rounded-2xl">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10 text-cyan-300 mx-auto border border-white/15">
                <PackageSearch size={32} strokeWidth={1.5} aria-hidden="true" />
              </div>
              <h3 className="font-bold text-white text-base">No hay productos disponibles</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Intente limpiando los filtros seleccionados o modificando el término de búsqueda.
              </p>
              <div className="pt-2">
                <button type="button" onClick={limpiarFiltros} className="btn-light text-xs">
                  <RotateCcw size={14} aria-hidden="true" />
                  <span>Restablecer filtros</span>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {res.productos.map((p) => (
              <TarjetaProducto
                key={p.id_producto}
                p={{ ...p, empresa: empresa.razon_social, empresa_slug: slug }}
                onVer={setVer}
                ocultarEmpresa={true}
              />
            ))}
          </div>

          {res.paginas > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                className="btn-light !px-3 !py-2 text-xs"
                disabled={pagina <= 1}
                onClick={() => setPagina(pagina - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              <span className="text-xs font-semibold text-slate-300 px-2">
                Página {res.pagina} de {res.paginas}
              </span>

              <button
                type="button"
                className="btn-light !px-3 !py-2 text-xs"
                disabled={pagina >= res.paginas}
                onClick={() => setPagina(pagina + 1)}
                aria-label="Página siguiente"
              >
                <span className="hidden sm:inline">Siguiente</span>
                <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Modal de Detalle */}
      <AnimatePresence>
        {ver && <ModalDetalleProducto id={ver} onCerrar={() => setVer(null)} />}
      </AnimatePresence>

      {/* Modal de Reporte */}
      <ModalReportar
        abierto={mostrarModalReportar}
        onCerrar={() => setMostrarModalReportar(false)}
        empresa={empresa}
      />
    </div>
  );
}

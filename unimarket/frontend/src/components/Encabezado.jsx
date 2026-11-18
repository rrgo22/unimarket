import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Sparkles, Store, Package, ShoppingBag } from 'lucide-react';

/**
 * Cabecera visual compartida para todas las p\u00e1ginas.
 *
 * Props:
 *   migas        \u2014 [{etiqueta, ruta}] o [{label, to}] (ambos formatos aceptados)
 *   titulo       \u2014 texto principal h1
 *   subtitulo    \u2014 texto descriptivo
 *   icono        \u2014 componente lucide para el \u00edcono del t\u00edtulo
 *   acciones     \u2014 nodo React a la derecha (botones, badges\u2026)
 *   children     \u2014 slot inferior (pesta\u00f1as, filtros)
 *   className    \u2014 clases extra para el <header>
 *   pageTitle    \u2014 t\u00edtulo expl\u00edcito para document.title; si no se pasa, usa `titulo`
 *   iconosFondo  \u2014 [{Icono, clases}] para reemplazar los iconos decorativos laterales
 */
const ICONOS_FONDO_DEFAULT = [
  { Icono: Store,       clases: 'absolute left-[3%]  top-[25%]    opacity-15 text-cyan-300',    size: 36 },
  { Icono: ShoppingBag, clases: 'absolute right-[4%] top-[30%]    opacity-15 text-[#A78BFA]',   size: 40 },
  { Icono: Package,     clases: 'absolute left-[8%]  bottom-[15%] opacity-10 text-white',        size: 28 },
  { Icono: Sparkles,    clases: 'absolute right-[9%] bottom-[20%] opacity-[0.12] text-cyan-200', size: 24 },
];

export default function Encabezado({
  migas = [],
  titulo,
  subtitulo,
  icono: Icono,
  acciones,
  children,
  className = '',
  pageTitle,
  iconosFondo,
}) {
  useEffect(() => {
    const t = pageTitle || (typeof titulo === 'string' ? titulo : null);
    if (t) document.title = `${t} \u00b7 UNIMARKET BO`;
  }, [pageTitle, titulo]);

  // Normalizar migas: acepta {etiqueta, ruta} y tambi\u00e9n {label, to}
  const migasNorm = migas.map((m) => ({
    etiqueta: m.etiqueta ?? m.label ?? '',
    ruta: m.ruta ?? m.to ?? null,
  }));

  const fondos = iconosFondo ?? ICONOS_FONDO_DEFAULT;

  return (
    <header
      className={`relative w-full overflow-hidden bg-gradient-to-b from-[#0B1437] via-[#0E1844] to-[#070F2B] text-white pt-24 sm:pt-28 pb-14 sm:pb-16 ${className}`}
    >
      {/* Capa de fondo decorativa */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none z-0">
        {/* Aurora */}
        <div className="absolute -top-[30%] -left-[10%] w-[45vw] h-[45vw] max-w-[500px] max-h-[500px] rounded-full bg-gradient-to-tr from-cyan-500/20 via-teal-400/15 to-transparent blur-[80px] mix-blend-screen" />
        <div className="absolute -top-[20%] -right-[10%] w-[50vw] h-[50vw] max-w-[550px] max-h-[550px] rounded-full bg-gradient-to-bl from-indigo-600/30 via-purple-600/15 to-transparent blur-[90px] mix-blend-screen" />

        {/* Cuadr\u00edcula de puntos radial */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.4) 1px, transparent 0)`,
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%)',
          }}
        />

        {/* Iconos decorativos laterales */}
        {fondos.map(({ Icono: I, clases, size = 32 }, idx) => (
          <div key={idx} className={clases}>
            <I size={size} strokeWidth={1.3} />
          </div>
        ))}
      </div>

      {/* Contenido dentro de max-w-6xl */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 space-y-4">
        {/* Migas de pan */}
        {migasNorm.length > 0 && (
          <nav aria-label="Migas de pan" className="flex items-center flex-wrap gap-1.5 text-xs text-slate-400">
            <Link to="/" className="hover:text-cyan-300 transition-colors">
              Inicio
            </Link>
            {migasNorm.map((miga, idx) => (
              <span key={idx} className="flex items-center gap-1.5">
                <ChevronRight size={13} className="text-slate-500" aria-hidden="true" />
                {miga.ruta ? (
                  <Link to={miga.ruta} className="hover:text-cyan-300 transition-colors">
                    {miga.etiqueta}
                  </Link>
                ) : (
                  <span className="text-slate-200 font-medium">{miga.etiqueta}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* T\u00edtulo y Acciones */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-3">
              {Icono && (
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-cyan-300 border border-white/15 backdrop-blur-md shadow-xs shrink-0">
                  <Icono size={22} strokeWidth={2} aria-hidden="true" />
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
                {titulo}
              </h1>
            </div>
            {subtitulo && (
              <p className="text-sm sm:text-base text-slate-300/90 leading-relaxed max-w-2xl pl-0.5">
                {subtitulo}
              </p>
            )}
          </div>

          {acciones && <div className="shrink-0 flex flex-wrap items-center gap-3">{acciones}</div>}
        </div>

        {/* Slot para contenido extra */}
        {children && <div className="pt-2">{children}</div>}
      </div>

      {/* Degradado inferior */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-b from-transparent to-[#070F2B] pointer-events-none"
      />
    </header>
  );
}

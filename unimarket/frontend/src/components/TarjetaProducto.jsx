import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, Store, ArrowUpRight, Images, BadgeCheck } from 'lucide-react';
import { bs, imgUrl } from '../api.js';

function BadgeDisponibilidad({ disponible, stock_actual, stock_minimo }) {
  const stock = Number(stock_actual);
  const min   = Number(stock_minimo);
  if (!disponible || stock === 0)
    return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shadow backdrop-blur-md bg-rose-500/20 text-rose-300 border border-rose-500/30">Agotado</span>;
  if (stock_minimo !== undefined && stock <= min)
    return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shadow backdrop-blur-md bg-amber-500/20 text-amber-300 border border-amber-400/30">Stock bajo</span>;
  return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shadow backdrop-blur-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">Disponible</span>;
}

export default function TarjetaProducto({ p, onVer, ocultarEmpresa = false }) {
  const empresaSlug = p.empresa_slug || p.slug;
  const totalFotos  = Array.isArray(p.imagenes)
    ? p.imagenes.length
    : (p.total_imagenes || p.imagenes_count || (p.imagen ? 1 : 0));

  // Colores a mostrar (hasta 5 chips)
  const colores = Array.isArray(p.colores) ? p.colores.slice(0, 6) : [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, boxShadow: '0 0 0 1.5px rgba(34,211,238,0.35), 0 8px 32px rgba(34,211,238,0.1)' }}
      transition={{ duration: 0.2 }}
      onClick={() => onVer(p.id_producto)}
      className="card group cursor-pointer overflow-hidden p-0 text-left flex flex-col"
    >
      {/* Imagen */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-white/[0.04] flex items-center justify-center shrink-0">
        {p.imagen ? (
          <img
            src={imgUrl(p.imagen)}
            alt={p.nombre}
            loading="lazy"
            className="h-full w-full object-contain p-2 transition-[filter] duration-300 group-hover:brightness-110"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 text-slate-600">
            <Package size={36} strokeWidth={1.5} aria-hidden="true" />
            <span className="text-[11px] font-medium text-slate-500">Sin imagen</span>
          </div>
        )}

        {/* Badge disponibilidad */}
        <div className="absolute top-2 right-2">
          <BadgeDisponibilidad disponible={p.disponible} stock_actual={p.stock_actual} stock_minimo={p.stock_minimo} />
        </div>

        {/* Contador de fotos */}
        {totalFotos > 1 && (
          <div className="absolute bottom-2 right-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-950/80 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur border border-white/10">
              <Images size={12} aria-hidden="true" />
              <span>{totalFotos}</span>
            </span>
          </div>
        )}

        {/* Chip de categoría sobre imagen */}
        {p.categoria && (
          <div className="absolute bottom-2 left-2">
            <span className="inline-flex items-center rounded-md bg-indigo-500/25 backdrop-blur px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 border border-indigo-400/20">
              {p.categoria}
            </span>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        {/* Nombre y marca */}
        <div>
          {p.marca && (
            <span className="text-[11px] font-semibold text-cyan-400 tracking-wide">{p.marca}</span>
          )}
          <h3 className="mt-0.5 line-clamp-2 text-sm font-bold text-white leading-snug group-hover:text-cyan-300 transition-colors">
            {p.nombre}
          </h3>
          {p.descripcion && (
            <p className="mt-1 line-clamp-2 text-xs text-slate-400 leading-relaxed">{p.descripcion}</p>
          )}
        </div>

        {/* Chips de colores */}
        {colores.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {colores.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-slate-300 bg-white/[0.06] border border-white/10"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: c.codigo_hex || '#888' }}
                />
                {c.nombre}
              </span>
            ))}
            {Array.isArray(p.colores) && p.colores.length > 6 && (
              <span className="text-[10px] text-slate-500">+{p.colores.length - 6}</span>
            )}
          </div>
        )}

        {/* Empresa */}
        {!ocultarEmpresa && p.empresa && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-auto pt-2 border-t border-white/[0.06]">
            <Store size={12} strokeWidth={1.75} className="shrink-0 text-slate-500" aria-hidden="true" />
            {empresaSlug ? (
              <Link
                to={`/tienda/${empresaSlug}`}
                onClick={(e) => e.stopPropagation()}
                className="truncate font-medium hover:text-cyan-300 hover:underline flex items-center gap-1"
              >
                {p.empresa}
                <BadgeCheck size={12} className="text-cyan-400 shrink-0" />
              </Link>
            ) : (
              <span className="truncate font-medium">{p.empresa}</span>
            )}
          </div>
        )}
      </div>

      {/* Pie: precio y CTA */}
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 bg-white/[0.02] shrink-0">
        <span className="text-base font-extrabold text-white tracking-tight">{bs(p.precio)}</span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 group-hover:translate-x-0.5 transition-transform">
          <span>Ver detalle</span>
          <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" />
        </span>
      </div>
    </motion.div>
  );
}

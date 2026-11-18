import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Store, BadgeCheck, ExternalLink, X, Globe, Loader2,
  MessageCircle, Plus, Minus, ShoppingCart, Trash2, Package,
  ChevronDown, ChevronUp, Tag, Check, ShieldAlert,
} from 'lucide-react';
import { api, bs, empImgUrl } from '../api.js';
import Modal from './Modal.jsx';
import GaleriaProducto from './GaleriaProducto.jsx';
import ModalReportar from './ModalReportar.jsx';

/* ── Calcula el precio unitario según escalas de volumen ── */
function calcPrecio(precioBase, escalas, cantidad) {
  if (!escalas || escalas.length === 0) return Number(precioBase);
  const activa = [...escalas]
    .filter((e) => Number(e.desde_unidades) <= cantidad)
    .sort((a, b) => Number(b.desde_unidades) - Number(a.desde_unidades))[0];
  return activa ? Number(activa.precio_unitario) : Number(precioBase);
}

function BadgeStock({ disponible, stock_actual, stock_minimo, unidad }) {
  const stock = Number(stock_actual);
  const min = Number(stock_minimo);
  if (!disponible || stock === 0)
    return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">Agotado</span>;
  if (stock <= min && stock > 0)
    return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">Stock bajo ({stock} {unidad || 'u.'})</span>;
  return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">Disponible{stock_actual != null ? ` (${stock} ${unidad || 'u.'})` : ''}</span>;
}

export default function ModalDetalleProducto({ id, onCerrar, carritoExterno, onAgregarAlCarrito }) {
  const [p, setP]         = useState(null);
  const [msg, setMsg]     = useState('');
  const [cantidad, setCantidad]   = useState(1);
  const [modo, setModo]           = useState('unidad');
  const [colorSeleccionado, setColorSeleccionado] = useState(null);
  const [expandirEscalas, setExpandirEscalas] = useState(false);
  // Cada entrada: { id_producto, nombre, sku, color: {id, nombre, codigo_hex}|null, cantidad, modo, precio_unitario, subtotal }
  const [carrito, setCarrito]     = useState([]);
  const [nombreCliente, setNombreCliente] = useState('');
  const [ciudad, setCiudad]               = useState('');
  const [enviando, setEnviando]   = useState(false);
  const [respuesta, setRespuesta] = useState(null);
  const [mostrarReportar, setMostrarReportar] = useState(false);

  useEffect(() => {
    api(`/publico/productos/${id}`)
      .then((data) => {
        setP(data);
        const min = Number(data.cantidad_minima) || 1;
        setCantidad(min);
        // Pre-seleccionar el primer color disponible
        setColorSeleccionado(data.colores?.length > 0 ? data.colores[0].id : null);
      })
      .catch((e) => setMsg(e.message));
  }, [id]);

  const minCantidad        = p ? (Number(p.cantidad_minima) || 1) : 1;
  const unidadesPorPaquete = p ? (Number(p.unidades_por_paquete) || 1) : 1;
  const cantidadReal = modo === 'paquete' ? cantidad * unidadesPorPaquete : cantidad;

  const precioActivo = useMemo(
    () => (p ? calcPrecio(p.precio, p.escalas_precio, cantidadReal) : 0),
    [p, cantidadReal]
  );
  const subtotalItem = precioActivo * cantidadReal;

  const tieneColores = Boolean(p?.colores?.length);
  // El botón está ok si: producto disponible + (no tiene colores O hay un color elegido)
  const puedeAgregar = Boolean(p?.disponible) && (!tieneColores || colorSeleccionado !== null);

  const colorActual = useMemo(
    () => p?.colores?.find((c) => c.id === colorSeleccionado) || null,
    [p, colorSeleccionado]
  );

  const carritoActivo = carritoExterno ?? carrito;
  const totalCarrito  = carritoActivo.reduce((s, i) => s + i.subtotal, 0);
  // Total de unidades en el carrito (para mostrar badge)
  const totalUnidades = carritoActivo.reduce((s, i) => s + i.cantidad, 0);

  const agregarItem = useCallback(() => {
    if (!p || !puedeAgregar) return;

    const item = {
      id_producto: p.id_producto,
      nombre: p.nombre,
      sku: p.sku || '',
      color: colorActual ? { id: colorActual.id, nombre: colorActual.nombre, codigo_hex: colorActual.codigo_hex } : null,
      cantidad: cantidadReal,
      modo,
      precio_unitario: precioActivo,
      subtotal: Number(subtotalItem.toFixed(2)),
    };

    if (onAgregarAlCarrito) {
      // Compatibilidad con carrito externo: enviar en formato anterior
      onAgregarAlCarrito({
        ...item,
        desglose_colores: item.color
          ? [{ id_color: item.color.id, nombre: item.color.nombre, cantidad: item.cantidad }]
          : [],
      });
    } else {
      setCarrito((prev) => {
        // Buscar línea con mismo producto Y mismo color
        const clave = (x) => `${x.id_producto}-${x.color?.id ?? 'sin_color'}`;
        const idx = prev.findIndex((x) => clave(x) === clave(item));
        if (idx >= 0) {
          // Sumar cantidad a la línea existente
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            cantidad: next[idx].cantidad + item.cantidad,
            subtotal: Number((next[idx].subtotal + item.subtotal).toFixed(2)),
          };
          return next;
        }
        return [...prev, item];
      });
    }

    // Resetear cantidad al mínimo (el color queda seleccionado para agregar más fácilmente)
    setCantidad(minCantidad);
    setMsg('');
  }, [p, puedeAgregar, tieneColores, colorActual, cantidadReal, modo, precioActivo, subtotalItem, minCantidad, onAgregarAlCarrito]);

  // Quitar una línea específica del carrito interno
  const quitarLinea = (idx) => setCarrito((prev) => prev.filter((_, i) => i !== idx));

  const enviarPedido = async () => {
    if (!carritoActivo.length) return;
    setEnviando(true);
    setMsg('');
    try {
      // Agrupar líneas del carrito por producto para el backend
      const agrupado = carritoActivo.reduce((acc, linea) => {
        const key = linea.id_producto;
        if (!acc[key]) acc[key] = { id_producto: linea.id_producto, cantidad: 0, modo: linea.modo, desglose_colores: [] };
        acc[key].cantidad += linea.cantidad;
        if (linea.color) {
          acc[key].desglose_colores.push({ id_color: linea.color.id, nombre: linea.color.nombre, cantidad: linea.cantidad });
        }
        return acc;
      }, {});
      const items = Object.values(agrupado);
      const r = await api('/publico/pedidos', {
        method: 'POST',
        body: {
          id_empresa: p.id_empresa,
          items,
          nombre_cliente: nombreCliente.trim() || null,
          ciudad: ciudad.trim() || null,
        },
      });
      setRespuesta(r);
      window.open(r.url_whatsapp, '_blank', 'noopener');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const headerModal = (
    <div className="flex items-center justify-between border-b border-white/10 px-5 sm:px-6 py-3.5 shrink-0 bg-[#0E1A44]">
      <div className="min-w-0 pr-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 block">{p?.categoria || 'Detalle'}</span>
        <h2 id="modal-producto-titulo" className="text-lg sm:text-xl font-bold text-white truncate">{p?.nombre || 'Cargando…'}</h2>
      </div>
      <button type="button" onClick={onCerrar} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors" aria-label="Cerrar modal">
        <X size={20} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );

  /* ── Pantalla de confirmación tras enviar ── */
  if (respuesta) {
    return (
      <Modal abierto onCerrar={onCerrar} maxWidth="max-w-md" ariaLabelledBy="modal-producto-titulo" headerPersonalizado={headerModal}>
        <div className="flex flex-col items-center gap-4 py-10 px-4 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/20 border border-emerald-400/30">
            <MessageCircle size={32} className="text-emerald-300" />
          </div>
          <h3 className="text-lg font-extrabold text-white">Pedido enviado</h3>
          <p className="text-sm text-slate-300">
            Pedido <strong className="text-cyan-300 font-mono">{respuesta.codigo}</strong> registrado.
            WhatsApp se abrió con el mensaje listo para enviar.
          </p>
          <p className="text-xs text-slate-400">Total estimado: <strong className="text-white">{bs(respuesta.total_estimado)}</strong></p>
          <div className="flex gap-3 pt-2">
            <button onClick={onCerrar} className="btn-cta">Listo</button>
            <button onClick={() => window.open(respuesta.url_whatsapp, '_blank', 'noopener')} className="btn-light">
              Reabrir WhatsApp
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal abierto onCerrar={onCerrar} maxWidth="max-w-4xl" ariaLabelledBy="modal-producto-titulo" headerPersonalizado={headerModal}>
      {!p ? (
        <div className="py-16 text-center space-y-3">
          {msg ? (
            <p className="text-rose-400 text-sm font-medium">{msg}</p>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Loader2 size={28} className="animate-spin text-cyan-400" />
              <p className="text-sm">Cargando producto…</p>
            </div>
          )}
          <button type="button" className="btn-light mt-4" onClick={onCerrar}>Cerrar</button>
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] items-start">
            {/* Galería */}
            <div className="w-full">
              <GaleriaProducto imagenes={p.imagenes || []} nombre={p.nombre} />
            </div>

            {/* Información y controles de compra */}
            <div className="flex flex-col gap-4">
              {/* Precio y stock */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3 gap-3 flex-wrap">
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">Precio unitario</span>
                  <span className="text-3xl font-extrabold text-white tracking-tight">{bs(precioActivo)}</span>
                  {cantidadReal > 1 && (
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Subtotal: <strong className="text-cyan-300">{bs(subtotalItem)}</strong>
                    </span>
                  )}
                </div>
                <BadgeStock disponible={p.disponible} stock_actual={p.stock_actual} stock_minimo={p.stock_minimo} unidad={p.unidad} />
              </div>

              {/* Chips SKU / marca / modelo */}
              {(p.sku || p.marca || p.modelo) && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {p.sku && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10"><span className="text-slate-400 uppercase text-[10px] font-semibold">SKU:</span><strong className="text-cyan-300 font-mono">{p.sku}</strong></span>}
                  {p.marca && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10"><span className="text-slate-400 uppercase text-[10px] font-semibold">Marca:</span><strong className="text-white">{p.marca}</strong></span>}
                  {p.modelo && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10"><span className="text-slate-400 uppercase text-[10px] font-semibold">Modelo:</span><strong className="text-white font-mono">{p.modelo}</strong></span>}
                </div>
              )}

              {/* Descripción */}
              {p.descripcion && (
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line line-clamp-4">{p.descripcion}</p>
              )}

              {/* ── Tabla de precios por volumen ── */}
              {p.escalas_precio?.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                  <button type="button" onClick={() => setExpandirEscalas((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 transition-colors">
                    <span className="flex items-center gap-1.5"><Tag size={13} className="text-cyan-300" />Precios por volumen</span>
                    {expandirEscalas ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {expandirEscalas && (
                    <div className="border-t border-white/10">
                      <table className="w-full text-xs">
                        <thead><tr className="text-slate-400 border-b border-white/10">
                          <th className="px-3 py-1.5 text-left font-semibold">Desde</th>
                          <th className="px-3 py-1.5 text-left font-semibold">Etiqueta</th>
                          <th className="px-3 py-1.5 text-right font-semibold">Precio/u.</th>
                        </tr></thead>
                        <tbody>
                          <tr className={`border-b border-white/5 ${cantidadReal < Number(p.escalas_precio[0]?.desde_unidades) ? 'bg-cyan-500/10' : ''}`}>
                            <td className="px-3 py-1.5 text-slate-300">
                              1{cantidadReal < Number(p.escalas_precio[0]?.desde_unidades) && <span className="ml-1.5 text-[10px] text-cyan-400 font-bold">Activo</span>}
                            </td>
                            <td className="px-3 py-1.5 text-slate-400">Precio base</td>
                            <td className="px-3 py-1.5 text-right font-mono text-white">{bs(p.precio)}</td>
                          </tr>
                          {p.escalas_precio.map((e) => {
                            const activa = cantidadReal >= Number(e.desde_unidades);
                            return (
                              <tr key={e.id} className={`border-b border-white/5 ${activa ? 'bg-cyan-500/10' : ''}`}>
                                <td className="px-3 py-1.5 text-slate-300">
                                  {e.desde_unidades}+{activa && <span className="ml-1.5 text-[10px] text-cyan-400 font-bold">Activo</span>}
                                </td>
                                <td className="px-3 py-1.5 text-slate-400">{e.etiqueta || '—'}</td>
                                <td className={`px-3 py-1.5 text-right font-mono font-bold ${activa ? 'text-cyan-300' : 'text-white'}`}>{bs(e.precio_unitario)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Presentación (unidad / paquete) ── */}
              {unidadesPorPaquete > 1 && (
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">Presentación</label>
                  <div className="flex gap-2">
                    {['unidad', 'paquete'].map((m) => (
                      <button key={m} type="button"
                        onClick={() => { setModo(m); setCantidad(minCantidad); }}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all ${modo === m ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}>
                        {m === 'unidad' ? `Por unidad (${p.unidad || 'u.'})` : `Por paquete (${unidadesPorPaquete} ${p.unidad || 'u.'})`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Selector de cantidad ── */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">
                  Cantidad {modo === 'paquete' ? `(paquetes) = ${cantidadReal} ${p.unidad || 'u.'}` : `(mín. ${minCantidad})`}
                </label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setCantidad((v) => Math.max(minCantidad, v - 1))}
                    className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20 border border-white/15 transition-all active:scale-95">
                    <Minus size={16} />
                  </button>
                  <input type="number" min={minCantidad} value={cantidad}
                    onChange={(e) => setCantidad(Math.max(minCantidad, parseInt(e.target.value, 10) || minCantidad))}
                    className="input w-20 text-center font-mono font-bold text-white !py-1.5" />
                  <button type="button" onClick={() => setCantidad((v) => v + 1)}
                    className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20 border border-white/15 transition-all active:scale-95">
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* ── Selector de colores disponibles ── */}
              {tieneColores && (
                <div className="space-y-2.5 rounded-2xl bg-white/[0.03] border border-white/10 p-3.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">
                      Color
                      {colorActual && (
                        <span className="ml-2 text-cyan-300 font-extrabold">{colorActual.nombre}</span>
                      )}
                    </label>
                    <span className="text-[11px] text-slate-500">Elige 1 color por vez</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {p.colores.map((col) => {
                      const sel = colorSeleccionado === col.id;
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => setColorSeleccionado(col.id)}
                          className={`group flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all border ${
                            sel
                              ? 'bg-cyan-500/20 text-white border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400'
                              : 'bg-white/[0.05] text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {col.codigo_hex && (
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-white/30 shrink-0 shadow-inner"
                              style={{ backgroundColor: col.codigo_hex }}
                            />
                          )}
                          <span>{col.nombre}</span>
                          {sel && <Check size={13} className="text-cyan-400 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Indicador si el producto solo tiene color único ── */}
              {!tieneColores && p.color_unico && (
                <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/10 px-3.5 py-2.5 text-xs">
                  <span className="text-slate-400 font-semibold">Color:</span>
                  <span className="font-bold text-white">{p.color_unico}</span>
                </div>
              )}

              {/* ── Botón agregar al pedido ── */}
              <button
                type="button"
                onClick={agregarItem}
                disabled={!puedeAgregar}
                className="btn-cta w-full gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart size={17} />
                <span>Agregar al pedido</span>
                {cantidadReal > 1 && <span className="text-cyan-200 font-mono text-xs">(&times; {cantidadReal})</span>}
              </button>

              {/* ── Ficha de empresa vendedora ── */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/10 border border-white/15">
                    {p.empresa_logo ? <img src={empImgUrl(p.empresa_logo)} alt={p.empresa} className="h-full w-full object-cover" /> : <Store size={20} className="text-cyan-400" />}
                  </div>
                  <div className="grow min-w-0">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Vendido por</p>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-white text-sm truncate">{p.empresa}</p>
                      <BadgeCheck size={15} className="text-cyan-400 shrink-0" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-white/10 text-xs">
                  <div className="flex items-center gap-2">
                    {p.empresa_slug && (
                      <Link to={`/tienda/${p.empresa_slug}`} onClick={onCerrar} className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold hover:underline">
                        <span>Ir a la tienda</span><ExternalLink size={11} />
                      </Link>
                    )}
                    {p.sitio_web && (
                      <a href={p.sitio_web} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-400 hover:text-white hover:underline">
                        <Globe size={11} /><span>Sitio web</span>
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMostrarReportar(true)}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-300 transition-colors"
                    title="Reportar este producto o empresa por fraude o incumplimiento"
                  >
                    <ShieldAlert size={12} className="text-rose-400" />
                    <span>Reportar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Carrito de pedido (debajo del grid) ── */}
          {carritoActivo.length > 0 ? (
            <div className="mt-6 border-t border-white/10 pt-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShoppingCart size={16} className="text-cyan-300" />
                Pedido
                <span className="text-xs font-normal text-slate-400">
                  ({totalUnidades} {totalUnidades === 1 ? 'unidad' : 'unidades'})
                </span>
              </h3>

              {/* Nombre del producto una sola vez */}
              <div className="text-xs font-semibold text-slate-400 px-1">{p?.nombre}</div>

              {/* Una fila por cada color agregado */}
              <div className="space-y-1.5">
                {carritoActivo.map((linea, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5"
                  >
                    {/* Punto de color */}
                    {linea.color ? (
                      <span
                        className="h-3 w-3 rounded-full shrink-0 border border-white/20"
                        style={{ backgroundColor: linea.color.codigo_hex || '#888' }}
                      />
                    ) : (
                      <Package size={14} className="text-cyan-300 shrink-0" />
                    )}

                    {/* Cantidad × Color */}
                    <span className="flex-1 text-sm font-semibold text-white">
                      {linea.cantidad} &times; {linea.color?.nombre || linea.nombre}
                    </span>

                    {/* Precio de esa línea */}
                    <span className="text-sm font-bold text-cyan-300 shrink-0 tabular-nums">
                      {bs(linea.subtotal)}
                    </span>

                    {/* Quitar solo si no es carrito externo */}
                    {!carritoExterno && (
                      <button
                        type="button"
                        onClick={() => quitarLinea(idx)}
                        className="text-slate-500 hover:text-rose-400 transition-colors shrink-0"
                        aria-label="Quitar"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-1 text-sm font-bold">
                <span className="text-slate-300">Total estimado</span>
                <span className="text-white text-base">{bs(totalCarrito)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label !text-slate-400 !text-[11px]">Tu nombre (opcional)</label>
                  <input className="input text-sm !py-1.5" placeholder="Ej: María López" value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} />
                </div>
                <div>
                  <label className="label !text-slate-400 !text-[11px]">Departamento (opcional)</label>
                  <select
                    className="input text-sm !py-1.5 cursor-pointer"
                    value={ciudad}
                    onChange={(e) => setCiudad(e.target.value)}
                  >
                    <option value="">— Seleccionar —</option>
                    <option value="La Paz">La Paz</option>
                    <option value="Cochabamba">Cochabamba</option>
                    <option value="Santa Cruz">Santa Cruz</option>
                    <option value="Oruro">Oruro</option>
                    <option value="Potosí">Potosí</option>
                    <option value="Chuquisaca">Chuquisaca (Sucre)</option>
                    <option value="Tarija">Tarija</option>
                    <option value="Beni">Beni</option>
                    <option value="Pando">Pando</option>
                  </select>
                </div>
              </div>
              {msg && <p className="err text-center justify-center">{msg}</p>}
              <button type="button" className="btn-success w-full !py-3 !text-base" onClick={enviarPedido} disabled={enviando}>
                {enviando ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} strokeWidth={2} />}
                <span>{enviando ? 'Generando pedido…' : 'Enviar pedido por WhatsApp'}</span>
              </button>
            </div>
          ) : (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="text-xs text-slate-400 text-center">Agrega el producto al pedido para continuar por WhatsApp</p>
            </div>
          )}
          {p && (
            <ModalReportar
              abierto={mostrarReportar}
              onCerrar={() => setMostrarReportar(false)}
              empresa={{ id_empresa: p.id_empresa, razon_social: p.empresa, slug: p.empresa_slug }}
              producto={{ id_producto: p.id_producto, nombre: p.nombre }}
            />
          )}
        </>
      )}
    </Modal>
  );
}

import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag, MessageCircle, CheckCircle2, Clock, Check, X,
  ChevronDown, ChevronUp, Search, RefreshCw, AlertCircle, Eye,
  Tag, MapPin, User, Calendar, DollarSign, Filter
} from 'lucide-react';
import { api, bs } from '../api.js';
import { toast } from 'sonner';

export default function PedidosEmpresa({ perfil, onActualizado }) {
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [expandido, setExpandido] = useState(null);

  const cargarPedidos = useCallback(async () => {
    setCargando(true);
    try {
      const data = await api('/empresa/pedidos');
      setPedidos(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.message || 'Error al cargar pedidos');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarPedidos();
  }, [cargarPedidos]);

  const toggleExpandir = async (id, yaVisto) => {
    const nuevo = expandido === id ? null : id;
    setExpandido(nuevo);

    if (nuevo && !yaVisto) {
      try {
        await api(`/empresa/pedidos/${id}/marcar-visto`, { method: 'PUT' });
        setPedidos((prev) =>
          prev.map((p) => (p.id === id ? { ...p, visto: true } : p))
        );
        if (onActualizado) onActualizado();
      } catch {
        // silencioso
      }
    }
  };

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await api(`/empresa/pedidos/${id}/estado`, {
        method: 'PUT',
        body: { estado: nuevoEstado },
      });
      toast.success(`Estado actualizado a: ${nuevoEstado.replace(/_/g, ' ')}`);
      setPedidos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, estado: nuevoEstado, visto: true } : p))
      );
      if (onActualizado) onActualizado();
    } catch (err) {
      toast.error(err.message || 'Error al cambiar estado');
    }
  };

  const pedidosFiltrados = pedidos.filter((p) => {
    const coincideEstado = filtroEstado === 'todos' || p.estado === filtroEstado;
    const termino = busqueda.trim().toLowerCase();
    const coincideBusqueda =
      !termino ||
      (p.codigo && p.codigo.toLowerCase().includes(termino)) ||
      (p.nombre_cliente && p.nombre_cliente.toLowerCase().includes(termino)) ||
      (p.ciudad && p.ciudad.toLowerCase().includes(termino));
    return coincideEstado && coincideBusqueda;
  });

  const noVistos = pedidos.filter((p) => !p.visto).length;
  const pendientes = pedidos.filter((p) => p.estado === 'enviado').length;
  const totalEstimado = pedidos
    .filter((p) => p.estado !== 'cancelado')
    .reduce((acc, p) => acc + Number(p.total_estimado || 0), 0);

  const formatFecha = (f) => {
    if (!f) return '—';
    try {
      const d = new Date(f);
      return d.toLocaleString('es-BO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(f);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado de la pestaña */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <ShoppingBag size={20} className="text-cyan-400" />
            <span>Pedidos Recibidos del Catálogo</span>
          </h2>
          <p className="text-xs text-slate-400">
            Pedidos enviados por sus clientes desde la web listos para coordinar y cerrar por WhatsApp
          </p>
        </div>
        <button
          onClick={cargarPedidos}
          className="btn-light text-xs !py-2 !px-3 font-semibold self-start sm:self-auto inline-flex items-center gap-1.5"
          title="Actualizar listado de pedidos"
        >
          <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4 bg-white/[0.04] border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nuevos por revisar</p>
            <p className="text-2xl font-extrabold text-white mt-1">
              {noVistos}
            </p>
          </div>
          <div className={`p-3 rounded-2xl ${noVistos > 0 ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-white/5 text-slate-400'}`}>
            <ShoppingBag size={22} />
          </div>
        </div>

        <div className="card p-4 bg-white/[0.04] border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pendientes de atención</p>
            <p className="text-2xl font-extrabold text-cyan-300 mt-1">
              {pendientes}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-cyan-500/15 text-cyan-400">
            <Clock size={22} />
          </div>
        </div>

        <div className="card p-4 bg-white/[0.04] border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Estimado en Pedidos</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">
              {bs(totalEstimado)}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-400">
            <DollarSign size={22} />
          </div>
        </div>
      </div>

      {/* Barra de filtros y búsqueda */}
      <div className="card p-4 bg-white/[0.04] border-white/10 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0 text-xs">
          {[
            { id: 'todos', etiqueta: 'Todos' },
            { id: 'enviado', etiqueta: 'Pendientes' },
            { id: 'atendido', etiqueta: 'Atendidos' },
            { id: 'convertido_en_venta', etiqueta: 'Ventas Cerradas' },
            { id: 'cancelado', etiqueta: 'Cancelados' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltroEstado(f.id)}
              className={`!py-1.5 !px-3 rounded-xl font-bold transition-all whitespace-nowrap ${
                filtroEstado === f.id
                  ? 'bg-cyan-500 text-slate-900 shadow-md shadow-cyan-500/25'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px] sm:min-w-[260px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            className="input pl-9 text-xs sm:text-sm !py-1.5 !border-white/10"
            placeholder="Buscar por cliente, código, ciudad…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* Listado de pedidos */}
      {cargando ? (
        <div className="card p-12 text-center text-slate-400 text-xs">
          Cargando pedidos…
        </div>
      ) : !pedidosFiltrados.length ? (
        <div className="card p-12 text-center space-y-3 bg-white/[0.03] border-white/10">
          <ShoppingBag size={36} className="mx-auto text-slate-500" />
          <p className="text-sm font-semibold text-white">No se encontraron pedidos</p>
          <p className="text-xs text-slate-400">
            {busqueda || filtroEstado !== 'todos'
              ? 'Intente cambiando los filtros de búsqueda.'
              : 'Cuando los clientes armen un pedido desde su catálogo o portal web, aparecerán aquí con sus productos y desglose.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidosFiltrados.map((p) => {
            const esNuevo = !p.visto;
            const estaAbierto = expandido === p.id;
            const items = Array.isArray(p.items) ? p.items : [];

            return (
              <div
                key={p.id}
                className={`card !p-0 overflow-hidden transition-all border ${
                  esNuevo
                    ? 'border-cyan-500/40 bg-gradient-to-r from-cyan-950/30 via-slate-900/60 to-slate-900/60 shadow-lg shadow-cyan-500/5'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                }`}
              >
                {/* Cabecera del pedido colapsable */}
                <div
                  onClick={() => toggleExpandir(p.id, p.visto)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-extrabold text-cyan-300 text-sm">
                          {p.codigo}
                        </span>
                        {esNuevo && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
                            NUEVO
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            p.estado === 'enviado'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : p.estado === 'atendido'
                              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                              : p.estado === 'convertido_en_venta'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                          }`}
                        >
                          {p.estado === 'convertido_en_venta' ? 'Venta Cerrada' : p.estado.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                        <span className="flex items-center gap-1 font-semibold text-white">
                          <User size={13} className="text-slate-400" />
                          <span>{p.nombre_cliente || 'Cliente Web'}</span>
                        </span>
                        {p.ciudad && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <MapPin size={13} />
                            <span>{p.ciudad}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-slate-400">
                          <Calendar size={13} />
                          <span>{formatFecha(p.creado_en)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                    <div className="text-left sm:text-right">
                      <span className="text-[11px] text-slate-400 block">Total Estimado</span>
                      <span className="text-base font-extrabold text-white font-mono">
                        {bs(p.total_estimado)}
                      </span>
                    </div>
                    <div className="p-1.5 rounded-xl bg-white/5 text-slate-300 hover:text-white">
                      {estaAbierto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                {/* Contenido expandido con items y acciones */}
                {estaAbierto && (
                  <div className="border-t border-white/10 p-4 sm:p-6 bg-black/20 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Tag size={14} />
                      <span>Productos solicitados ({items.length}):</span>
                    </h4>

                    {/* Tabla de ítems del pedido */}
                    <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-white/[0.04] text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/10">
                            <th className="p-3">Producto</th>
                            <th className="p-3 text-center">Cant.</th>
                            <th className="p-3 text-right">P. Estimado</th>
                            <th className="p-3 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {items.map((it, idx) => {
                            const colores = Array.isArray(it.desglose_colores) ? it.desglose_colores : [];
                            return (
                              <tr key={it.id_item || idx} className="hover:bg-white/[0.02]">
                                <td className="p-3">
                                  <span className="font-semibold text-white block">{it.descripcion}</span>
                                  {it.sku && <span className="font-mono text-[10px] text-slate-400">SKU: {it.sku}</span>}
                                  {colores.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {colores.filter((c) => c.cantidad > 0).map((c, i) => (
                                        <span
                                          key={i}
                                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                                        >
                                          {c.cantidad} {c.nombre}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 text-center font-bold text-cyan-300">
                                  {it.cantidad_total}
                                </td>
                                <td className="p-3 text-right font-mono text-slate-300">
                                  {bs(it.precio_unitario)}
                                </td>
                                <td className="p-3 text-right font-extrabold text-white font-mono">
                                  {bs(it.subtotal)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Acciones del pedido */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/10">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-400 font-semibold">Cambiar estado:</span>
                        {p.estado !== 'atendido' && (
                          <button
                            type="button"
                            onClick={() => cambiarEstado(p.id, 'atendido')}
                            className="btn-light !py-1 !px-2.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10 border-cyan-500/30"
                          >
                            Marcar como Atendido
                          </button>
                        )}
                        {p.estado !== 'convertido_en_venta' && (
                          <button
                            type="button"
                            onClick={() => cambiarEstado(p.id, 'convertido_en_venta')}
                            className="btn-light !py-1 !px-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 border-emerald-500/30"
                          >
                            Marcar como Venta Cerrada
                          </button>
                        )}
                        {p.estado !== 'cancelado' && (
                          <button
                            type="button"
                            onClick={() => cambiarEstado(p.id, 'cancelado')}
                            className="btn-light !py-1 !px-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/10 border-rose-500/30"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>

                      {perfil?.whatsapp && (
                        <a
                          href={`https://wa.me/${String(perfil.whatsapp).replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-cta !bg-emerald-600 hover:!bg-emerald-500 text-white font-bold text-xs !py-1.5 !px-3 inline-flex items-center gap-1.5 shadow-md shadow-emerald-600/25"
                        >
                          <MessageCircle size={14} />
                          <span>Abrir WhatsApp Comercial</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

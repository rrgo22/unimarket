import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText, Printer, Download, Store, Phone, MapPin, AlertCircle, Loader2, ArrowLeft, CheckCircle2, MessageCircle
} from 'lucide-react';
import { api } from '../api.js';
import Logo from '../components/Logo.jsx';

export default function ComprobantePublico() {
  const { token } = useParams();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [venta, setVenta] = useState(null);

  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setCargando(true);
      setError('');
      try {
        const data = await api(`/publico/comprobante/${token}/datos`);
        if (!cancelado) {
          setVenta(data);
        }
      } catch (err) {
        if (!cancelado) {
          setError(err.message || 'Comprobante no encontrado o el enlace temporal ha expirado.');
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    if (token) cargar();
    return () => { cancelado = true; };
  }, [token]);

  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const urlPdfA4 = `${backendUrl}/publico/comprobante/${token}?formato=a4`;
  const urlPdfTicket = `${backendUrl}/publico/comprobante/${token}?formato=ticket`;

  const bs = (val) =>
    `Bs ${Number(val || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-start py-10 px-4 sm:px-6 relative z-20">
      <div className="w-full max-w-3xl space-y-6">
        {/* Barra superior de navegación y acciones */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Ir al inicio de UNIMARKET BO</span>
          </Link>

          {venta && (
            <div className="flex items-center gap-2">
              <a
                href={`${urlPdfA4}&descargar=true`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-light text-xs !py-1.5 !px-3 font-semibold"
                title="Descargar comprobante en PDF (A4)"
              >
                <Download size={14} />
                <span>PDF A4</span>
              </a>
              <a
                href={`${urlPdfTicket}&descargar=true`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-light text-xs !py-1.5 !px-3 font-semibold"
                title="Descargar en formato ticket de 80mm"
              >
                <Download size={14} />
                <span>Ticket 80mm</span>
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-cta text-xs !py-1.5 !px-3 font-semibold hidden sm:inline-flex items-center gap-1.5"
              >
                <Printer size={14} />
                <span>Imprimir</span>
              </button>
            </div>
          )}
        </div>

        {cargando ? (
          <div className="card p-16 text-center space-y-4">
            <Loader2 size={36} className="animate-spin text-cyan-400 mx-auto" />
            <p className="text-sm text-slate-300">Cargando comprobante oficial…</p>
          </div>
        ) : error ? (
          <div className="card p-12 text-center space-y-4 border-rose-500/30 bg-rose-500/10">
            <AlertCircle size={40} className="text-rose-400 mx-auto" />
            <h2 className="text-lg font-bold text-white">Comprobante no disponible</h2>
            <p className="text-sm text-rose-200 max-w-md mx-auto leading-relaxed">
              {error}
            </p>
            <p className="text-xs text-slate-400">
              Si considera que esto es un error, por favor contacte a la empresa que emitió su venta.
            </p>
          </div>
        ) : venta ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="card !p-0 overflow-hidden shadow-2xl border-white/15 bg-[#0A102A]"
          >
            {/* Encabezado del comprobante */}
            <div className="p-6 sm:p-8 bg-gradient-to-b from-white/[0.08] to-transparent border-b border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 size={12} className="mr-1" />
                      COMPROBANTE DE COMPRA
                    </span>
                    <span className="text-xs font-mono text-cyan-300 font-bold">
                      {venta.correlativo}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                    {venta.empresa_nombre}
                  </h1>
                  {venta.empresa_nit && (
                    <p className="text-xs text-slate-300 font-mono">
                      NIT: {venta.empresa_nit}
                    </p>
                  )}
                  {venta.empresa_direccion && (
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      <MapPin size={12} className="shrink-0 text-slate-400" />
                      <span>{venta.empresa_direccion}</span>
                    </p>
                  )}
                </div>

                <div className="sm:text-right space-y-1">
                  <p className="text-xs text-slate-400">Fecha de emisión:</p>
                  <p className="text-sm font-semibold text-white">
                    {venta.fecha ? String(venta.fecha).slice(0, 16).replace('T', ' ') : '—'}
                  </p>
                  <div className="pt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/10 text-slate-200 uppercase">
                      Método: {venta.metodo_pago}
                    </span>
                  </div>
                </div>
              </div>

              {/* Datos del Cliente */}
              <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white/[0.02] p-3.5 rounded-xl border border-white/5">
                <div>
                  <span className="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold">Cliente:</span>
                  <span className="font-bold text-white text-sm">{venta.nombre_cliente}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold">NIT / CI:</span>
                  <span className="font-mono text-white text-sm">{venta.nit_ci_cliente || '0'}</span>
                </div>
              </div>
            </div>

            {/* Tabla de Productos / Ítems */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="pb-3">Descripción</th>
                      <th className="pb-3 text-center">Cant.</th>
                      <th className="pb-3 text-right">P. Unitario</th>
                      <th className="pb-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs sm:text-sm">
                    {venta.items?.map((it, idx) => (
                      <tr key={it.id_venta_item || idx} className="hover:bg-white/[0.02]">
                        <td className="py-3 pr-2">
                          <span className="font-semibold text-white block">{it.descripcion}</span>
                          {it.sku && <span className="font-mono text-[11px] text-slate-400">SKU: {it.sku}</span>}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-cyan-300">
                          {it.cantidad}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300 font-mono">
                          {bs(it.precio_unitario)}
                        </td>
                        <td className="py-3 pl-2 text-right font-extrabold text-white font-mono">
                          {bs(it.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totales */}
              <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  {venta.total_literal && (
                    <p className="text-xs text-slate-400 italic">
                      Son: {venta.total_literal}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500">
                    Comprobante generado en la plataforma UNIMARKET BO
                  </p>
                </div>

                <div className="w-full sm:w-auto bg-white/[0.05] border border-white/10 rounded-xl p-4 sm:min-w-[220px] text-right space-y-1">
                  <div className="flex justify-between sm:justify-end gap-4 text-xs text-slate-400">
                    <span>Subtotal:</span>
                    <span className="font-mono text-white">{bs(venta.subtotal)}</span>
                  </div>
                  {Number(venta.descuento) > 0 && (
                    <div className="flex justify-between sm:justify-end gap-4 text-xs text-amber-300">
                      <span>Descuento:</span>
                      <span className="font-mono">-{bs(venta.descuento)}</span>
                    </div>
                  )}
                  <div className="flex justify-between sm:justify-end gap-4 text-base font-extrabold text-emerald-400 pt-1 border-t border-white/10">
                    <span>TOTAL:</span>
                    <span className="font-mono">{bs(venta.total)}</span>
                  </div>
                </div>
              </div>

              {/* Botones de pie */}
              <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <a
                    href={urlPdfA4}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-cta text-xs !py-2.5 !px-4 font-bold flex items-center gap-2"
                  >
                    <Download size={15} />
                    <span>Descargar PDF Oficial</span>
                  </a>
                </div>

                {venta.empresa_whatsapp && (
                  <a
                    href={`https://wa.me/${String(venta.empresa_whatsapp).replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-light !text-emerald-400 !border-emerald-500/30 hover:!bg-emerald-500/10 text-xs !py-2 !px-3 font-semibold inline-flex items-center gap-1.5"
                  >
                    <MessageCircle size={15} />
                    <span>Contactar a {venta.empresa_nombre}</span>
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

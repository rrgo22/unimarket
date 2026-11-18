import { useState, useEffect } from 'react';
import {
  X, Share2, MessageCircle, Mail, Copy, Check, Send, Loader2, AlertCircle, CheckCircle2, ExternalLink, Printer
} from 'lucide-react';
import { api, bs } from '../api.js';
import { toast } from 'sonner';

export default function ModalEnviarComprobante({ venta, abierto, onCerrar }) {
  const [cargando, setCargando] = useState(true);
  const [datosCompartir, setDatosCompartir] = useState(null);
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [correoEnviado, setCorreoEnviado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [errorCorreo, setErrorCorreo] = useState('');

  useEffect(() => {
    let cancelado = false;
    if (abierto && venta?.id_venta) {
      setCargando(true);
      setErrorCorreo('');
      setCorreoEnviado(false);
      api(`/empresa/ventas/${venta.id_venta}/compartir`)
        .then((data) => {
          if (!cancelado) {
            setDatosCompartir(data);
            setTelefono(data.cliente_telefono || '');
            setCorreo(data.cliente_correo || '');
          }
        })
        .catch((err) => {
          if (!cancelado) {
            toast.error(err.message || 'Error al obtener datos de enlace');
          }
        })
        .finally(() => {
          if (!cancelado) setCargando(false);
        });
    }
    return () => { cancelado = true; };
  }, [abierto, venta?.id_venta]);

  if (!abierto || !venta) return null;

  const urlComprobante = datosCompartir?.url_comprobante || '';
  const correlativo = venta.correlativo || (venta.numero_formato ? `VTA-${venta.numero_formato}` : `VTA-${venta.id_venta}`);

  const copiarEnlace = async () => {
    if (!urlComprobante) return;
    try {
      await navigator.clipboard.writeText(urlComprobante);
      setCopiado(true);
      toast.success('Enlace copiado al portapapeles');
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error('No se pudo copiar automáticamente');
    }
  };

  const abrirWhatsApp = () => {
    let numLimpio = String(telefono || '').replace(/\D/g, '');
    if (!numLimpio) {
      toast.error('Ingrese un número de teléfono o WhatsApp');
      return;
    }
    if (!numLimpio.startsWith('591') && numLimpio.length === 8) {
      numLimpio = `591${numLimpio}`;
    }

    const mensaje = datosCompartir?.mensaje_whatsapp ||
      `Hola ${venta.cliente_nombre || 'Cliente'}, le compartimos su comprobante de compra ${correlativo} por ${bs(venta.total)}: ${urlComprobante}\n¡Muchas gracias por su preferencia!`;

    const url = `https://wa.me/${numLimpio}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  const enviarPorCorreo = async (e) => {
    e.preventDefault();
    if (!correo.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      setErrorCorreo('Ingrese un correo electrónico válido');
      return;
    }

    setErrorCorreo('');
    setEnviandoCorreo(true);
    try {
      await api(`/empresa/ventas/${venta.id_venta}/enviar-correo`, {
        method: 'POST',
        body: { correo: correo.trim() },
      });
      setCorreoEnviado(true);
      toast.success(`Comprobante enviado a ${correo.trim()}`);
    } catch (err) {
      setErrorCorreo(err.message || 'Error al enviar comprobante por correo');
    } finally {
      setEnviandoCorreo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0c1638] border border-white/20 p-6 sm:p-7 space-y-6 shadow-2xl overflow-hidden">
        {/* Línea de resplandor superior */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent" />

        {/* Encabezado */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Share2 size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Enviar Comprobante al Cliente</span>
              </h2>
              <p className="text-xs text-slate-300">
                {correlativo} · <span className="font-semibold text-white">{venta.cliente_nombre || 'Cliente General'}</span> · <strong className="text-emerald-300">{bs(venta.total)}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {cargando ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 size={32} className="animate-spin text-emerald-400 mx-auto" />
            <p className="text-xs text-slate-300">Generando enlace público seguro…</p>
          </div>
        ) : (
          <div className="space-y-5 text-xs sm:text-sm">
            {/* OPCIÓN 1: WHATSAPP */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-3">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase tracking-wider">
                <MessageCircle size={16} />
                <span>1. Enviar por WhatsApp (Chat Directo)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Abre el chat de WhatsApp con el mensaje pre-cargado y el enlace público al comprobante oficial:
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="grow">
                  <input
                    type="text"
                    className="input text-xs sm:text-sm !border-emerald-500/30 focus:!border-emerald-400"
                    placeholder="Número de WhatsApp (ej. 77712345)"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={abrirWhatsApp}
                  className="btn-cta !bg-emerald-600 hover:!bg-emerald-500 text-white font-bold !py-2 !px-4 shrink-0 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25"
                >
                  <MessageCircle size={16} />
                  <span>Abrir WhatsApp</span>
                </button>
              </div>
            </div>

            {/* OPCIÓN 2: CORREO ELECTRÓNICO */}
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 space-y-3">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
                <Mail size={16} />
                <span>2. Enviar por Correo Electrónico</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Envía una copia del comprobante en plantilla oficial con enlace directo para descargar el PDF:
              </p>

              {correoEnviado ? (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>¡Comprobante enviado exitosamente por correo a <strong>{correo}</strong>!</span>
                </div>
              ) : (
                <form onSubmit={enviarPorCorreo} className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="grow">
                      <input
                        type="email"
                        className="input text-xs sm:text-sm !border-cyan-500/30 focus:!border-cyan-400"
                        placeholder="cliente@ejemplo.com"
                        value={correo}
                        onChange={(e) => setCorreo(e.target.value)}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={enviandoCorreo}
                      className="btn-cta !bg-cyan-600 hover:!bg-cyan-500 text-white font-bold !py-2 !px-4 shrink-0 flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/25"
                    >
                      {enviandoCorreo ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Enviando…</span>
                        </>
                      ) : (
                        <>
                          <Send size={15} />
                          <span>Enviar por correo</span>
                        </>
                      )}
                    </button>
                  </div>
                  {errorCorreo && (
                    <div className="text-rose-300 text-xs flex items-center gap-1.5 pt-1">
                      <AlertCircle size={14} />
                      <span>{errorCorreo}</span>
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* OPCIÓN 3: ENLACE PÚBLICO TEMPORAL CON TOKEN */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Enlace público seguro (con token temporal de 90 días):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={urlComprobante}
                  className="input text-xs bg-white/[0.04] text-slate-300 font-mono !py-1.5 selection:bg-cyan-500/30"
                  onClick={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={copiarEnlace}
                  className={`btn-light text-xs !py-1.5 !px-3 shrink-0 flex items-center gap-1.5 ${
                    copiado ? '!text-emerald-300 !border-emerald-500/40' : ''
                  }`}
                  title="Copiar enlace"
                >
                  {copiado ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiado ? 'Copiado' : 'Copiar'}</span>
                </button>
                <a
                  href={urlComprobante}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-light text-xs !py-1.5 !px-2.5 shrink-0"
                  title="Abrir enlace en nueva pestaña"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onCerrar}
            className="btn-light text-xs !py-2 !px-4"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

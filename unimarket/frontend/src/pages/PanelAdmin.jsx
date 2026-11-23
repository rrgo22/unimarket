import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
  Building2,
  Clock,
  ShieldCheck,
  Package,
  FileText,
  Check,
  X,
  ExternalLink,
  Plus,
  Trash2,
  Calendar,
  AlertTriangle,
  Loader2,
  Layers,
  ChevronRight,
  Receipt,
  Mail,
  RotateCw,
  RotateCcw,
  Eye,
  Landmark,
  QrCode,
  Banknote,
  Search,
  Pencil,
  Copy,
  Download,
  CheckSquare,
  Square,
  Info,
  ShieldAlert,
  Sparkles,
  MoreVertical,
  MessageCircle,
  Ban,
  CheckCircle2,
  Tag,
} from 'lucide-react';
import { api, bs } from '../api.js';
import Modal from '../components/Modal.jsx';
import ModalConfirmacion from '../components/ModalConfirmacion.jsx';
import Select from '../components/Select.jsx';
import Encabezado from '../components/Encabezado.jsx';

const fecha = (f) => (f ? String(f).slice(0, 10) : '—');

const copiarDato = (texto, etiqueta) => {
  if (!texto || texto === '—') {
    toast.error('No hay información para copiar');
    return;
  }
  navigator.clipboard.writeText(String(texto)).then(
    () => toast.success(`${etiqueta} copiado al portapapeles`),
    () => toast.error('No se pudo copiar al portapapeles')
  );
};

function calcularSLA(fechaStr) {
  if (!fechaStr) return { texto: '—', horas: 0, nivel: 'normal', masDe48: false };
  const d = new Date(fechaStr);
  const ahora = new Date();
  const diffMs = ahora - d;
  const horas = Math.floor(diffMs / (1000 * 60 * 60));
  let nivel = 'normal';
  if (horas >= 48) nivel = 'critico';
  else if (horas >= 24) nivel = 'alerta';

  let texto = 'Hace menos de 1 h';
  if (horas === 1) texto = 'Hace 1 hora';
  else if (horas < 24) texto = `Hace ${horas} h`;
  else {
    const dias = Math.floor(horas / 24);
    const resto = horas % 24;
    texto = `Hace ${dias} d ${resto} h (${horas} h)`;
  }
  return { texto, horas, nivel, masDe48: horas >= 48 };
}

function Verificaciones() {
  const [lista, setLista] = useState([]);
  const [todasSolicitudes, setTodasSolicitudes] = useState([]);
  const [tabFiltro, setTabFiltro] = useState('pendiente'); // 'pendiente' | 'observada' | 'verificada' | 'rechazada' | 'todas'
  const [filtroSla, setFiltroSla] = useState('todos'); // 'todos' | 'normal' | 'alerta' | 'critico'
  const [cargando, setCargando] = useState(false);
  const [reenviandoId, setReenviandoId] = useState(null);

  // Modales
  const [solicitudModal, setSolicitudModal] = useState(null);
  const [modalMotivo, setModalMotivo] = useState(null); // { accion: 'observar'|'rechazar', id: number, razon: string }
  const [procesandoAccion, setProcesandoAccion] = useState(false);
  const [documentoUrl, setDocumentoUrl] = useState(null);

  // Checklist de 3 puntos
  const [checklist, setChecklist] = useState({ nit: false, razon: false, vigente: false });

  const esVerificada = ['verificada', 'verificado', 'aprobada', 'aprobado'].includes(solicitudModal?.estado);

  useEffect(() => {
    let urlActual = null;
    let cancelado = false;

    if (!solicitudModal?.documento) {
      setDocumentoUrl(null);
      return undefined;
    }

    api(`/admin/verificaciones/${solicitudModal.id_verificacion}/pdf`, { raw: true })
      .then((res) => res.blob())
      .then((blob) => {
        if (cancelado) return;
        urlActual = URL.createObjectURL(blob);
        setDocumentoUrl(urlActual);
      })
      .catch(() => {
        if (!cancelado) {
          setDocumentoUrl(null);
          toast.error('No se pudo cargar el documento NIT');
        }
      });

    return () => {
      cancelado = true;
      if (urlActual) URL.revokeObjectURL(urlActual);
    };
  }, [solicitudModal]);

  const cargar = useCallback(() => {
    setCargando(true);
    api('/admin/verificaciones?estado=todas')
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setTodasSolicitudes(arr);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Filtrado según la pestaña activa
  useEffect(() => {
    let filtradas = todasSolicitudes;
    if (tabFiltro === 'pendiente') filtradas = filtradas.filter((v) => v.estado === 'pendiente');
    if (tabFiltro === 'observada') filtradas = filtradas.filter((v) => ['observada', 'observado'].includes(v.estado));
    if (tabFiltro === 'verificada') filtradas = filtradas.filter((v) => ['verificada', 'verificado', 'aprobada', 'aprobado'].includes(v.estado));
    if (tabFiltro === 'rechazada') filtradas = filtradas.filter((v) => ['rechazada', 'rechazado'].includes(v.estado));
    if (filtroSla !== 'todos') filtradas = filtradas.filter((v) => calcularSLA(v.fecha_solicitud).nivel === filtroSla);
    setLista(filtradas);
  }, [tabFiltro, filtroSla, todasSolicitudes]);

  const abrirModalRevision = (v) => {
    setSolicitudModal(v);
    setChecklist({ nit: false, razon: false, vigente: false });
  };

  const ejecutarAccion = async (id, accion, observacion = '') => {
    setProcesandoAccion(true);
    try {
      const r = await api(`/admin/verificaciones/${id}`, {
        method: 'PUT',
        body: { accion, observacion },
      });
      if (accion === 'aprobar') {
        toast.success(
          `Empresa verificada. Código asignado: ${r.codigo_pago || 'UM-XXXX'}. Se envió correo de aprobación con QR bancario.`
        );
      } else if (accion === 'observar') {
        toast.success(`Solicitud observada. Se notificó a la empresa.`);
      } else if (accion === 'rechazar') {
        toast.success(`Solicitud rechazada y empresa notificada.`);
      } else if (accion === 'revertir_pendiente') {
        toast.success(`Solicitud revertida a pendiente.`);
      }
      setSolicitudModal(null);
      setModalMotivo(null);
      if (accion === 'aprobar') setTabFiltro('verificada');
      cargar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setProcesandoAccion(false);
    }
  };

  const reenviarCorreo = async (id) => {
    setReenviandoId(id);
    try {
      const r = await api(`/admin/verificaciones/${id}/reenviar-correo`, { method: 'POST' });
      toast.success(r.mensaje || `Correo de notificación reenviado con éxito.`);
      cargar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setReenviandoId(null);
    }
  };

  // Contadores para pestañas
  const conteoPendientes = todasSolicitudes.filter((v) => v.estado === 'pendiente').length;
  const conteoObservadas = todasSolicitudes.filter((v) => ['observada', 'observado'].includes(v.estado)).length;
  const conteoVerificadas = todasSolicitudes.filter((v) => ['verificada', 'verificado', 'aprobada', 'aprobado'].includes(v.estado)).length;
  const conteoRechazadas = todasSolicitudes.filter((v) => ['rechazada', 'rechazado'].includes(v.estado)).length;

  const checklistCompleto = checklist.nit && checklist.razon && checklist.vigente;

  return (
    <div className="space-y-4">
      {/* Pestañas de filtro con badges */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        {[
          { id: 'pendiente', label: 'Pendientes', badge: conteoPendientes, badgeColor: 'bg-amber-500' },
          { id: 'observada', label: 'Observadas', badge: conteoObservadas, badgeColor: 'bg-cyan-500' },
          { id: 'verificada', label: 'Verificadas', badge: conteoVerificadas, badgeColor: 'bg-emerald-500' },
          { id: 'rechazada', label: 'Rechazadas', badge: conteoRechazadas, badgeColor: 'bg-rose-500' },
          { id: 'todas', label: 'Todas las solicitudes', badge: todasSolicitudes.length, badgeColor: 'bg-slate-600' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTabFiltro(t.id)}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              tabFiltro === t.id
                ? 'bg-white/10 text-white border border-white/20 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <span>{t.label}</span>
            <span
              className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.2 text-[10px] font-bold text-white ${t.badgeColor}`}
            >
              {t.badge}
            </span>
          </button>
        ))}
      </div>

      {/* Vista Móvil: Tarjetas apiladas */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
          <Clock size={15} className="text-cyan-300" aria-hidden="true" />
          <span>Semáforo SLA</span>
        </div>
        <select
          value={filtroSla}
          onChange={(e) => setFiltroSla(e.target.value)}
          className="rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100 outline-none transition focus:border-cyan-400"
          aria-label="Filtrar solicitudes por semáforo SLA"
        >
          <option value="todos">Todos los tiempos</option>
          <option value="normal">Verde · menos de 24 h</option>
          <option value="alerta">Amarillo · 24 a 48 h</option>
          <option value="critico">Rojo · más de 48 h</option>
        </select>
        {filtroSla !== 'todos' && (
          <button type="button" onClick={() => setFiltroSla('todos')} className="text-xs font-semibold text-cyan-300 hover:text-white">
            Limpiar filtro
          </button>
        )}
      </div>

      <div className="grid gap-3 md:hidden">
        {lista.map((v) => {
          const sla = calcularSLA(v.fecha_solicitud);
          return (
            <div
              key={v.id_verificacion}
              className={`card p-4 space-y-3 ${
                sla.masDe48 && v.estado === 'pendiente'
                  ? 'border-rose-500/40 bg-rose-500/10'
                  : 'border-white/10 bg-white/[0.04]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-white text-sm">{v.razon_social}</h3>
                  <p className="font-mono text-xs text-slate-400">NIT: {v.nit}</p>
                  <p className="text-xs text-cyan-300 font-medium flex items-center gap-1 mt-0.5">
                    <Mail size={12} aria-hidden="true" />
                    <span>{v.correo || 'Sin correo registrado'}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`badge-${v.estado}`}>{v.estado}</span>
                  {sla.nivel === 'critico' ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                      <AlertTriangle size={11} aria-hidden="true" />
                      &gt;48 horas (SLA)
                    </span>
                  ) : sla.nivel === 'alerta' ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      <Clock size={11} aria-hidden="true" />
                      24-48 horas
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <Clock size={11} aria-hidden="true" />
                      &lt;24 horas
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 bg-white/[0.04] p-2.5 rounded-xl border border-white/10">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Contacto</span>
                  <span>{v.telefono || v.whatsapp || 'Sin teléfono'}</span>
                </div>
                <div>
                  {v.estado === 'pendiente' && (
                    <>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Tiempo</span>
                  <span
                    className={
                      sla.nivel === 'critico'
                        ? 'font-bold text-rose-300'
                        : sla.nivel === 'alerta'
                        ? 'font-bold text-amber-300'
                        : 'text-emerald-300 font-semibold'
                    }
                  >
                    {sla.texto}
                  </span>
                    </>
                  )}
                </div>
              </div>

              {v.codigo_pago && (
                <div className="flex items-center justify-between text-xs bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/20 text-cyan-200">
                  <span className="font-bold">Código de pago:</span>
                  <span className="font-mono font-extrabold text-cyan-300">{v.codigo_pago}</span>
                </div>
              )}

              {v.observacion && (
                <div className="rounded-xl bg-rose-500/10 p-2.5 text-xs text-rose-300 border border-rose-500/20">
                  <span className="font-bold block text-[10px] uppercase">Observación registrada:</span>
                  <span>{v.observacion}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  className="btn-cta flex-1 !py-2 text-xs"
                  onClick={() => abrirModalRevision(v)}
                >
                  <Eye size={14} aria-hidden="true" />
                  <span>{['verificada', 'verificado', 'aprobada', 'aprobado'].includes(v.estado) ? 'Ver NIT' : 'Revisar solicitud'}</span>
                </button>
              </div>
            </div>
          );
        })}

        {!lista.length && !cargando && (
          <div className="card p-8 text-center text-slate-400 text-sm border border-white/10 bg-white/[0.04]">
            Sin solicitudes de verificación en este estado.
          </div>
        )}
      </div>

      {/* Vista Escritorio: Tabla */}
      <div className="card hidden md:block overflow-hidden p-0 border border-white/10 bg-white/[0.04] shadow-2xs">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.06] text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-white/10">
            <tr>
              <th className="p-4">Empresa</th>
              <th className="p-4">NIT</th>
              <th className="p-4">Contacto</th>
              <th className="p-4">Tiempo / SLA</th>
              <th className="p-4">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((v) => {
              const sla = calcularSLA(v.fecha_solicitud);
              return (
                <tr
                  key={v.id_verificacion}
                  className={`border-t border-white/10 hover:bg-white/[0.05] transition-colors ${
                    sla.masDe48 && v.estado === 'pendiente' ? 'bg-rose-500/10' : ''
                  }`}
                >
                  <td className="p-4">
                    <span className="font-bold text-white text-sm block">{v.razon_social}</span>
                    <span className="text-xs text-cyan-300 font-medium flex items-center gap-1 mt-0.5">
                      <Mail size={12} aria-hidden="true" />
                      <span>{v.correo || 'Sin correo'}</span>
                    </span>
                    {v.codigo_pago && (
                      <span className="mt-1 inline-block font-mono text-[11px] font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                        Código: {v.codigo_pago}
                      </span>
                    )}
                    {v.observacion && (
                      <p className="mt-1 text-xs text-rose-300 font-normal">Obs: {v.observacion}</p>
                    )}
                  </td>
                  <td className="p-4 font-mono text-xs text-slate-300">{v.nit}</td>
                  <td className="p-4 text-xs text-slate-300">
                    {v.telefono && <div>Tel: {v.telefono}</div>}
                    {v.whatsapp && <div>WA: {v.whatsapp}</div>}
                    {v.ciudad && <div className="text-slate-400">{v.ciudad}</div>}
                  </td>
                  <td className="p-4 text-xs">
                    <div className="text-slate-200 font-medium">{fecha(v.fecha_solicitud)}</div>
                    {v.estado === 'pendiente' && <div className="mt-1">
                      {sla.nivel === 'critico' ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                          <AlertTriangle size={10} aria-hidden="true" />
                          {sla.texto} (&gt;48h SLA)
                        </span>
                      ) : sla.nivel === 'alerta' ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          <Clock size={10} aria-hidden="true" />
                          {sla.texto} (24-48h)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <Clock size={10} aria-hidden="true" />
                          {sla.texto} (&lt;24h)
                        </span>
                      )}
                    </div>}
                  </td>
                  <td className="p-4">
                    <span className={`badge-${v.estado}`}>{v.estado}</span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      type="button"
                      className="btn-cta !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5"
                      onClick={() => abrirModalRevision(v)}
                    >
                      <Eye size={13} aria-hidden="true" />
                      <span>{['verificada', 'verificado', 'aprobada', 'aprobado'].includes(v.estado) ? 'Ver NIT' : 'Revisar solicitud'}</span>
                    </button>
                    {['verificada', 'verificado', 'aprobada', 'aprobado', 'observada', 'observado', 'rechazada', 'rechazado'].includes(
                      v.estado
                    ) && (
                      <button
                        type="button"
                        className="btn-light !px-2.5 !py-1 text-xs inline-flex items-center gap-1"
                        onClick={() => reenviarCorreo(v.id_verificacion)}
                        disabled={reenviandoId === v.id_verificacion}
                        title="Reenviar correo de notificación"
                      >
                        <RotateCw
                          size={12}
                          className={reenviandoId === v.id_verificacion ? 'animate-spin' : ''}
                          aria-hidden="true"
                        />
                        <span>Reenviar</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!lista.length && !cargando && (
              <tr>
                <td colSpan="6" className="p-12 text-center text-slate-400">
                  Sin solicitudes de verificación en este estado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Completo: Revisar Solicitud NIT */}
      {solicitudModal && (
        <Modal
          abierto={!!solicitudModal}
          onCerrar={() => setSolicitudModal(null)}
          maxWidth="max-w-4xl"
          ariaLabelledBy="rev-nit-title"
          headerPersonalizado={
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-[#0A102A]">
              <div className="flex items-center gap-2 text-white font-bold text-lg">
                <ShieldCheck size={22} className="text-cyan-300" aria-hidden="true" />
                <span id="rev-nit-title">Revisar Solicitud de Verificación</span>
                <span className={`badge-${solicitudModal.estado} ml-2 text-xs`}>
                  {solicitudModal.estado}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSolicitudModal(null)}
                className="text-slate-400 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
                aria-label="Cerrar modal"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          }
        >
          <div className="space-y-6">
            {/* 3 Tarjetas Superiores: Empresa, Contacto, Cuenta */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Tarjeta 1: Empresa */}
              <div className="card p-3.5 space-y-2 border-white/10 bg-white/[0.03]">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1">
                    <Building2 size={13} />
                    <span>Datos Empresa</span>
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between group">
                    <span className="text-slate-400">Razón social:</span>
                    <div className="flex items-center gap-1 font-semibold text-white truncate max-w-[150px]">
                      <span className="truncate">{solicitudModal.razon_social}</span>
                      <button
                        type="button"
                        onClick={() => copiarDato(solicitudModal.razon_social, 'Razón social')}
                        className="text-slate-400 hover:text-cyan-300 p-0.5 rounded"
                        title="Copiar razón social"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between group">
                    <span className="text-slate-400">NIT:</span>
                    <div className="flex items-center gap-1 font-mono font-bold text-white">
                      <span>{solicitudModal.nit}</span>
                      <button
                        type="button"
                        onClick={() => copiarDato(solicitudModal.nit, 'NIT')}
                        className="text-slate-400 hover:text-cyan-300 p-0.5 rounded"
                        title="Copiar NIT"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between group">
                    <span className="text-slate-400">Ciudad:</span>
                    <span className="text-slate-200">{solicitudModal.ciudad || 'No especificada'}</span>
                  </div>
                  <div className="flex items-center justify-between group">
                    <span className="text-slate-400">Dirección:</span>
                    <span className="text-slate-200 truncate max-w-[140px]">
                      {solicitudModal.direccion || 'No especificada'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tarjeta 2: Contacto */}
              <div className="card p-3.5 space-y-2 border-white/10 bg-white/[0.03]">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1">
                    <Mail size={13} />
                    <span>Contacto</span>
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between group">
                    <span className="text-slate-400">Correo:</span>
                    <div className="flex items-center gap-1 text-cyan-300 font-medium truncate max-w-[150px]">
                      <span className="truncate">{solicitudModal.correo}</span>
                      <button
                        type="button"
                        onClick={() => copiarDato(solicitudModal.correo, 'Correo')}
                        className="text-slate-400 hover:text-cyan-300 p-0.5 rounded"
                        title="Copiar correo"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between group">
                    <span className="text-slate-400">Teléfono:</span>
                    <div className="flex items-center gap-1 text-slate-200">
                      <span>{solicitudModal.telefono || '—'}</span>
                      {solicitudModal.telefono && (
                        <button
                          type="button"
                          onClick={() => copiarDato(solicitudModal.telefono, 'Teléfono')}
                          className="text-slate-400 hover:text-cyan-300 p-0.5 rounded"
                          title="Copiar teléfono"
                        >
                          <Copy size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between group">
                    <span className="text-slate-400">WhatsApp:</span>
                    <div className="flex items-center gap-1 text-emerald-300 font-semibold">
                      <span>{solicitudModal.whatsapp || '—'}</span>
                      {solicitudModal.whatsapp && (
                        <button
                          type="button"
                          onClick={() => copiarDato(solicitudModal.whatsapp, 'WhatsApp')}
                          className="text-slate-400 hover:text-cyan-300 p-0.5 rounded"
                          title="Copiar WhatsApp"
                        >
                          <Copy size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tarjeta 3: Cuenta y Código */}
              <div className="card p-3.5 space-y-2 border-white/10 bg-white/[0.03]">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1">
                    <Receipt size={13} />
                    <span>Cuenta y Código</span>
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Código de pago:</span>
                    <div className="flex items-center gap-1 font-mono font-extrabold text-cyan-300">
                      <span>{solicitudModal.codigo_pago || 'Pendiente aprobación'}</span>
                      {solicitudModal.codigo_pago && (
                        <button
                          type="button"
                          onClick={() => copiarDato(solicitudModal.codigo_pago, 'Código de pago')}
                          className="text-slate-400 hover:text-cyan-300 p-0.5 rounded"
                          title="Copiar código de pago"
                        >
                          <Copy size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Solicitado:</span>
                    <span className="text-slate-200">{fecha(solicitudModal.fecha_solicitud)}</span>
                  </div>
                  {!esVerificada && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Transcurrido:</span>
                      <span className="font-semibold text-amber-300">
                        {calcularSLA(solicitudModal.fecha_solicitud).texto}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Visor de PDF Embebido para el NIT */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <FileText size={15} className="text-cyan-300" />
                  <span>Documento de Identificación Tributaria (NIT)</span>
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={documentoUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      if (!documentoUrl) e.preventDefault();
                    }}
                    className="btn-light !py-1 !px-2.5 text-xs inline-flex items-center gap-1"
                  >
                    <ExternalLink size={13} />
                    <span>Abrir en nueva pestaña</span>
                  </a>
                  <a
                    href={documentoUrl || '#'}
                    download={`NIT-${solicitudModal.nit}.pdf`}
                    onClick={(e) => {
                      if (!documentoUrl) e.preventDefault();
                    }}
                    className="btn-light !py-1 !px-2.5 text-xs inline-flex items-center gap-1"
                  >
                    <Download size={13} />
                    <span>Descargar</span>
                  </a>
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-inner">
                <iframe
                  src={documentoUrl || undefined}
                  className="w-full bg-slate-950"
                  style={{ minHeight: '480px', height: '52vh' }}
                  title="Documento NIT de la empresa"
                />
              </div>
            </div>

            {!esVerificada && (
              <>
                {/* Checklist Obligatorio de 3 Puntos */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <ShieldCheck size={16} className={checklistCompleto ? 'text-emerald-400' : 'text-amber-400'} />
                  <span>Checklist de Verificación Legal (Obligatorio para Aprobar)</span>
                </h4>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    checklistCompleto
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {checklistCompleto ? '3 de 3 completados' : `${[checklist.nit, checklist.razon, checklist.vigente].filter(Boolean).length} de 3`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.nit}
                    onChange={(e) => setChecklist((c) => ({ ...c, nit: e.target.checked }))}
                    className="mt-0.5 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-0"
                  />
                  <span className="text-xs text-slate-200 select-none">
                    El <b>NIT declarado</b> coincide exactamente con el documento adjunto.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.razon}
                    onChange={(e) => setChecklist((c) => ({ ...c, razon: e.target.checked }))}
                    className="mt-0.5 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-0"
                  />
                  <span className="text-xs text-slate-200 select-none">
                    La <b>Razón Social</b> corresponde legalmente a la empresa solicitante.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.vigente}
                    onChange={(e) => setChecklist((c) => ({ ...c, vigente: e.target.checked }))}
                    className="mt-0.5 rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-0"
                  />
                  <span className="text-xs text-slate-200 select-none">
                    El documento está <b>vigente, legible</b> y emitido por el SIN / SIAT.
                  </span>
                </label>
              </div>
                </div>
              </>
            )}

            {/* Barra de Acciones */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
              <div className="flex items-center gap-2">
                {!esVerificada && (
                  <>
                <button
                  type="button"
                  className="btn-light text-xs text-rose-300 hover:bg-rose-500/10 border-rose-500/30"
                  onClick={() =>
                    setModalMotivo({
                      accion: 'rechazar',
                      id: solicitudModal.id_verificacion,
                      razon: '',
                    })
                  }
                  disabled={procesandoAccion}
                >
                  <X size={14} />
                  <span>Rechazar</span>
                </button>
                <button
                  type="button"
                  className="btn-light text-xs text-amber-300 hover:bg-amber-500/10 border-amber-500/30"
                  onClick={() =>
                    setModalMotivo({
                      accion: 'observar',
                      id: solicitudModal.id_verificacion,
                      razon: '',
                    })
                  }
                  disabled={procesandoAccion}
                >
                  <AlertTriangle size={14} />
                  <span>Observar</span>
                </button>
                  </>
                )}
                {solicitudModal.estado !== 'pendiente' && (
                  <button
                    type="button"
                    className="btn-light text-xs"
                    onClick={() => ejecutarAccion(solicitudModal.id_verificacion, 'revertir_pendiente')}
                    disabled={procesandoAccion}
                  >
                    <RotateCcw size={14} />
                    <span>Revertir a pendiente</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-light text-xs"
                  onClick={() => setSolicitudModal(null)}
                  disabled={procesandoAccion}
                >
                  Cerrar
                </button>
                {!esVerificada && <button
                  type="button"
                  className="btn-cta text-xs"
                  disabled={!checklistCompleto || procesandoAccion}
                  onClick={() => ejecutarAccion(solicitudModal.id_verificacion, 'aprobar')}
                  title={
                    checklistCompleto
                      ? 'Aprobar verificación y emitir código de pago'
                      : 'Debe marcar todos los puntos del checklist para aprobar'
                  }
                >
                  {procesandoAccion ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>Aprobar verificación y emitir código</span>
                </button>}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal para Observación o Rechazo con Motivo Obligatorio */}
      <ModalConfirmacion
        abierto={!!modalMotivo}
        titulo={modalMotivo?.accion === 'rechazar' ? 'Rechazar solicitud de verificación' : 'Observar solicitud de verificación'}
        mensaje={
          modalMotivo?.accion === 'rechazar'
            ? 'Indique a la empresa los motivos por los cuales se rechaza la solicitud (mínimo 5 caracteres). Se enviará notificación por correo:'
            : 'Indique las observaciones detectadas para que la empresa adjunte el documento corregido (mínimo 5 caracteres):'
        }
        tipo="peligro"
        requiereTexto={true}
        tipoEntrada="textarea"
        placeholderTexto={
          modalMotivo?.accion === 'rechazar'
            ? 'Ej. El documento no coincide con el NIT o no corresponde a una empresa legalmente registrada.'
            : 'Ej. El documento no es legible o se encuentra vencido. Por favor adjunte su certificación digital actualizada.'
        }
        textoBotonConfirmar={modalMotivo?.accion === 'rechazar' ? 'Confirmar Rechazo' : 'Enviar Observación'}
        onConfirmar={(texto) => {
          if (modalMotivo) {
            ejecutarAccion(modalMotivo.id, modalMotivo.accion, texto);
          }
        }}
        onCancelar={() => setModalMotivo(null)}
      />
    </div>
  );
}

function GestionPagos() {
  const [pagos, setPagos] = useState([]);
  const [todosPagos, setTodosPagos] = useState([]);
  const [tabFiltro, setTabFiltro] = useState('en_revision'); // 'en_revision' | 'confirmado' | 'rechazado' | 'todos'
  const [cargando, setCargando] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  // Modales
  const [pagoModal, setPagoModal] = useState(null);
  const [comprobanteUrl, setComprobanteUrl] = useState(null);
  const [verificadoDeposito, setVerificadoDeposito] = useState(false);
  const [modalRechazo, setModalRechazo] = useState(null); // id_pago
  const [modalManual, setModalManual] = useState(false);
  const [empresas, setEmpresas] = useState([]);

  // Formulario manual
  const [manualEmpresa, setManualEmpresa] = useState('');
  const [manualMeses, setManualMeses] = useState(1);
  const [manualMetodo, setManualMetodo] = useState('transferencia');
  const [manualReferencia, setManualReferencia] = useState('');
  const [manualObs, setManualObs] = useState('');
  const [guardandoManual, setGuardandoManual] = useState(false);
  const [procesandoAccion, setProcesandoAccion] = useState(false);

  // iframe/img/a no envían el token Bearer automáticamente.
  // Descargamos el comprobante autenticado y lo mostramos mediante una URL temporal.
  useEffect(() => {
    let urlActual = null;
    let cancelado = false;

    if (!pagoModal?.comprobante) {
      setComprobanteUrl(null);
      return undefined;
    }

    api(`/admin/pagos/${pagoModal.id_pago}/comprobante`, { raw: true })
      .then((res) => res.blob())
      .then((blob) => {
        if (cancelado) return;
        urlActual = URL.createObjectURL(blob);
        setComprobanteUrl(urlActual);
      })
      .catch(() => {
        if (!cancelado) {
          setComprobanteUrl(null);
          toast.error('No se pudo cargar el comprobante de pago');
        }
      });

    return () => {
      cancelado = true;
      if (urlActual) URL.revokeObjectURL(urlActual);
    };
  }, [pagoModal]);

  // Consulta demo-mode
  useEffect(() => {
    api('/admin/config/demo-mode')
      .then((r) => setDemoMode(Boolean(r?.demo_mode)))
      .catch(() => setDemoMode(false));
  }, []);

  const cargar = useCallback(() => {
    setCargando(true);
    api('/admin/pagos')
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setTodosPagos(arr);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setCargando(false));
  }, []);

  // Carga inicial y auto-refresco cada 15 segundos y al volver a la pestaña/foco
  useEffect(() => {
    cargar();
    const interval = setInterval(cargar, 15000);

    const onFocus = () => cargar();
    const onVisChange = () => {
      if (document.visibilityState === 'visible') cargar();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [cargar]);

  // Filtrado según la pestaña activa
  useEffect(() => {
    if (tabFiltro === 'todos') {
      setPagos(todosPagos);
    } else if (tabFiltro === 'en_revision') {
      setPagos(todosPagos.filter((p) => ['en_revision', 'pendiente'].includes(p.estado)));
    } else if (tabFiltro === 'confirmado') {
      setPagos(todosPagos.filter((p) => p.estado === 'confirmado'));
    } else if (tabFiltro === 'rechazado') {
      setPagos(todosPagos.filter((p) => p.estado === 'rechazado'));
    }
  }, [tabFiltro, todosPagos]);

  const abrirModalRevision = (p) => {
    setPagoModal(p);
    setVerificadoDeposito(false);
  };

  const abrirModalManual = async () => {
    try {
      const emps = await api('/admin/empresas');
      setEmpresas(Array.isArray(emps) ? emps : []);
      if (emps.length > 0) setManualEmpresa(String(emps[0].id_empresa));
      setModalManual(true);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const confirmarPago = async (id, razonSocial) => {
    setProcesandoAccion(true);
    try {
      const r = await api(`/admin/pagos/${id}`, {
        method: 'PUT',
        body: { accion: 'confirmar' },
      });
      toast.success(r.mensaje || `Pago de "${razonSocial}" confirmado. Suscripción activada`);
      setPagoModal(null);
      cargar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setProcesandoAccion(false);
    }
  };

  const confirmarRechazoPago = async (observacion) => {
    if (!modalRechazo) return;
    setProcesandoAccion(true);
    try {
      const r = await api(`/admin/pagos/${modalRechazo}`, {
        method: 'PUT',
        body: { accion: 'rechazar', observacion },
      });
      toast.success(r.mensaje || 'Comprobante rechazado y empresa notificada');
      setModalRechazo(null);
      setPagoModal(null);
      cargar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setProcesandoAccion(false);
    }
  };

  const simularPagoDemo = async (idEmpresa) => {
    try {
      const r = await api('/admin/pagos/simular-demo', {
        method: 'POST',
        body: { id_empresa: idEmpresa },
      });
      toast.success(r.mensaje || 'Simulación en modo demo exitosa');
      cargar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const enviarPagoManual = async (e) => {
    e.preventDefault();
    if (!manualEmpresa) {
      toast.error('Debe seleccionar una empresa');
      return;
    }
    setGuardandoManual(true);
    try {
      const res = await api('/admin/pagos/manual', {
        method: 'POST',
        body: {
          id_empresa: parseInt(manualEmpresa, 10),
          meses: parseInt(manualMeses, 10),
          metodo: manualMetodo,
          referencia: manualReferencia,
          observacion: manualObs,
        },
      });
      toast.success(res.mensaje || 'Pago manual registrado y suscripción activada');
      setModalManual(false);
      setManualReferencia('');
      setManualObs('');
      cargar();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGuardandoManual(false);
    }
  };

  const conteoRevision = todosPagos.filter((p) => ['en_revision', 'pendiente'].includes(p.estado)).length;
  const conteoConfirmados = todosPagos.filter((p) => p.estado === 'confirmado').length;
  const conteoRechazados = todosPagos.filter((p) => p.estado === 'rechazado').length;

  return (
    <div className="space-y-4">
      {/* Barra superior con filtros y botón manual */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'en_revision', label: 'En revisión', badge: conteoRevision, badgeColor: 'bg-violet-500' },
            { id: 'confirmado', label: 'Confirmados', badge: conteoConfirmados, badgeColor: 'bg-emerald-500' },
            { id: 'rechazado', label: 'Rechazados', badge: conteoRechazados, badgeColor: 'bg-rose-500' },
            { id: 'todos', label: 'Todos los pagos', badge: todosPagos.length, badgeColor: 'bg-slate-600' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTabFiltro(t.id)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                tabFiltro === t.id
                  ? 'bg-white/10 text-white border border-white/20 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.2 text-[10px] font-bold text-white ${t.badgeColor}`}
              >
                {t.badge}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-cta !py-2 text-xs sm:text-sm" onClick={abrirModalManual}>
            <Plus size={16} aria-hidden="true" />
            <span>Registrar pago manual</span>
          </button>
        </div>
      </div>

      {/* Vista Móvil: Tarjetas */}
      <div className="grid gap-3 md:hidden">
        {pagos.map((p) => (
          <div key={p.id_pago} className="card p-4 space-y-3 border-white/10 bg-white/[0.04]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-white text-sm">{p.razon_social}</h3>
                <p className="font-mono text-xs text-slate-400">NIT: {p.nit}</p>
                <p className="text-xs text-cyan-300 font-medium flex items-center gap-1 mt-0.5">
                  <Mail size={12} aria-hidden="true" />
                  <span>{p.correo}</span>
                </p>
                {p.codigo_pago && (
                  <span className="mt-1 inline-block font-mono text-[11px] font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    Código: {p.codigo_pago}
                  </span>
                )}
              </div>
              <span className={`badge-${p.estado}`}>{p.estado}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-white/[0.04] p-3 rounded-xl border border-white/10">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Monto</span>
                <span className="font-bold text-white">{bs(p.monto)}</span>
                <span className="text-slate-400 block text-[11px]">({p.meses} mes)</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Método / Ref</span>
                <span className="font-semibold text-slate-200 uppercase">{p.metodo}</span>
                <span className="text-slate-400 block text-[11px] truncate">{p.referencia || 'Sin referencia'}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                className="btn-cta flex-1 !py-2 text-xs inline-flex items-center justify-center gap-1.5"
                onClick={() => abrirModalRevision(p)}
              >
                <Eye size={14} />
                <span>Revisar pago</span>
              </button>

              {demoMode && (
                <button
                  type="button"
                  className="btn-light text-[11px] text-cyan-300 border-cyan-500/30"
                  onClick={() => simularPagoDemo(p.id_empresa)}
                  title="Simulación exclusiva para pruebas"
                >
                  <Sparkles size={12} />
                  <span>Demo</span>
                </button>
              )}
            </div>
          </div>
        ))}

        {!pagos.length && !cargando && (
          <div className="card p-8 text-center text-slate-400 text-sm border border-white/10 bg-white/[0.04]">
            Sin pagos en este estado.
          </div>
        )}
      </div>

      {/* Vista Escritorio: Tabla */}
      <div className="card hidden md:block overflow-hidden p-0 border border-white/10 bg-white/[0.04] shadow-2xs">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.06] text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-white/10">
            <tr>
              <th className="p-4">Empresa</th>
              <th className="p-4">Monto</th>
              <th className="p-4">Método / Banco</th>
              <th className="p-4">Referencia</th>
              <th className="p-4">Fecha</th>
              <th className="p-4">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((p) => (
              <tr key={p.id_pago} className="border-t border-white/10 hover:bg-white/[0.05] transition-colors">
                <td className="p-4">
                  <span className="font-bold text-white text-sm block">{p.razon_social}</span>
                  <span className="text-xs font-mono text-slate-400">NIT: {p.nit}</span>
                  <span className="text-xs text-cyan-300 block mt-0.5">{p.correo}</span>
                  {p.codigo_pago && (
                    <span className="mt-1 inline-block font-mono text-[11px] font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      Código: {p.codigo_pago}
                    </span>
                  )}
                </td>
                <td className="p-4">
                  <span className="font-extrabold text-white">{bs(p.monto)}</span>
                  <span className="text-xs text-slate-400 block">({p.meses} mes)</span>
                </td>
                <td className="p-4">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-slate-200 border border-white/10 capitalize">
                    {p.metodo === 'qr' && <QrCode size={12} />}
                    {p.metodo === 'transferencia' && <Landmark size={12} />}
                    {p.metodo === 'efectivo' && <Banknote size={12} />}
                    <span>{p.metodo}</span>
                  </span>
                  {p.banco && <span className="block text-[11px] text-slate-400 mt-1">{p.banco}</span>}
                </td>
                <td className="p-4 font-mono text-xs text-slate-300">
                  {p.referencia || <span className="text-slate-500">—</span>}
                </td>
                <td className="p-4 text-xs text-slate-400">{fecha(p.fecha_pago || p.fecha)}</td>
                <td className="p-4">
                  <span className={`badge-${p.estado}`}>{p.estado}</span>
                  {p.es_demo && (
                    <span className="block text-[10px] text-cyan-400 mt-1 font-mono font-bold">[DEMO]</span>
                  )}
                </td>
                <td className="p-4 text-right space-x-2">
                  <button
                    type="button"
                    className="btn-cta !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5"
                    onClick={() => abrirModalRevision(p)}
                  >
                    <Eye size={13} aria-hidden="true" />
                    <span>Revisar pago</span>
                  </button>
                  {demoMode && (
                    <button
                      type="button"
                      className="btn-light !px-2.5 !py-1 text-xs text-cyan-300 border-cyan-500/30"
                      onClick={() => simularPagoDemo(p.id_empresa)}
                      title="Simular confirmación en MODO DEMO"
                    >
                      <Sparkles size={12} />
                      <span>Demo</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!pagos.length && !cargando && (
              <tr>
                <td colSpan="7" className="p-12 text-center text-slate-400">
                  Sin pagos registrados en este estado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Revisar Pago con Comprobante y Validación */}
      {pagoModal && (
        <Modal
          abierto={!!pagoModal}
          onCerrar={() => setPagoModal(null)}
          maxWidth="max-w-4xl"
          ariaLabelledBy="rev-pago-title"
          headerPersonalizado={
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-[#0A102A]">
              <div className="flex items-center gap-2 text-white font-bold text-lg">
                <Receipt size={22} className="text-cyan-300" aria-hidden="true" />
                <span id="rev-pago-title">Revisión de Comprobante de Pago</span>
                <span className={`badge-${pagoModal.estado} ml-2 text-xs`}>{pagoModal.estado}</span>
              </div>
              <button
                type="button"
                onClick={() => setPagoModal(null)}
                className="text-slate-400 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
                aria-label="Cerrar modal"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Badges de Validación Automática */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div
                className={`p-2.5 rounded-xl border text-xs font-bold text-center ${
                  Number(pagoModal.monto) === 200
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                }`}
              >
                <span className="block text-[10px] uppercase font-bold text-slate-400">Monto Declarado</span>
                <span>{bs(pagoModal.monto)}</span>
                <span className="block text-[10px] font-normal mt-0.5">
                  {Number(pagoModal.monto) === 200 ? 'Monto exacto Bs 200' : 'Monto diferente'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-xs font-bold text-center text-cyan-200">
                <span className="block text-[10px] uppercase font-bold text-slate-400">Código de Pago</span>
                <span className="font-mono">{pagoModal.codigo_pago || '—'}</span>
                <span className="block text-[10px] font-normal mt-0.5">Asignado a la empresa</span>
              </div>

              <div className="p-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-xs font-bold text-center text-slate-200">
                <span className="block text-[10px] uppercase font-bold text-slate-400">Referencia</span>
                <span className="font-mono truncate block max-w-full">{pagoModal.referencia || 'Sin ref'}</span>
                <span className="block text-[10px] font-normal text-slate-400 mt-0.5">Única</span>
              </div>

              <div className="p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-xs font-bold text-center text-emerald-300">
                <span className="block text-[10px] uppercase font-bold text-slate-400">Fecha del Depósito</span>
                <span>{fecha(pagoModal.fecha_pago || pagoModal.fecha)}</span>
                <span className="block text-[10px] font-normal mt-0.5">
                  {pagoModal.horas_espera ? `Espera: ${pagoModal.horas_espera}h` : 'Reciente'}
                </span>
              </div>
            </div>

            {/* Vista del Comprobante y Datos Declarados en 2 Columnas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Columna Izquierda: Visor del Comprobante */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <FileText size={14} className="text-cyan-300" />
                    <span>Archivo Comprobante</span>
                  </span>
                  {pagoModal.comprobante && (
                    <a
                      href={comprobanteUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => {
                        if (!comprobanteUrl) e.preventDefault();
                      }}
                      className="text-xs text-cyan-300 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink size={12} />
                      <span>Abrir original</span>
                    </a>
                  )}
                </div>

                <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center min-h-[320px]">
                  {pagoModal.comprobante ? (
                    pagoModal.comprobante.toLowerCase().endsWith('.pdf') ? (
                      <iframe
                        src={comprobanteUrl}
                        className="w-full h-[360px]"
                        title="Comprobante PDF"
                      />
                    ) : (
                      <img
                        src={comprobanteUrl}
                        alt="Comprobante de depósito"
                        className="max-h-[360px] w-auto object-contain p-2"
                      />
                    )
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      <Receipt size={32} className="mx-auto mb-2 text-slate-500" />
                      <span>No se adjuntó archivo (pago registrado manualmente)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Columna Derecha: Datos de la Empresa y Transferencia */}
              <div className="space-y-3">
                <div className="card p-4 space-y-2 border-white/10 bg-white/[0.03]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 border-b border-white/10 pb-1.5">
                    Datos Declarados por la Empresa
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Razón social:</span>
                      <span className="font-bold text-white">{pagoModal.razon_social}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">NIT:</span>
                      <span className="font-mono text-slate-200">{pagoModal.nit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Banco declarado:</span>
                      <span className="text-white font-medium">{pagoModal.banco || 'Banco Unión'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Método de pago:</span>
                      <span className="text-slate-200 uppercase font-semibold">{pagoModal.metodo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Referencia:</span>
                      <span className="font-mono font-bold text-cyan-300">{pagoModal.referencia || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Suscripción actual:</span>
                      <span className="text-amber-300 font-semibold">{pagoModal.suscripcion_estado || 'pendiente_pago'}</span>
                    </div>
                    {pagoModal.observacion && (
                      <div className="pt-2 border-t border-white/10 text-slate-300">
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Nota declarada:</span>
                        <p className="mt-0.5">{pagoModal.observacion}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Checkbox Obligatorio */}
                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3.5 space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={verificadoDeposito}
                      onChange={(e) => setVerificadoDeposito(e.target.checked)}
                      className="mt-1 rounded border-cyan-400/40 bg-slate-900 text-cyan-500 focus:ring-0"
                    />
                    <span className="text-xs text-cyan-100 font-medium leading-relaxed">
                      <b>He verificado el depósito:</b> Confirmo que los <b>Bs {pagoModal.monto}</b> ingresaron
                      efectivamente a la cuenta bancaria de UNIMARKET BO con la referencia declarada.
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Acciones de Validación */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                className="btn-light text-xs text-rose-300 hover:bg-rose-500/10 border-rose-500/30"
                onClick={() => setModalRechazo(pagoModal.id_pago)}
                disabled={procesandoAccion}
              >
                <X size={14} />
                <span>Rechazar comprobante</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-light text-xs"
                  onClick={() => setPagoModal(null)}
                  disabled={procesandoAccion}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className="btn-cta text-xs"
                  disabled={!verificadoDeposito || procesandoAccion}
                  onClick={() => confirmarPago(pagoModal.id_pago, pagoModal.razon_social)}
                >
                  {procesandoAccion ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>Confirmar pago y activar suscripción (30 días)</span>
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal para Observación de Rechazo de Pago */}
      <ModalConfirmacion
        abierto={!!modalRechazo}
        titulo="Rechazar comprobante de pago"
        mensaje="Indique el motivo por el cual se rechaza el comprobante (mínimo 5 caracteres). Se revertirá la empresa a pendiente de pago y se le enviará un correo con este motivo:"
        tipo="peligro"
        requiereTexto={true}
        tipoEntrada="textarea"
        placeholderTexto="Ej. El número de transacción no coincide con los extractos bancarios o el comprobante es ilegible."
        textoBotonConfirmar="Rechazar comprobante"
        onConfirmar={confirmarRechazoPago}
        onCancelar={() => setModalRechazo(null)}
      />

      {/* Modal para Registrar Pago Manual */}
      <Modal
        abierto={modalManual}
        onCerrar={() => setModalManual(false)}
        maxWidth="max-w-lg"
        ariaLabelledBy="man-pago-title"
        headerPersonalizado={
          <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-white/10 bg-[#0E1A44]">
            <div className="flex items-center gap-2 text-white font-bold text-lg">
              <Receipt size={20} className="text-cyan-300" aria-hidden="true" />
              <span id="man-pago-title">Registrar pago manual</span>
            </div>
            <button
              type="button"
              onClick={() => setModalManual(false)}
              className="text-slate-400 hover:text-white hover:bg-white/10 rounded-lg p-1 transition-colors"
              aria-label="Cerrar modal"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        }
      >
        <form onSubmit={enviarPagoManual} className="space-y-4">
          <div className="space-y-1">
            <label className="label text-xs font-bold uppercase" htmlFor="man-empresa">
              Empresa
            </label>
            <Select
              id="man-empresa"
              name="empresa"
              value={manualEmpresa}
              options={empresas.map((em) => ({
                value: String(em.id_empresa),
                label: `${em.razon_social} (NIT: ${em.nit})`,
                sublabel: `Suscripción: ${em.suscripcion} - Código: ${em.codigo_pago || 'Sin código'}`,
              }))}
              onChange={(e) => setManualEmpresa(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="label text-xs font-bold uppercase" htmlFor="man-meses">
                Meses de suscripción
              </label>
              <Select
                id="man-meses"
                name="meses"
                value={String(manualMeses)}
                options={[
                  { value: '1', label: '1 mes (Bs 200)' },
                  { value: '2', label: '2 meses (Bs 400)' },
                  { value: '3', label: '3 meses (Bs 600)' },
                  { value: '6', label: '6 meses (Bs 1.200)' },
                  { value: '12', label: '12 meses (Bs 2.400)' },
                ]}
                onChange={(e) => setManualMeses(parseInt(e.target.value, 10))}
              />
            </div>
            <div className="space-y-1">
              <label className="label text-xs font-bold uppercase" htmlFor="man-metodo">
                Método
              </label>
              <Select
                id="man-metodo"
                name="metodo"
                value={manualMetodo}
                options={[
                  { value: 'transferencia', label: 'Transferencia bancaria' },
                  { value: 'qr', label: 'Pago por QR' },
                  { value: 'efectivo', label: 'Efectivo / En oficina' },
                ]}
                onChange={(e) => setManualMetodo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="label text-xs font-bold uppercase" htmlFor="man-ref">
              Referencia / Nro. de transacción (opcional)
            </label>
            <input
              id="man-ref"
              className="input text-sm font-mono"
              placeholder="Ej. REC-2026-004 o Nro. Transferencia"
              value={manualReferencia}
              onChange={(e) => setManualReferencia(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="label text-xs font-bold uppercase" htmlFor="man-obs">
              Observación o nota (opcional)
            </label>
            <input
              id="man-obs"
              className="input text-sm"
              placeholder="Ej. Pago verificado directamente con el extracto bancario"
              value={manualObs}
              onChange={(e) => setManualObs(e.target.value)}
            />
          </div>

          <div className="rounded-xl bg-cyan-500/10 p-3 text-xs text-cyan-200 border border-cyan-500/20">
            Al confirmar, la suscripción de la empresa pasará a <b>activa</b> por <b>{manualMeses * 30} días</b> y se le
            enviará un correo de confirmación de pago.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              className="btn-light text-xs"
              onClick={() => setModalManual(false)}
              disabled={guardandoManual}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-cta text-xs" disabled={guardandoManual}>
              {guardandoManual ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              <span>{guardandoManual ? 'Guardando…' : 'Registrar y activar suscripción'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// Devuelve la configuración de badge y botones de acción según el estado de la suscripción
function configEstadoSuscripcion(estado) {
  switch (estado) {
    case 'activa':
      return {
        badge: <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><Check size={11} />Activa</span>,
        acciones: ['suspender'],
      };
    case 'suspendida':
      return {
        badge: <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">Suspendida</span>,
        acciones: ['activar'],
      };
    case 'vencida':
      return {
        badge: <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">Vencida</span>,
        acciones: ['activar', 'suspender'],
      };
    case 'en_revision':
    case 'pendiente_pago':
      return {
        badge: <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">Pendiente de pago</span>,
        acciones: ['activar'],
      };
    default:
      return {
        badge: <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-slate-500/15 text-slate-400 border border-slate-500/30">{estado}</span>,
        acciones: ['activar'],
      };
  }
}

function MenuTresPuntos({ empresa, onMarcarVencida, onEliminar }) {
  const [abierto, setAbierto] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const toggle = (ev) => {
    ev.stopPropagation();
    if (!abierto && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuWidth = 192; // 12rem = 192px
      const menuHeight = 96;
      let top = rect.bottom + 4;
      // Si sobrepasa la parte inferior de la ventana, abrirlo hacia arriba
      if (rect.bottom + menuHeight > window.innerHeight) {
        top = Math.max(10, rect.top - menuHeight - 4);
      }
      let left = rect.right - menuWidth;
      if (left < 10) left = 10;
      setCoords({ top, left });
    }
    setAbierto((v) => !v);
  };

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (ev) => {
      if (
        menuRef.current && !menuRef.current.contains(ev.target) &&
        btnRef.current && !btnRef.current.contains(ev.target)
      ) {
        setAbierto(false);
      }
    };
    const cerrarOnScroll = () => setAbierto(false);
    document.addEventListener('mousedown', cerrar);
    window.addEventListener('scroll', cerrarOnScroll, true);
    window.addEventListener('resize', cerrarOnScroll);
    return () => {
      document.removeEventListener('mousedown', cerrar);
      window.removeEventListener('scroll', cerrarOnScroll, true);
      window.removeEventListener('resize', cerrarOnScroll);
    };
  }, [abierto]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="Más opciones de empresa"
        onClick={toggle}
        className={`btn-light !px-2.5 !py-1 text-xs transition-colors ${
          abierto ? '!bg-white/20 !text-white border-cyan-400/40' : '!text-slate-400 hover:!text-white'
        }`}
        aria-haspopup="true"
        aria-expanded={abierto}
      >
        <MoreVertical size={14} />
      </button>
      {abierto &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 99999,
            }}
            className="w-48 rounded-xl border border-white/20 bg-[#0E1A44] shadow-2xl overflow-hidden py-1 backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-amber-300 hover:bg-white/[0.08] transition-colors text-left"
              onClick={() => {
                onMarcarVencida(empresa);
                setAbierto(false);
              }}
            >
              <Calendar size={14} aria-hidden="true" />
              <span>Marcar como vencida</span>
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors text-left"
              onClick={() => {
                onEliminar(empresa);
                setAbierto(false);
              }}
            >
              <Trash2 size={14} aria-hidden="true" />
              <span>Mover a la papelera</span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
}

function Empresas() {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);

  // Modal Activar: { emp, fechaVencimiento }
  const [modalActivar, setModalActivar] = useState(null);
  const [motivoActivar, setMotivoActivar] = useState('');
  const [guardandoActivar, setGuardandoActivar] = useState(false);

  // Modal Suspender: { emp }
  const [modalSuspender, setModalSuspender] = useState(null);
  const [motivoSuspender, setMotivoSuspender] = useState('');
  const [guardandoSuspender, setGuardandoSuspender] = useState(false);

  // Modal Eliminar
  const [modalEliminar, setModalEliminar] = useState(null);
  const [motivoEliminar, setMotivoEliminar] = useState('');
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    setErrorCarga(null);
    api('/admin/empresas')
      .then((data) => setLista(Array.isArray(data) ? data : []))
      .catch((e) => { setErrorCarga(e.message); toast.error(e.message, { id: 'admin-empresas-err' }); })
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Actualiza la fila de empresa en la lista local sin recargar todo
  const actualizarFila = (id_empresa, cambios) => {
    setLista((prev) => prev.map((e) => e.id_empresa === id_empresa ? { ...e, ...cambios } : e));
  };

  const fechaDefault30Dias = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  };

  const abrirActivar = (emp) => {
    setMotivoActivar('');
    setModalActivar({ emp, fechaVencimiento: fechaDefault30Dias() });
  };

  const confirmarActivar = async () => {
    if (!modalActivar) return;
    setGuardandoActivar(true);
    try {
      const r = await api(`/admin/empresas/${modalActivar.emp.id_empresa}/suscripcion`, {
        method: 'PUT',
        body: {
          estado: 'activa',
          fecha_vencimiento: modalActivar.fechaVencimiento,
          motivo: motivoActivar || 'Activación manual por administración',
        },
      });
      toast.success(`Suscripción de "${modalActivar.emp.razon_social}" activada hasta ${r.fecha_vencimiento ? String(r.fecha_vencimiento).slice(0, 10) : modalActivar.fechaVencimiento}.`);
      actualizarFila(modalActivar.emp.id_empresa, {
        suscripcion: 'activa',
        fecha_vencimiento: r.fecha_vencimiento || modalActivar.fechaVencimiento,
      });
      setModalActivar(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGuardandoActivar(false);
    }
  };

  const abrirSuspender = (emp) => {
    setMotivoSuspender('');
    setModalSuspender({ emp });
  };

  const confirmarSuspender = async () => {
    if (!modalSuspender) return;
    if (!motivoSuspender.trim() || motivoSuspender.trim().length < 5) {
      toast.error('Debe indicar el motivo de la suspensión (mínimo 5 caracteres)');
      return;
    }
    setGuardandoSuspender(true);
    try {
      await api(`/admin/empresas/${modalSuspender.emp.id_empresa}/suscripcion`, {
        method: 'PUT',
        body: { estado: 'suspendida', motivo: motivoSuspender.trim() },
      });
      toast.success(`Suscripción de "${modalSuspender.emp.razon_social}" suspendida.`);
      actualizarFila(modalSuspender.emp.id_empresa, { suscripcion: 'suspendida' });
      setModalSuspender(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGuardandoSuspender(false);
    }
  };

  const marcarVencida = async (emp) => {
    try {
      await api(`/admin/empresas/${emp.id_empresa}/suscripcion`, {
        method: 'PUT',
        body: { estado: 'vencida', motivo: 'Marcada como vencida manualmente' },
      });
      toast.success(`Suscripción de "${emp.razon_social}" marcada como vencida.`);
      actualizarFila(emp.id_empresa, { suscripcion: 'vencida' });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const ejecutarEliminar = async () => {
    if (!modalEliminar) return;
    setEliminando(true);
    try {
      const r = await api(`/admin/empresas/${modalEliminar.id_empresa}`, {
        method: 'DELETE',
        body: { motivo: motivoEliminar },
      });
      toast.success(r.mensaje || 'Empresa enviada a la papelera');
      setLista((prev) => prev.filter((e) => e.id_empresa !== modalEliminar.id_empresa));
      setModalEliminar(null);
      setMotivoEliminar('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEliminando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
        <span className="ml-3 text-slate-400 text-sm">Cargando empresas...</span>
      </div>
    );
  }
  if (errorCarga) {
    return (
      <div className="card p-6 text-center border-rose-500/20 bg-rose-500/5">
        <AlertTriangle size={20} className="text-rose-400 mx-auto mb-2" />
        <p className="text-rose-300 text-sm mb-3">{errorCarga}</p>
        <button className="btn-cta text-sm" onClick={cargar}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Vista Móvil: Tarjetas apiladas */}
      <div className="grid gap-3 md:hidden">
        {lista.map((e) => {
          const cfg = configEstadoSuscripcion(e.suscripcion);
          return (
            <div key={e.id_empresa} className="card p-4 space-y-3 border-white/10 bg-white/[0.04]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-white text-sm">{e.razon_social}</h3>
                  <p className="font-mono text-xs text-slate-400">NIT: {e.nit}</p>
                  <p className="text-xs text-cyan-300">{e.correo}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`badge-${e.estado_verificacion}`}>{e.estado_verificacion}</span>
                  <MenuTresPuntos empresa={e} onMarcarVencida={marcarVencida} onEliminar={(emp) => { setMotivoEliminar(''); setModalEliminar(emp); }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-white/[0.03] p-2.5 rounded-xl border border-white/10">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase mb-1">Suscripción</span>
                  {cfg.badge}
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Vencimiento</span>
                  <span className="font-medium text-slate-200">{fecha(e.fecha_vencimiento)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-400">{e.productos} producto(s)</span>
                {e.estado_verificacion === 'verificado' && e.slug && (
                  <a href={`/tienda/${e.slug}`} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-1 font-semibold text-cyan-300 hover:underline">
                    <span>Ver portal</span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/10">
                {cfg.acciones.includes('activar') && (
                  <button className="btn-cta flex-1 !py-1.5 text-xs" onClick={() => abrirActivar(e)}>
                    Activar
                  </button>
                )}
                {cfg.acciones.includes('suspender') && (
                  <button className="btn-light !text-rose-400 hover:!bg-rose-500/10 flex-1 !py-1.5 text-xs" onClick={() => abrirSuspender(e)}>
                    Suspender
                  </button>
                )}
                <MenuTresPuntos empresa={e} onMarcarVencida={marcarVencida} onEliminar={(emp) => { setMotivoEliminar(''); setModalEliminar(emp); }} />
              </div>
            </div>
          );
        })}

        {!lista.length && (
          <div className="card p-8 text-center text-slate-400 text-sm border-white/10 bg-white/[0.04]">
            No hay empresas registradas todavía.
          </div>
        )}
      </div>

      {/* Vista Escritorio: Tabla */}
      <div className="card hidden md:block p-0 border border-white/10 bg-white/[0.04] shadow-2xs" style={{overflow: "visible"}}>
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.06] text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-white/10">
            <tr>
              <th className="p-4">Empresa</th>
              <th className="p-4">NIT</th>
              <th className="p-4">Verificación</th>
              <th className="p-4">Suscripción</th>
              <th className="p-4">Vence</th>
              <th className="p-4 text-center">Prod.</th>
              <th className="p-4">Portal</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((e) => {
              const cfg = configEstadoSuscripcion(e.suscripcion);
              return (
                <tr key={e.id_empresa} className="border-t border-white/10 hover:bg-white/[0.05] transition-colors">
                  <td className="p-4">
                    <span className="font-bold text-white text-sm block">{e.razon_social}</span>
                    <span className="text-xs text-cyan-300">{e.correo}</span>
                  </td>
                  <td className="p-4 font-mono text-xs text-slate-300">{e.nit}</td>
                  <td className="p-4">
                    <span className={`badge-${e.estado_verificacion}`}>{e.estado_verificacion}</span>
                  </td>
                  <td className="p-4">{cfg.badge}</td>
                  <td className="p-4 text-xs text-slate-300">{fecha(e.fecha_vencimiento)}</td>
                  <td className="p-4 font-bold text-center text-white">{e.productos}</td>
                  <td className="p-4 text-xs">
                    {e.estado_verificacion === 'verificado' && e.slug ? (
                      <a href={`/tienda/${e.slug}`} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center gap-1 font-semibold text-cyan-300 hover:underline">
                        <span>Ver portal</span>
                        <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    ) : <span className="text-slate-500">—</span>}
                  </td>
                  <td className="p-4 overflow-visible">
                    <div className="flex items-center justify-end gap-1.5">
                      {cfg.acciones.includes('activar') && (
                        <button className="btn-cta !px-3 !py-1 text-xs" onClick={() => abrirActivar(e)}>
                          Activar
                        </button>
                      )}
                      {cfg.acciones.includes('suspender') && (
                        <button className="btn-light !px-3 !py-1 text-xs !text-rose-400 hover:!bg-rose-500/10" onClick={() => abrirSuspender(e)}>
                          Suspender
                        </button>
                      )}
                      <MenuTresPuntos empresa={e} onMarcarVencida={marcarVencida} onEliminar={(emp) => { setMotivoEliminar(''); setModalEliminar(emp); }} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!lista.length && (
              <tr>
                <td colSpan="8" className="p-12 text-center text-slate-400">
                  No hay empresas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Activar Suscripción */}
      {modalActivar && (
        <Modal
          abierto={!!modalActivar}
          onCerrar={() => setModalActivar(null)}
          titulo={
            <div className="flex items-center gap-2 text-emerald-300">
              <Check size={18} aria-hidden="true" />
              <span>Activar suscripción: {modalActivar.emp.razon_social}</span>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              La suscripción se marcará como <strong className="text-emerald-400">Activa</strong> y el portal de la empresa será visible al público.
            </p>
            <div className="space-y-1">
              <label className="label text-xs font-bold uppercase text-slate-300" htmlFor="activar-fecha">
                Vigente hasta
              </label>
              <input
                id="activar-fecha"
                type="date"
                className="input text-sm"
                value={modalActivar.fechaVencimiento}
                onChange={(ev) => setModalActivar((prev) => ({ ...prev, fechaVencimiento: ev.target.value }))}
              />
              <p className="text-xs text-slate-500">Por defecto: 30 días desde hoy.</p>
            </div>
            <div className="space-y-1">
              <label className="label text-xs font-bold uppercase text-slate-300" htmlFor="activar-motivo">
                Detalle / Motivo (opcional)
              </label>
              <input
                id="activar-motivo"
                className="input text-sm"
                placeholder="Ej. Pago en ventanilla confirmado"
                value={motivoActivar}
                onChange={(ev) => setMotivoActivar(ev.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button type="button" className="btn-light text-xs" onClick={() => setModalActivar(null)} disabled={guardandoActivar}>
                Cancelar
              </button>
              <button type="button" className="btn-cta text-xs" onClick={confirmarActivar} disabled={guardandoActivar}>
                {guardandoActivar ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>{guardandoActivar ? 'Activando…' : 'Activar suscripción'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Suspender Suscripción */}
      {modalSuspender && (
        <Modal
          abierto={!!modalSuspender}
          onCerrar={() => setModalSuspender(null)}
          titulo={
            <div className="flex items-center gap-2 text-rose-300">
              <X size={18} aria-hidden="true" />
              <span>Suspender suscripción: {modalSuspender.emp.razon_social}</span>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200 border border-rose-500/20 space-y-1">
              <p>• El portal y catálogo de la empresa dejarán de ser visibles al público.</p>
              <p>• La empresa recibirá una notificación por correo con el motivo indicado.</p>
            </div>
            <div className="space-y-1">
              <label className="label text-xs font-bold uppercase text-slate-300" htmlFor="suspender-motivo">
                Motivo de la suspensión <span className="text-rose-400">*</span>
              </label>
              <input
                id="suspender-motivo"
                className="input text-sm"
                placeholder="Ej. Incumplimiento de políticas / Pago no recibido"
                value={motivoSuspender}
                onChange={(ev) => setMotivoSuspender(ev.target.value)}
              />
              <p className="text-xs text-slate-500">Mínimo 5 caracteres. Se notificará a la empresa por correo.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button type="button" className="btn-light text-xs" onClick={() => setModalSuspender(null)} disabled={guardandoSuspender}>
                Cancelar
              </button>
              <button type="button" className="btn-light !text-white !bg-rose-600 hover:!bg-rose-500 text-xs" onClick={confirmarSuspender} disabled={guardandoSuspender}>
                {guardandoSuspender ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                <span>{guardandoSuspender ? 'Suspendiendo…' : 'Suspender suscripción'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Soft Delete a Papelera */}
      {modalEliminar && (
        <Modal
          abierto={!!modalEliminar}
          onCerrar={() => setModalEliminar(null)}
          titulo={
            <div className="flex items-center gap-2 text-rose-300">
              <Trash2 size={18} aria-hidden="true" />
              <span>Mover empresa a la Papelera</span>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              ¿Está seguro de enviar a la papelera a <strong>{modalEliminar.razon_social}</strong> (NIT: {modalEliminar.nit})?
            </p>
            <div className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200 border border-amber-500/20 space-y-1">
              <p>• Su catálogo y portal público dejarán de ser visibles.</p>
              <p>• Su suscripción se suspenderá automáticamente.</p>
              <p>• Podrá restaurarla en cualquier momento desde la pestaña <b>Papelera</b>.</p>
            </div>
            <div className="space-y-1">
              <label className="label text-xs font-bold uppercase text-slate-300" htmlFor="motivo-del">
                Motivo de la eliminación (opcional)
              </label>
              <input
                id="motivo-del"
                className="input text-sm"
                placeholder="Ej. Solicitud de baja voluntaria / Incumplimiento de políticas"
                value={motivoEliminar}
                onChange={(e) => setMotivoEliminar(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button type="button" className="btn-light text-xs" onClick={() => setModalEliminar(null)} disabled={eliminando}>
                Cancelar
              </button>
              <button type="button" className="btn-light !text-white !bg-rose-600 hover:!bg-rose-500 text-xs" onClick={ejecutarEliminar} disabled={eliminando}>
                {eliminando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{eliminando ? 'Eliminando…' : 'Mover a la papelera'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// PAPELERA DE RECICLAJE DE EMPRESAS (PARTE 2)
// -------------------------------------------------------------
function Papelera({ onCambio }) {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [modalDefinitivo, setModalDefinitivo] = useState(null); // emp
  const [confirmacionNombre, setConfirmacionNombre] = useState('');
  const [eliminandoDef, setEliminandoDef] = useState(false);
  const [modalVaciar, setModalVaciar] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    api('/admin/papelera')
      .then(setLista)
      .catch((e) => toast.error(e.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const restaurar = async (id, razonSocial) => {
    try {
      const r = await api(`/admin/papelera/${id}/restaurar`, { method: 'POST' });
      toast.success(r.mensaje || `Empresa "${razonSocial}" restaurada.`);
      cargar();
      if (onCambio) onCambio();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const ejecutarEliminacionDefinitiva = async () => {
    if (!modalDefinitivo) return;
    setEliminandoDef(true);
    try {
      const r = await api(`/admin/papelera/${modalDefinitivo.id_empresa}/definitivo`, {
        method: 'DELETE',
        body: { confirmacion_nombre: confirmacionNombre.trim() },
      });
      toast.success(r.mensaje || 'Empresa y archivos eliminados definitivamente');
      setModalDefinitivo(null);
      setConfirmacionNombre('');
      cargar();
      if (onCambio) onCambio();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEliminandoDef(false);
    }
  };

  const vaciarPapelera = async () => {
    try {
      const r = await api('/admin/papelera/vaciar', { method: 'POST', body: { todas: true } });
      toast.success(r.mensaje || 'Papelera vaciada correctamente');
      setModalVaciar(false);
      cargar();
      if (onCambio) onCambio();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-white/10 bg-white/[0.04]">
        <div>
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Trash2 size={18} className="text-rose-400" aria-hidden="true" />
            <span>Papelera de Empresas</span>
          </h3>
          <p className="text-xs text-slate-400">
            Empresas dadas de baja temporalmente. Puede restaurarlas o purgarlas definitivamente del sistema.
          </p>
        </div>
        {lista.length > 0 && (
          <button
            type="button"
            className="btn-light !text-rose-400 hover:!bg-rose-500/10 text-xs shrink-0"
            onClick={() => setModalVaciar(true)}
          >
            <Trash2 size={14} aria-hidden="true" />
            <span>Vaciar papelera</span>
          </button>
        )}
      </div>

      {cargando ? (
        <div className="card p-12 text-center text-slate-400">
          <Loader2 size={24} className="animate-spin mx-auto mb-2 text-cyan-300" />
          <p className="text-xs">Cargando papelera…</p>
        </div>
      ) : !lista.length ? (
        <div className="card p-12 text-center text-slate-400 border-white/10 bg-white/[0.04]">
          <Trash2 size={36} className="mx-auto mb-2 text-slate-600" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-300">La papelera está vacía</p>
          <p className="text-xs text-slate-500 mt-1">No hay empresas eliminadas temporalmente.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0 border border-white/10 bg-white/[0.04] shadow-2xs">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.06] text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-white/10">
              <tr>
                <th className="p-4">Empresa</th>
                <th className="p-4">NIT</th>
                <th className="p-4">Fecha Eliminación</th>
                <th className="p-4">Motivo</th>
                <th className="p-4">Eliminado Por</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id_empresa} className="border-t border-white/10 hover:bg-white/[0.05] transition-colors">
                  <td className="p-4">
                    <span className="font-bold text-white text-sm block">{e.razon_social}</span>
                    <span className="text-xs text-cyan-300">{e.correo}</span>
                  </td>
                  <td className="p-4 font-mono text-xs text-slate-300">{e.nit}</td>
                  <td className="p-4 text-xs text-slate-300">{fecha(e.eliminado_en)}</td>
                  <td className="p-4 text-xs text-slate-300 max-w-xs truncate">
                    {e.motivo_eliminacion || 'Sin motivo especificado'}
                  </td>
                  <td className="p-4 text-xs text-slate-400">{e.eliminado_por_correo || 'Administración'}</td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      className="btn-success !px-2.5 !py-1 text-xs"
                      onClick={() => restaurar(e.id_empresa, e.razon_social)}
                      title="Restaurar empresa"
                    >
                      <RotateCcw size={13} aria-hidden="true" />
                      <span>Restaurar</span>
                    </button>
                    <button
                      className="btn-light !text-rose-400 hover:!bg-rose-500/10 !px-2.5 !py-1 text-xs"
                      onClick={() => {
                        setModalDefinitivo(e);
                        setConfirmacionNombre('');
                      }}
                      title="Eliminar permanentemente"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      <span>Definitivo</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Doble Confirmación Eliminación Definitiva */}
      {modalDefinitivo && (
        <Modal
          abierto={!!modalDefinitivo}
          onCerrar={() => setModalDefinitivo(null)}
          titulo={
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>Eliminación Definitiva e Irreversible</span>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              Esta acción <strong>eliminará de forma permanente</strong> a la empresa{' '}
              <strong className="text-white">{modalDefinitivo.razon_social}</strong> (NIT: {modalDefinitivo.nit}),
              incluyendo todos sus productos, imágenes, ventas, comprobantes y archivos en el servidor.
            </p>

            <div className="rounded-xl bg-rose-500/15 p-3.5 border border-rose-500/30 text-xs text-rose-300">
              <strong>Atención:</strong> Esta acción NO se puede deshacer bajo ninguna circunstancia.
            </div>

            <div className="space-y-1.5">
              <label className="label text-xs text-slate-300" htmlFor="conf-nombre">
                Para confirmar, escriba el nombre exacto de la empresa: <strong className="text-white">{modalDefinitivo.razon_social}</strong>
              </label>
              <input
                id="conf-nombre"
                className="input text-sm"
                value={confirmacionNombre}
                onChange={(e) => setConfirmacionNombre(e.target.value)}
                placeholder={modalDefinitivo.razon_social}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                className="btn-light text-xs"
                onClick={() => setModalDefinitivo(null)}
                disabled={eliminandoDef}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-light !text-white !bg-rose-600 hover:!bg-rose-500 text-xs disabled:opacity-40"
                onClick={ejecutarEliminacionDefinitiva}
                disabled={eliminandoDef || confirmacionNombre.trim() !== modalDefinitivo.razon_social.trim()}
              >
                {eliminandoDef ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{eliminandoDef ? 'Eliminando…' : 'Eliminar permanentemente'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Vaciar Papelera */}
      <ModalConfirmacion
        abierto={modalVaciar}
        titulo="Vaciar papelera de empresas"
        mensaje="¿Está seguro de purgar todas las empresas en la papelera? Se borrarán de forma irreversible todos sus datos y archivos."
        tipo="peligro"
        textoBotonConfirmar="Sí, vaciar papelera"
        onConfirmar={vaciarPapelera}
        onCancelar={() => setModalVaciar(false)}
      />
    </div>
  );
}

// -------------------------------------------------------------
// GESTIÓN DE CATEGORÍAS Y SOLICITUDES (PARTE 3)
// -------------------------------------------------------------
function Categorias() {
  const [data, setData] = useState({ categorias: [], solicitudes: [] });
  const [nombre, setNombre] = useState('');
  const [cargando, setCargando] = useState(false);

  // Estados para Edición
  const [modalEditar, setModalEditar] = useState(null); // { id_categoria, nombre }
  const [nombreEditado, setNombreEditado] = useState('');

  // Estados para Eliminación con Reasignación
  const [modalEliminar, setModalEliminar] = useState(null); // cat
  const [nuevaCatId, setNuevaCatId] = useState('');
  const [eliminandoCat, setEliminandoCat] = useState(false);

  // Estados para Rechazo de Solicitud
  const [modalRechazo, setModalRechazo] = useState(null); // id_solicitud
  const [motivoRechazo, setMotivoRechazo] = useState('');

  const cargar = useCallback(async () => {
    try {
      const d = await api('/admin/categorias');
      if (d && d.categorias) {
        setData(d);
      }
    } catch (e) {
      toast.error(e.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const crear = async (n, id_solicitud) => {
    if (!n || n.trim().length < 3) {
      toast.error('El nombre de la categoría debe tener al menos 3 caracteres');
      return;
    }
    setCargando(true);
    try {
      await api('/admin/categorias', { method: 'POST', body: { nombre: n.trim(), id_solicitud } });
      setNombre('');
      toast.success('Categoría creada exitosamente');
      await cargar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCargando(false);
    }
  };

  const guardarEdicion = async () => {
    if (!modalEditar || !nombreEditado.trim()) return;
    try {
      const r = await api(`/admin/categorias/${modalEditar.id_categoria}`, {
        method: 'PUT',
        body: { nombre: nombreEditado.trim() },
      });
      setModalEditar(null);
      toast.success(r.mensaje || 'Categoría renombrada');
      await cargar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const ejecutarEliminarCategoria = async () => {
    if (!modalEliminar) return;
    const cat = modalEliminar;
    setEliminandoCat(true);
    try {
      const body = cat.productos > 0 ? { nueva_categoria_id: nuevaCatId } : {};
      const r = await api(`/admin/categorias/${cat.id_categoria}`, {
        method: 'DELETE',
        body,
      });
      setModalEliminar(null);
      setNuevaCatId('');
      toast.success(r.mensaje || 'Categoría eliminada');
      await cargar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEliminandoCat(false);
    }
  };

  const aprobarSolicitud = async (sol) => {
    try {
      // Actualización optimista instantánea
      setData((prev) => ({
        ...prev,
        solicitudes: prev.solicitudes.map((s) =>
          s.id_solicitud === sol.id_solicitud ? { ...s, estado: 'aprobada' } : s
        ),
      }));
      const r = await api(`/admin/solicitudes-categoria/${sol.id_solicitud}/aprobar`, { method: 'POST' });
      toast.success(r.mensaje || `Categoría "${sol.nombre}" aprobada.`);
      await cargar();
    } catch (e) {
      toast.error(e.message);
      await cargar();
    }
  };

  const rechazarSolicitud = async () => {
    if (!modalRechazo) return;
    const id = modalRechazo;
    try {
      setData((prev) => ({
        ...prev,
        solicitudes: prev.solicitudes.map((s) =>
          s.id_solicitud === id ? { ...s, estado: 'rechazada' } : s
        ),
      }));
      const r = await api(`/admin/solicitudes-categoria/${id}/rechazar`, {
        method: 'POST',
        body: { motivo: motivoRechazo },
      });
      setModalRechazo(null);
      setMotivoRechazo('');
      toast.success(r.mensaje || 'Solicitud rechazada');
      await cargar();
    } catch (e) {
      toast.error(e.message);
      await cargar();
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Listado y Creación de Categorías */}
      <div className="card space-y-4 p-5 sm:p-6 border-white/10 bg-white/[0.04]">
        <div>
          <h3 className="font-bold text-white text-base">Categorías de Productos</h3>
          <p className="text-xs text-slate-400">Rubros oficiales disponibles para las empresas de la plataforma</p>
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            crear(nombre);
          }}
        >
          <input
            className="input text-base sm:text-sm"
            placeholder="Nueva categoría (ej. Mascotas)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <button type="submit" className="btn-cta shrink-0" disabled={cargando}>
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
            <span>Agregar</span>
          </button>
        </form>

        <ul className="divide-y divide-white/10 text-sm max-h-96 overflow-y-auto">
          {data.categorias.map((c) => (
            <li key={c.id_categoria} className="flex items-center justify-between py-2.5 px-1 hover:bg-white/[0.02] rounded-lg">
              <div className="min-w-0 pr-2">
                <span className="font-semibold text-white text-xs sm:text-sm block truncate">{c.nombre}</span>
                <span className="text-[11px] text-slate-400">{c.productos} producto(s) asignado(s)</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-cyan-300 rounded-lg hover:bg-white/10 transition-colors"
                  onClick={() => {
                    setModalEditar(c);
                    setNombreEditado(c.nombre);
                  }}
                  title="Editar nombre"
                >
                  <Pencil size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/10 transition-colors"
                  onClick={() => {
                    setModalEliminar(c);
                    setNuevaCatId('');
                  }}
                  title="Eliminar categoría"
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Sugerencias de Empresas */}
      <div className="card space-y-4 p-5 sm:p-6 border-white/10 bg-white/[0.04]">
        <div>
          <h3 className="font-bold text-white text-base">Sugerencias reportadas por empresas</h3>
          <p className="text-xs text-slate-400">Solicitudes de nuevos rubros generadas desde el panel de empresa</p>
        </div>

        {!data.solicitudes.length && (
          <div className="py-8 text-center text-slate-400 text-xs">
            Sin solicitudes de categorías pendientes.
          </div>
        )}

        <div className="space-y-2.5 max-h-96 overflow-y-auto">
          {data.solicitudes.map((s) => (
            <div
              key={s.id_solicitud}
              className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-3.5 text-xs sm:text-sm border border-white/10"
            >
              <div className="min-w-0 pr-2">
                <p className="font-bold text-white truncate">{s.nombre}</p>
                <p className="text-[11px] text-slate-400">Empresa: {s.razon_social}</p>
                {s.motivo && <p className="text-[10px] text-slate-500 italic mt-0.5">"{s.motivo}"</p>}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {s.estado === 'pendiente' ? (
                  <>
                    <button
                      type="button"
                      className="btn-success !px-2.5 !py-1 text-xs"
                      onClick={() => aprobarSolicitud(s)}
                    >
                      <Check size={12} aria-hidden="true" />
                      <span>Aprobar</span>
                    </button>
                    <button
                      type="button"
                      className="btn-light !text-rose-400 hover:!bg-rose-500/10 !px-2.5 !py-1 text-xs"
                      onClick={() => {
                        setModalRechazo(s.id_solicitud);
                        setMotivoRechazo('');
                      }}
                    >
                      <X size={12} aria-hidden="true" />
                      <span>Rechazar</span>
                    </button>
                  </>
                ) : (
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    s.estado === 'aprobada' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {s.estado}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Editar Categoría */}
      {modalEditar && (
        <Modal
          abierto={!!modalEditar}
          onCerrar={() => setModalEditar(null)}
          titulo="Editar nombre de categoría"
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="label text-xs font-bold text-slate-300" htmlFor="edit-cat">
                Nombre de la categoría
              </label>
              <input
                id="edit-cat"
                className="input text-sm"
                value={nombreEditado}
                onChange={(e) => setNombreEditado(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button type="button" className="btn-light text-xs" onClick={() => setModalEditar(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-cta text-xs" onClick={guardarEdicion}>
                Guardar cambios
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Eliminar Categoría (con reasignación si tiene productos) */}
      {modalEliminar && (
        <Modal
          abierto={!!modalEliminar}
          onCerrar={() => setModalEliminar(null)}
          titulo={
            <div className="flex items-center gap-2 text-rose-400">
              <Trash2 size={18} aria-hidden="true" />
              <span>Eliminar categoría "{modalEliminar.nombre}"</span>
            </div>
          }
        >
          <div className="space-y-4">
            {modalEliminar.productos > 0 ? (
              <>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Esta categoría tiene <strong className="text-white">{modalEliminar.productos} producto(s)</strong> asociados.
                  Para eliminarla, debe seleccionar una categoría destino para reasignar dichos productos:
                </p>
                <div className="space-y-1">
                  <label className="label text-xs font-bold uppercase text-slate-300" htmlFor="sel-reasignar">
                    Nueva categoría destino *
                  </label>
                  <Select
                    id="sel-reasignar"
                    name="nueva_categoria"
                    value={nuevaCatId}
                    options={data.categorias
                      .filter((c) => c.id_categoria !== modalEliminar.id_categoria)
                      .map((c) => ({
                        value: String(c.id_categoria),
                        label: `${c.nombre} (${c.productos} productos)`,
                      }))}
                    onChange={(e) => setNuevaCatId(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-300">
                ¿Está seguro de eliminar la categoría <strong>"{modalEliminar.nombre}"</strong>? No tiene productos asociados.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                className="btn-light text-xs"
                onClick={() => setModalEliminar(null)}
                disabled={eliminandoCat}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-light !text-white !bg-rose-600 hover:!bg-rose-500 text-xs disabled:opacity-40"
                onClick={ejecutarEliminarCategoria}
                disabled={eliminandoCat || (modalEliminar.productos > 0 && !nuevaCatId)}
              >
                {eliminandoCat ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{eliminandoCat ? 'Eliminando…' : 'Eliminar categoría'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Rechazar Solicitud de Categoría */}
      {modalRechazo && (
        <Modal
          abierto={!!modalRechazo}
          onCerrar={() => setModalRechazo(null)}
          titulo="Rechazar solicitud de categoría"
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="label text-xs font-bold text-slate-300" htmlFor="mot-rech">
                Motivo del rechazo (opcional)
              </label>
              <input
                id="mot-rech"
                className="input text-sm"
                placeholder="Ej. El rubro ya se encuentra cubierto por otra categoría existente"
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button type="button" className="btn-light text-xs" onClick={() => setModalRechazo(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-light !text-rose-300 hover:!bg-rose-500/20 text-xs" onClick={rechazarSolicitud}>
                Rechazar solicitud
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ==========================================================================
   GESTIÓN DE MARCAS Y MARCAS PROHIBIDAS
   ========================================================================== */

function GestionMarcas() {
  const [marcas, setMarcas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todas'); // 'todas' | 'permitidas' | 'prohibidas'

  // Modales
  const [modalProhibir, setModalProhibir] = useState(null); // { marca, motivo }
  const [modalNueva, setModalNueva] = useState(false);
  const [nuevaMarcaNombre, setNuevaMarcaNombre] = useState('');
  const [nuevoMotivo, setNuevoMotivo] = useState('');
  const [procesando, setProcesando] = useState(false);

  const cargarMarcas = useCallback(async () => {
    setCargando(true);
    try {
      const data = await api('/admin/marcas');
      setMarcas(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message || 'Error al cargar marcas');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarMarcas();
  }, [cargarMarcas]);

  const prohibirMarca = async (marcaNombre, motivoTexto) => {
    setProcesando(true);
    try {
      await api('/admin/marcas/prohibir', {
        method: 'POST',
        body: { marca: marcaNombre, motivo: motivoTexto },
      });
      toast.success(`Marca "${marcaNombre}" marcada como PROHIBIDA.`);
      setModalProhibir(null);
      setModalNueva(false);
      setNuevaMarcaNombre('');
      setNuevoMotivo('');
      cargarMarcas();
    } catch (e) {
      toast.error(e.message || 'Error al prohibir la marca');
    } finally {
      setProcesando(false);
    }
  };

  const permitirMarca = async (marcaNombre) => {
    setProcesando(true);
    try {
      await api(`/admin/marcas/prohibir/${encodeURIComponent(marcaNombre)}`, {
        method: 'DELETE',
      });
      toast.success(`Marca "${marcaNombre}" ahora está PERMITIDA.`);
      cargarMarcas();
    } catch (e) {
      toast.error(e.message || 'Error al permitir la marca');
    } finally {
      setProcesando(false);
    }
  };

  // Filtrado
  const marcasFiltradas = marcas.filter((m) => {
    const coincideTexto =
      !busqueda ||
      (m.marca && m.marca.toLowerCase().includes(busqueda.toLowerCase())) ||
      (m.motivo_prohibicion && m.motivo_prohibicion.toLowerCase().includes(busqueda.toLowerCase()));

    if (!coincideTexto) return false;

    if (filtro === 'permitidas') return !m.prohibida;
    if (filtro === 'prohibidas') return m.prohibida;
    return true;
  });

  const totalPermitidas = marcas.filter((m) => !m.prohibida).length;
  const totalProhibidas = marcas.filter((m) => m.prohibida).length;

  return (
    <div className="space-y-6">
      {/* Barra superior de controles */}
      <div className="card p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-white/10 bg-white/[0.03]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar marca o motivo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="input text-xs !pl-9 !py-1.5 w-full"
            />
          </div>

          <div className="flex gap-1 border border-white/10 p-1 rounded-xl bg-white/[0.02]">
            <button
              type="button"
              onClick={() => setFiltro('todas')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filtro === 'todas' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todas ({marcas.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltro('permitidas')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filtro === 'permitidas' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              Permitidas ({totalPermitidas})
            </button>
            <button
              type="button"
              onClick={() => setFiltro('prohibidas')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filtro === 'prohibidas' ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              Prohibidas ({totalProhibidas})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={cargarMarcas}
            disabled={cargando}
            className="btn-light text-xs !py-1.5 !px-3"
            title="Refrescar listado"
          >
            <RotateCw size={14} className={cargando ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refrescar</span>
          </button>
          <button
            type="button"
            onClick={() => setModalNueva(true)}
            className="btn-cta text-xs !py-1.5 !px-3.5 !bg-rose-600 hover:!bg-rose-500"
          >
            <Ban size={14} />
            <span>Prohibir nueva marca</span>
          </button>
        </div>
      </div>

      {/* Lista de Marcas */}
      {cargando ? (
        <div className="card p-12 text-center text-slate-400">
          <Loader2 size={28} className="animate-spin mx-auto text-cyan-400 mb-2" />
          <p className="text-sm">Cargando catálogo de marcas…</p>
        </div>
      ) : marcasFiltradas.length === 0 ? (
        <div className="card p-12 text-center text-slate-400 space-y-2">
          <Tag size={32} className="mx-auto text-slate-500" />
          <p className="text-sm font-semibold text-slate-300">No se encontraron marcas</p>
          <p className="text-xs text-slate-500">
            {busqueda ? 'Intente con otros términos de búsqueda.' : 'No hay marcas registradas en el sistema aún.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {marcasFiltradas.map((m) => (
            <div
              key={m.marca}
              className={`card p-4 space-y-3 border transition-colors ${
                m.prohibida
                  ? 'border-rose-500/30 bg-rose-500/[0.04]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-bold text-white truncate">{m.marca}</h4>
                    {m.prohibida ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/40">
                        <Ban size={10} />
                        Prohibida
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                        <Check size={10} />
                        Permitida
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {m.total_productos} {m.total_productos === 1 ? 'producto' : 'productos'} en {m.total_empresas} {m.total_empresas === 1 ? 'empresa' : 'empresas'}
                  </p>
                </div>
              </div>

              {/* Si está prohibida, mostrar motivo */}
              {m.prohibida && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs space-y-1">
                  <p className="font-semibold text-[11px] uppercase tracking-wider text-rose-400">Motivo de restricción:</p>
                  <p className="text-xs leading-relaxed">{m.motivo_prohibicion || 'Restringida por administración'}</p>
                  {m.fecha_prohibicion && (
                    <p className="text-[10px] text-rose-300/70 pt-0.5">Fecha: {fecha(m.fecha_prohibicion)}</p>
                  )}
                </div>
              )}

              {/* Empresas que usan la marca */}
              {Array.isArray(m.empresas) && m.empresas.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-white/5">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Empresas asociadas:</p>
                  <div className="flex flex-wrap gap-1">
                    {m.empresas.slice(0, 3).map((emp, i) => (
                      <span
                        key={i}
                        className="inline-block px-2 py-0.5 rounded-md bg-white/5 text-[11px] text-slate-300 border border-white/5 truncate max-w-[150px]"
                        title={emp.razon_social}
                      >
                        {emp.razon_social}
                      </span>
                    ))}
                    {m.empresas.length > 3 && (
                      <span className="text-[10px] text-slate-400 self-center">+{m.empresas.length - 3} más</span>
                    )}
                  </div>
                </div>
              )}

              {/* Botón de acción */}
              <div className="pt-2 border-t border-white/10 flex justify-end">
                {m.prohibida ? (
                  <button
                    type="button"
                    onClick={() => permitirMarca(m.marca)}
                    disabled={procesando}
                    className="btn-light text-xs !py-1 !px-3 !text-emerald-300 hover:!bg-emerald-500/20 border-emerald-500/30 flex items-center gap-1.5"
                  >
                    <Check size={13} />
                    <span>Permitir marca</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setModalProhibir({ marca: m.marca, motivo: '' })}
                    disabled={procesando}
                    className="btn-light text-xs !py-1 !px-3 !text-rose-300 hover:!bg-rose-500/20 border-rose-500/30 flex items-center gap-1.5"
                  >
                    <Ban size={13} />
                    <span>Prohibir marca</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Prohibir Marca Existente */}
      {modalProhibir && (
        <Modal
          abierto={!!modalProhibir}
          onCerrar={() => setModalProhibir(null)}
          titulo={`Prohibir marca "${modalProhibir.marca}"`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Al prohibir esta marca, las empresas no podrán registrar nuevos productos con ella y los productos existentes quedarán excluidos de la vista pública.
            </p>
            <div className="space-y-1">
              <label htmlFor="mot-ban" className="label text-xs font-bold text-slate-300">
                Motivo de la prohibición (opcional pero recomendado)
              </label>
              <textarea
                id="mot-ban"
                rows={3}
                placeholder="Ej: Marca registrada protegida, venta de réplicas no autorizadas o piratería..."
                value={modalProhibir.motivo}
                onChange={(e) => setModalProhibir({ ...modalProhibir, motivo: e.target.value })}
                className="input text-xs w-full resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                className="btn-light text-xs"
                onClick={() => setModalProhibir(null)}
                disabled={procesando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-cta text-xs !bg-rose-600 hover:!bg-rose-500"
                onClick={() => prohibirMarca(modalProhibir.marca, modalProhibir.motivo)}
                disabled={procesando}
              >
                {procesando ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                <span>{procesando ? 'Procesando…' : 'Confirmar prohibición'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Agregar Nueva Marca a Prohibir */}
      {modalNueva && (
        <Modal
          abierto={modalNueva}
          onCerrar={() => setModalNueva(false)}
          titulo="Prohibir nueva marca preventiva"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Agregue preventivamente una marca a la lista negra para evitar que empresas la registren en sus productos.
            </p>
            <div className="space-y-1">
              <label htmlFor="nom-nueva-marca" className="label text-xs font-bold text-slate-300">
                Nombre de la marca a prohibir *
              </label>
              <input
                id="nom-nueva-marca"
                type="text"
                placeholder="Ej. Apple, Rolex, Gucci, Nike..."
                value={nuevaMarcaNombre}
                onChange={(e) => setNuevaMarcaNombre(e.target.value)}
                className="input text-xs w-full"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="mot-nueva-marca" className="label text-xs font-bold text-slate-300">
                Motivo de prohibición
              </label>
              <textarea
                id="mot-nueva-marca"
                rows={3}
                placeholder="Ej. Venta no autorizada de marca registrada o productos restringidos..."
                value={nuevoMotivo}
                onChange={(e) => setNuevoMotivo(e.target.value)}
                className="input text-xs w-full resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                className="btn-light text-xs"
                onClick={() => setModalNueva(false)}
                disabled={procesando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-cta text-xs !bg-rose-600 hover:!bg-rose-500"
                onClick={() => prohibirMarca(nuevaMarcaNombre.trim(), nuevoMotivo.trim())}
                disabled={procesando || !nuevaMarcaNombre.trim()}
              >
                {procesando ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                <span>{procesando ? 'Guardando…' : 'Prohibir marca'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ==========================================================================
   BANDEJA DE REPORTES DE USUARIOS (CÍRCULO DE CONFIANZA)
   ========================================================================== */

function BandejaReportes({ onCambio }) {
  const [reportes, setReportes] = useState([]);
  const [stats, setStats] = useState({ total: 0, pendientes: 0, en_revision: 0, sancionados: 0, resueltos: 0, desestimados: 0 });
  const [cargando, setCargando] = useState(false);
  const [tabFiltro, setTabFiltro] = useState('pendiente'); // 'pendiente' | 'en_revision' | 'sancionado' | 'resuelto' | 'todos'
  const [busqueda, setBusqueda] = useState('');

  // Modales
  const [modalSuspender, setModalSuspender] = useState(null); // Reporte a suspender
  const [motivoSuspension, setMotivoSuspension] = useState('');
  const [procesandoSuspension, setProcesandoSuspension] = useState(false);

  const [modalEstado, setModalEstado] = useState(null); // { id_reporte, estado, notas }
  const [procesandoEstado, setProcesandoEstado] = useState(false);

  const cargarReportes = useCallback(async () => {
    setCargando(true);
    try {
      const data = await api('/admin/reportes');
      setReportes(Array.isArray(data.reportes) ? data.reportes : []);
      setStats(data.stats || {});
    } catch (e) {
      toast.error(e.message || 'Error al cargar los reportes');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarReportes();
  }, [cargarReportes]);

  // Contactar a la empresa por WhatsApp con plantilla formal pre-cargada
  const contactarPorWhatsApp = async (reporte) => {
    const rawTel = reporte.empresa_whatsapp || reporte.empresa_telefono || '';
    const telLimpio = rawTel.replace(/\D/g, '');
    if (!telLimpio) {
      toast.error(`La empresa "${reporte.empresa_nombre}" no tiene registrado número de WhatsApp o teléfono.`);
      return;
    }
    const numFinal = telLimpio.startsWith('591') ? telLimpio : `591${telLimpio}`;

    // Construir motivos en texto
    let motivosStr = 'Irregularidad en servicio o producto';
    if (Array.isArray(reporte.motivos) && reporte.motivos.length > 0) {
      motivosStr = reporte.motivos.join(', ');
    } else if (typeof reporte.motivos === 'string') {
      try {
        const parsed = JSON.parse(reporte.motivos);
        if (Array.isArray(parsed)) motivosStr = parsed.join(', ');
        else motivosStr = String(parsed);
      } catch {
        motivosStr = reporte.motivos;
      }
    }

    const mensajeWhatsApp = `Hola *${reporte.empresa_nombre}*, le contactamos de la Administración Central de *UNIMARKET BO*.\n\nHemos recibido un reporte formal de un usuario en la plataforma con respecto a su negocio:\n⚠️ *Motivo(s):* ${motivosStr}\n📝 *Detalle del reclamo:* "${reporte.descripcion}"\n${reporte.producto_nombre ? `📦 *Producto:* ${reporte.producto_nombre}\n` : ''}\nLe solicitamos responder a este mensaje a la brevedad con su aclaración o comprobantes pertinentes para evitar la suspensión preventiva o definitiva de su cuenta en UNIMARKET BO.\n\nAtentamente,\n*Administración UNIMARKET BO*`;

    const url = `https://wa.me/${numFinal}?text=${encodeURIComponent(mensajeWhatsApp)}`;
    window.open(url, '_blank', 'noopener,noreferrer');

    // Si estaba pendiente, pasarlo automáticamente a "en_revision"
    if (reporte.estado === 'pendiente') {
      try {
        await api(`/admin/reportes/${reporte.id_reporte}`, {
          method: 'PUT',
          body: { estado: 'en_revision', notas_admin: 'Contactado formalmente por WhatsApp' },
        });
        toast.info('Reporte actualizado a "En revisión".');
        cargarReportes();
        onCambio?.();
      } catch {
        // Silencioso
      }
    }
  };

  const ejecutarSuspension = async () => {
    if (!modalSuspender) return;
    setProcesandoSuspension(true);
    try {
      await api(`/admin/reportes/${modalSuspender.id_reporte}/suspender-empresa`, {
        method: 'POST',
        body: { motivo: motivoSuspension.trim() || 'Suspensión tras reporte verificado de usuario' },
      });
      toast.success(`La empresa "${modalSuspender.empresa_nombre}" ha sido SUSPENDIDA del portal.`);
      setModalSuspender(null);
      setMotivoSuspension('');
      cargarReportes();
      onCambio?.();
    } catch (e) {
      toast.error(e.message || 'Error al suspender la empresa');
    } finally {
      setProcesandoSuspension(false);
    }
  };

  const guardarCambioEstado = async () => {
    if (!modalEstado) return;
    setProcesandoEstado(true);
    try {
      await api(`/admin/reportes/${modalEstado.id_reporte}`, {
        method: 'PUT',
        body: {
          estado: modalEstado.estado,
          notas_admin: modalEstado.notas,
        },
      });
      toast.success('Estado del reporte actualizado.');
      setModalEstado(null);
      cargarReportes();
      onCambio?.();
    } catch (e) {
      toast.error(e.message || 'Error al actualizar reporte');
    } finally {
      setProcesandoEstado(false);
    }
  };

  // Filtrado de reportes
  const reportesFiltrados = reportes.filter((r) => {
    if (tabFiltro !== 'todos' && r.estado !== tabFiltro) {
      if (tabFiltro === 'resuelto' && !['resuelto', 'desestimado'].includes(r.estado)) return false;
      else if (tabFiltro !== 'resuelto') return false;
    }

    if (busqueda) {
      const q = busqueda.toLowerCase();
      const coincide =
        (r.empresa_nombre && r.empresa_nombre.toLowerCase().includes(q)) ||
        (r.producto_nombre && r.producto_nombre.toLowerCase().includes(q)) ||
        (r.descripcion && r.descripcion.toLowerCase().includes(q)) ||
        (r.nombre_denunciante && r.nombre_denunciante.toLowerCase().includes(q));
      if (!coincide) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Barra de Filtros y Búsqueda */}
      <div className="card p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-white/10 bg-white/[0.03]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por empresa, producto o texto…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="input text-xs !pl-9 !py-1.5 w-full"
            />
          </div>

          <div className="flex flex-wrap gap-1 border border-white/10 p-1 rounded-xl bg-white/[0.02]">
            <button
              type="button"
              onClick={() => setTabFiltro('pendiente')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                tabFiltro === 'pendiente' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Pendientes</span>
              {stats.pendientes > 0 && (
                <span className="h-4 min-w-4 px-1 rounded-full bg-amber-500 text-[10px] font-bold text-slate-900 inline-flex items-center justify-center">
                  {stats.pendientes}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTabFiltro('en_revision')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                tabFiltro === 'en_revision' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              En revisión ({stats.en_revision || 0})
            </button>
            <button
              type="button"
              onClick={() => setTabFiltro('sancionado')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                tabFiltro === 'sancionado' ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sancionadas ({stats.sancionados || 0})
            </button>
            <button
              type="button"
              onClick={() => setTabFiltro('resuelto')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                tabFiltro === 'resuelto' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              Resueltas / Desestimadas ({Number(stats.resueltos || 0) + Number(stats.desestimados || 0)})
            </button>
            <button
              type="button"
              onClick={() => setTabFiltro('todos')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                tabFiltro === 'todos' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todas ({stats.total || 0})
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={cargarReportes}
          disabled={cargando}
          className="btn-light text-xs !py-1.5 !px-3 shrink-0"
        >
          <RotateCw size={14} className={cargando ? 'animate-spin' : ''} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Listado de Reportes */}
      {cargando ? (
        <div className="card p-12 text-center text-slate-400">
          <Loader2 size={28} className="animate-spin mx-auto text-cyan-400 mb-2" />
          <p className="text-sm">Cargando bandeja de reportes…</p>
        </div>
      ) : reportesFiltrados.length === 0 ? (
        <div className="card p-12 text-center text-slate-400 space-y-2">
          <ShieldAlert size={32} className="mx-auto text-slate-500" />
          <p className="text-sm font-semibold text-slate-300">No hay reportes en esta sección</p>
          <p className="text-xs text-slate-500">
            {tabFiltro === 'pendiente'
              ? '¡Excelente! No hay reportes de usuarios pendientes de revisión.'
              : 'No se encontraron registros con los filtros seleccionados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reportesFiltrados.map((rep) => {
            const sla = calcularSLA(rep.creado_en);
            let motivosLista = [];
            if (Array.isArray(rep.motivos)) motivosLista = rep.motivos;
            else if (typeof rep.motivos === 'string') {
              try {
                const parsed = JSON.parse(rep.motivos);
                motivosLista = Array.isArray(parsed) ? parsed : [rep.motivos];
              } catch {
                motivosLista = [rep.motivos];
              }
            }

            return (
              <div
                key={rep.id_reporte}
                className={`card p-5 space-y-4 border transition-colors ${
                  rep.estado === 'pendiente'
                    ? 'border-amber-500/40 bg-amber-500/[0.03]'
                    : rep.estado === 'sancionado'
                    ? 'border-rose-500/40 bg-rose-500/[0.03]'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                {/* Cabecera del Reporte */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 border border-white/10 text-cyan-300">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-white">{rep.empresa_nombre}</h4>
                        {rep.empresa_slug && (
                          <a
                            href={`/tienda/${rep.empresa_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 text-xs inline-flex items-center gap-0.5 hover:underline"
                          >
                            <span>Ver portal</span>
                            <ExternalLink size={11} />
                          </a>
                        )}
                        <span className="text-xs text-slate-400 font-mono">NIT: {rep.empresa_nit || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span>Tel/WA: {rep.empresa_whatsapp || rep.empresa_telefono || 'No registrado'}</span>
                        <span>•</span>
                        <span
                          className={`font-semibold ${
                            rep.suscripcion_estado === 'activa'
                              ? 'text-emerald-400'
                              : rep.suscripcion_estado === 'suspendida'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          Suscripción: {rep.suscripcion_estado || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock size={13} />
                      {sla.texto}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                        rep.estado === 'pendiente'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : rep.estado === 'en_revision'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : rep.estado === 'sancionado'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : rep.estado === 'resuelto'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-500/20 text-slate-300 border border-slate-500/40'
                      }`}
                    >
                      {rep.estado === 'pendiente' && 'Pendiente'}
                      {rep.estado === 'en_revision' && 'En revisión'}
                      {rep.estado === 'sancionado' && 'Sancionado (Suspendida)'}
                      {rep.estado === 'resuelto' && 'Resuelto'}
                      {rep.estado === 'desestimado' && 'Desestimado'}
                    </span>
                  </div>
                </div>

                {/* Motivos e información del producto reportado */}
                <div className="space-y-2">
                  {rep.producto_nombre && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-200">
                      <Package size={14} className="text-violet-400" />
                      <span>Producto reportado:</span>
                      <strong className="text-white">{rep.producto_nombre}</strong>
                      {rep.producto_precio && (
                        <span className="text-cyan-300 font-mono">({bs(rep.producto_precio)})</span>
                      )}
                    </div>
                  )}

                  {/* Badges de Motivos seleccionados */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {motivosLista.map((m, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold"
                      >
                        <AlertTriangle size={12} className="shrink-0" />
                        <span>{m}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Detalle o Descripción del usuario */}
                <div className="rounded-xl border border-white/10 bg-black/20 p-3.5 space-y-1.5 text-xs sm:text-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Descripción del usuario:
                  </p>
                  <p className="text-slate-200 leading-relaxed whitespace-pre-line">{rep.descripcion}</p>
                </div>

                {/* Datos del denunciante y notas de administración */}
                <div className="grid sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Datos del denunciante:
                    </p>
                    <p className="text-slate-300">
                      Nombre: <strong className="text-white">{rep.nombre_denunciante || 'Anónimo'}</strong>
                    </p>
                    {rep.contacto_denunciante && (
                      <div className="flex items-center justify-between text-slate-300 pt-0.5">
                        <span>Contacto: {rep.contacto_denunciante}</span>
                        <button
                          type="button"
                          onClick={() => copiarDato(rep.contacto_denunciante, 'Contacto del denunciante')}
                          className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                        >
                          <Copy size={12} />
                          <span>Copiar</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Notas del Administrador:
                    </p>
                    <p className="text-slate-300 italic">
                      {rep.notas_admin || 'Sin notas registradas por la administración.'}
                    </p>
                    {rep.resuelto_en && (
                      <p className="text-[10px] text-slate-400 pt-1">Cerrado en: {fecha(rep.resuelto_en)}</p>
                    )}
                  </div>
                </div>

                {/* Acciones principales: WhatsApp a la empresa, Suspender o Cambiar estado */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Botón WhatsApp Directo con plantilla */}
                    <button
                      type="button"
                      onClick={() => contactarPorWhatsApp(rep)}
                      className="btn-success text-xs !py-1.5 !px-3.5 flex items-center gap-1.5 shadow-sm"
                      title="Abrir WhatsApp oficial con el reporte redactado para pedir descargos a la empresa"
                    >
                      <MessageCircle size={15} />
                      <span>Contactar por WhatsApp</span>
                    </button>

                    {/* Botón Suspender Empresa (Sanción) */}
                    {rep.suscripcion_estado !== 'suspendida' && (
                      <button
                        type="button"
                        onClick={() => {
                          setModalSuspender(rep);
                          setMotivoSuspension(`Reporte verificado #${rep.id_reporte}`);
                        }}
                        className="btn-light text-xs !py-1.5 !px-3 !text-rose-300 hover:!bg-rose-500/20 border-rose-500/30 flex items-center gap-1.5"
                      >
                        <Ban size={14} />
                        <span>Suspender empresa</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setModalEstado({
                        id_reporte: rep.id_reporte,
                        estado: rep.estado,
                        notas: rep.notas_admin || '',
                      })
                    }
                    className="btn-light text-xs !py-1.5 !px-3 flex items-center gap-1.5"
                  >
                    <Pencil size={13} />
                    <span>Gestionar estado / Notas</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Suspender Empresa */}
      {modalSuspender && (
        <Modal
          abierto={!!modalSuspender}
          onCerrar={() => setModalSuspender(null)}
          titulo={`Suspender empresa "${modalSuspender.empresa_nombre}"`}
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle size={15} />
                Acción disciplinaria inmediata
              </p>
              <p className="leading-relaxed">
                La suscripción de la empresa pasará a estado <strong>"suspendida"</strong>. Sus productos dejarán de aparecer en el catálogo público y su tienda dejará de ser accesible para los compradores.
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="mot-susp-adm" className="label text-xs font-bold text-slate-300">
                Motivo formal de la suspensión
              </label>
              <textarea
                id="mot-susp-adm"
                rows={3}
                placeholder="Indique el motivo que se registrará y enviará por correo..."
                value={motivoSuspension}
                onChange={(e) => setMotivoSuspension(e.target.value)}
                className="input text-xs w-full resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                className="btn-light text-xs"
                onClick={() => setModalSuspender(null)}
                disabled={procesandoSuspension}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-cta text-xs !bg-rose-600 hover:!bg-rose-500"
                onClick={ejecutarSuspension}
                disabled={procesandoSuspension}
              >
                {procesandoSuspension ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                <span>{procesandoSuspension ? 'Suspendiendo…' : 'Confirmar Suspensión'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Cambiar Estado de Reporte */}
      {modalEstado && (
        <Modal
          abierto={!!modalEstado}
          onCerrar={() => setModalEstado(null)}
          titulo="Actualizar estado del reporte"
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="sel-est-rep" className="label text-xs font-bold text-slate-300">
                Estado del reporte
              </label>
              <select
                id="sel-est-rep"
                className="input text-xs w-full"
                value={modalEstado.estado}
                onChange={(e) => setModalEstado({ ...modalEstado, estado: e.target.value })}
              >
                <option value="pendiente">Pendiente</option>
                <option value="en_revision">En revisión (Empresa notificada)</option>
                <option value="sancionado">Sancionado (Empresa suspendida o penalizada)</option>
                <option value="resuelto">Resuelto (Acuerdo o aclaración satisfactoria)</option>
                <option value="desestimado">Desestimado (Reporte infundado o sin pruebas)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="not-adm-rep" className="label text-xs font-bold text-slate-300">
                Notas y observaciones de administración
              </label>
              <textarea
                id="not-adm-rep"
                rows={3}
                placeholder="Detalle el resultado de la revisión o respuesta de la empresa..."
                value={modalEstado.notas}
                onChange={(e) => setModalEstado({ ...modalEstado, notas: e.target.value })}
                className="input text-xs w-full resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                className="btn-light text-xs"
                onClick={() => setModalEstado(null)}
                disabled={procesandoEstado}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-cta text-xs"
                onClick={guardarCambioEstado}
                disabled={procesandoEstado}
              >
                {procesandoEstado ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>{procesandoEstado ? 'Guardando…' : 'Guardar cambios'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ==========================================================================
   PANEL ADMIN PRINCIPAL
   ========================================================================== */

export default function PanelAdmin() {
  const [tab, setTab] = useState('ver');
  const [stats, setStats] = useState({
    empresas: 0,
    pendientes: 0,
    activas: 0,
    productos: 0,
    pagosPendientes: 0,
    papelera: 0,
    reportesPendientes: 0,
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    Promise.all([
      api('/admin/empresas').catch(() => []),
      api('/admin/verificaciones?estado=pendiente').catch(() => []),
      api('/admin/pagos?estado=pendiente').catch(() => []),
      api('/admin/papelera').catch(() => []),
      api('/admin/reportes?estado=pendiente').catch(() => ({ reportes: [], stats: { pendientes: 0 } })),
    ]).then(([emps, vers, pagos, papelera, reps]) => {
      const empresas = Array.isArray(emps) ? emps : [];
      const pendientes = Array.isArray(vers) ? vers.length : 0;
      const activas = empresas.filter((e) => e.suscripcion === 'activa').length;
      const productos = empresas.reduce((acc, curr) => acc + (curr.productos || 0), 0);
      const pagosPendientes = Array.isArray(pagos) ? pagos.length : 0;
      const totalPapelera = Array.isArray(papelera) ? papelera.length : 0;
      const reportesPendientes =
        reps?.stats?.pendientes ?? (Array.isArray(reps?.reportes) ? reps.reportes.length : 0);

      setStats({
        empresas: empresas.length,
        pendientes,
        activas,
        productos,
        pagosPendientes,
        papelera: totalPapelera,
        reportesPendientes,
      });
    });
  }, [tab, refreshTrigger]);

  const tabs = [
    { id: 'ver', label: 'Verificaciones NIT', icon: ShieldCheck, badge: stats.pendientes },
    { id: 'pagos', label: 'Gestión de pagos', icon: Receipt, badge: stats.pagosPendientes },
    { id: 'reportes', label: 'Bandeja de reportes', icon: ShieldAlert, badge: stats.reportesPendientes },
    { id: 'emp', label: 'Empresas y suscripciones', icon: Building2 },
    { id: 'cat', label: 'Gestión de categorías', icon: Layers },
    { id: 'marcas', label: 'Gestión de marcas', icon: Tag },
    { id: 'papelera', label: 'Papelera', icon: Trash2, badge: stats.papelera },
  ];

  return (
    <div className="w-full">
      <Encabezado
        migas={[{ etiqueta: 'Administración' }]}
        titulo="Panel de Administración General"
        subtitulo="Control de empresas registradas, revisión legal de NITs, confirmación de pagos, marcas y reportes de UNIMARKET BO."
        icono={Building2}
      />

      <div className="-mt-8 relative z-20 mx-auto max-w-6xl px-4 sm:px-6 pb-16 space-y-6">
        {/* KPI Cards Resumen */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <div className="card p-4 flex items-center gap-3 border-white/10 bg-white/[0.04]">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
              <Building2 size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Empresas</p>
              <p className="text-lg sm:text-xl font-bold text-white">{stats.empresas}</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3 border-white/10 bg-white/[0.04]">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30">
              <Clock size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Pendientes NIT</p>
              <p className="text-lg sm:text-xl font-bold text-amber-300">{stats.pendientes}</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3 border-white/10 bg-white/[0.04]">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-500/20 text-rose-300 border border-rose-400/30">
              <ShieldAlert size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Reportes</p>
              <p className="text-lg sm:text-xl font-bold text-rose-300">{stats.reportesPendientes}</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3 border-white/10 bg-white/[0.04]">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-violet-300 border border-violet-400/30">
              <Receipt size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Pagos Pendientes</p>
              <p className="text-lg sm:text-xl font-bold text-violet-300">{stats.pagosPendientes}</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3 border-white/10 bg-white/[0.04]">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Suscripciones</p>
              <p className="text-lg sm:text-xl font-bold text-emerald-300">{stats.activas}</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3 border-white/10 bg-white/[0.04]">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              <Package size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Total Productos</p>
              <p className="text-lg sm:text-xl font-bold text-white">{stats.productos}</p>
            </div>
          </div>
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex gap-2 border-b border-white/10 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'border-cyan-400 text-cyan-300 font-bold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{t.label}</span>
                {Boolean(t.badge) && (
                  <span
                    className={`inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold text-white ${
                      t.id === 'reportes' || t.id === 'papelera' ? 'bg-rose-500' : 'bg-amber-500'
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === 'ver' && <Verificaciones />}
        {tab === 'pagos' && <GestionPagos />}
        {tab === 'reportes' && <BandejaReportes onCambio={() => setRefreshTrigger((k) => k + 1)} />}
        {tab === 'emp' && <Empresas />}
        {tab === 'cat' && <Categorias />}
        {tab === 'marcas' && <GestionMarcas />}
        {tab === 'papelera' && <Papelera onCambio={() => setRefreshTrigger((k) => k + 1)} />}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { toast } from 'sonner';
import {
  ShieldAlert,
  AlertTriangle,
  CheckSquare,
  Square,
  Loader2,
  CheckCircle2,
  X,
  Store,
  Package,
} from 'lucide-react';
import { api } from '../api.js';
import Modal from './Modal.jsx';

const MOTIVOS_REPORTE = [
  { id: 'no_entrega', label: 'No realiza la entrega del producto o pedido pagado' },
  { id: 'producto_falso', label: 'Producto falsificado, adulterado o no coincide con lo publicado' },
  { id: 'informacion_falsa', label: 'Información falsa, datos de contacto inexistentes o suplantación' },
  { id: 'estafa', label: 'Intento de estafa, cobro indebido o solicitud de depósito sospechoso' },
  { id: 'garantia_atencion', label: 'Incumplimiento deliberado de acuerdos, garantías o mala fe comercial' },
  { id: 'precio_engano', label: 'Precio engañoso o inexistencia del stock anunciado' },
  { id: 'otro', label: 'Otro motivo no listado' },
];

export default function ModalReportar({
  abierto,
  onCerrar,
  empresa, // { id_empresa, razon_social, slug }
  producto, // opcional { id_producto, nombre }
}) {
  const [motivosSeleccionados, setMotivosSeleccionados] = useState([]);
  const [descripcion, setDescripcion] = useState('');
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviadoExitoso, setEnviadoExitoso] = useState(false);
  const [errorLocal, setErrorLocal] = useState('');

  const toggleMotivo = (idMotivo) => {
    setMotivosSeleccionados((prev) =>
      prev.includes(idMotivo) ? prev.filter((m) => m !== idMotivo) : [...prev, idMotivo]
    );
    if (errorLocal) setErrorLocal('');
  };

  const handleCerrar = () => {
    if (enviando) return;
    setMotivosSeleccionados([]);
    setDescripcion('');
    setNombre('');
    setContacto('');
    setErrorLocal('');
    setEnviadoExitoso(false);
    onCerrar();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!motivosSeleccionados.length) {
      setErrorLocal('Seleccione al menos un motivo para el reporte.');
      return;
    }
    if (descripcion.trim().length < 10) {
      setErrorLocal('La descripción debe detallar el incidente con al menos 10 caracteres.');
      return;
    }

    setEnviando(true);
    setErrorLocal('');

    // Mapear los motivos a etiquetas legibles
    const motivosLegibles = motivosSeleccionados.map(
      (mId) => MOTIVOS_REPORTE.find((item) => item.id === mId)?.label || mId
    );

    try {
      await api('/publico/reportes', {
        method: 'POST',
        body: {
          id_empresa: empresa?.id_empresa,
          id_producto: producto?.id_producto || null,
          motivos: motivosLegibles,
          descripcion: descripcion.trim(),
          nombre_denunciante: nombre.trim() || null,
          contacto_denunciante: contacto.trim() || null,
        },
      });

      setEnviadoExitoso(true);
      toast.success('Reporte enviado a la administración con éxito.');
    } catch (err) {
      setErrorLocal(err.message || 'Error al enviar el reporte');
      toast.error(err.message || 'Error al registrar el reporte');
    } finally {
      setEnviando(false);
    }
  };

  if (!abierto) return null;

  return (
    <Modal
      abierto={abierto}
      onCerrar={handleCerrar}
      maxWidth="max-w-xl"
      ariaLabelledBy="modal-reportar-titulo"
    >
      <div className="p-5 sm:p-6 space-y-5">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <ShieldAlert size={22} aria-hidden="true" />
            </div>
            <div>
              <h3 id="modal-reportar-titulo" className="text-base sm:text-lg font-bold text-white">
                Reportar anomalía o fraude
              </h3>
              <p className="text-xs text-slate-400">
                Cerrando el círculo de confianza en UNIMARKET BO
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCerrar}
            disabled={enviando}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {enviadoExitoso ? (
          <div className="py-8 text-center space-y-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mx-auto">
              <CheckCircle2 size={36} />
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-bold text-white">Reporte Registrado</h4>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                Gracias por contribuir a la seguridad de la comunidad. El equipo de administración revisará la denuncia, contrastará la evidencia y podrá contactar a la empresa o aplicar suspensiones inmediatas según las normas.
              </p>
            </div>
            <div className="pt-2">
              <button type="button" onClick={handleCerrar} className="btn-cta !px-6">
                Entendido
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
            {/* Resumen del objetivo reportado */}
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 space-y-1 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Store size={14} className="text-cyan-400 shrink-0" />
                <span className="text-slate-400">Empresa:</span>
                <strong className="text-white font-medium">{empresa?.razon_social || 'Empresa seleccionada'}</strong>
              </div>
              {producto?.nombre && (
                <div className="flex items-center gap-2 text-slate-300">
                  <Package size={14} className="text-violet-400 shrink-0" />
                  <span className="text-slate-400">Producto relacionado:</span>
                  <strong className="text-white font-medium truncate">{producto.nombre}</strong>
                </div>
              )}
            </div>

            {/* Motivos (Checkboxes con selección múltiple o única) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Motivos del reporte <span className="text-rose-400">*</span>
              </label>
              <p className="text-[11px] text-slate-400">
                Seleccione una o varias opciones que describan el incidente:
              </p>
              <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                {MOTIVOS_REPORTE.map((item) => {
                  const seleccionado = motivosSeleccionados.includes(item.id);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => toggleMotivo(item.id)}
                      className={`flex items-start gap-2.5 p-2 rounded-xl border text-left transition-colors ${
                        seleccionado
                          ? 'border-rose-500/50 bg-rose-500/10 text-rose-200'
                          : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="shrink-0 mt-0.5 text-rose-400">
                        {seleccionado ? <CheckSquare size={16} /> : <Square size={16} />}
                      </div>
                      <span className="text-xs leading-snug">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Descripción detallada */}
            <div className="space-y-1.5">
              <label htmlFor="rep-desc" className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Descripción detallada de lo sucedido <span className="text-rose-400">*</span>
              </label>
              <textarea
                id="rep-desc"
                rows={3}
                value={descripcion}
                onChange={(e) => {
                  setDescripcion(e.target.value);
                  if (errorLocal) setErrorLocal('');
                }}
                placeholder="Explique claramente qué ocurrió, fechas, acuerdos no cumplidos, detalles del pago o entrega para que el admin pueda comprobarlo..."
                className="input w-full resize-none text-xs leading-relaxed"
                required
              />
              <span className="text-[10px] text-slate-400 block text-right">
                {descripcion.length}/3000 caracteres
              </span>
            </div>

            {/* Datos opcionales del denunciante para contacto */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-white/10">
              <div>
                <label htmlFor="rep-nom" className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Tu nombre (opcional)
                </label>
                <input
                  id="rep-nom"
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="input !py-1.5 text-xs w-full"
                />
              </div>
              <div>
                <label htmlFor="rep-con" className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Teléfono / WhatsApp o Correo (opcional)
                </label>
                <input
                  id="rep-con"
                  type="text"
                  placeholder="Ej: 71234567 / correo@ejemplo.com"
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                  className="input !py-1.5 text-xs w-full"
                />
              </div>
            </div>

            {errorLocal && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{errorLocal}</span>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={handleCerrar}
                disabled={enviando}
                className="btn-light text-xs !py-2 !px-4"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando}
                className="btn-cta !bg-rose-600 hover:!bg-rose-500 text-xs !py-2 !px-5 flex items-center gap-2"
              >
                {enviando ? <Loader2 size={15} className="animate-spin" /> : <ShieldAlert size={15} />}
                <span>{enviando ? 'Enviando reporte…' : 'Enviar reporte formal'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

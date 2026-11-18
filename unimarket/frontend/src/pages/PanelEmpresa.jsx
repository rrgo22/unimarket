import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Clock,
  AlertTriangle,
  BadgeCheck,
  Store,
  Upload,
  Copy,
  ExternalLink,
  X,
  FileText,
  Image,
  Globe,
  Phone,
  MessageCircle,
  HelpCircle,
  Check,
  Loader2,
  AlertCircle,
  CreditCard,
  QrCode,
  Download,
  Landmark,
  Receipt,
  BarChart3,
  ShoppingCart,
  SlidersHorizontal,
  Search,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  DollarSign,
  Boxes,
  FileCheck,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  CheckSquare,
  Square,
  Share2,
  Key,
  ShoppingBag,
  Send,
} from 'lucide-react';
import { api, ApiError, bs, imgUrl, empImgUrl } from '../api.js';
import { useAuth } from '../auth.jsx';
import Modal from '../components/Modal.jsx';
import ModalConfirmacion from '../components/ModalConfirmacion.jsx';
import Encabezado from '../components/Encabezado.jsx';
import Select from '../components/Select.jsx';
import ModalEnviarComprobante from '../components/ModalEnviarComprobante.jsx';
import ModalCambiarPassword from '../components/ModalCambiarPassword.jsx';
import PedidosEmpresa from '../components/PedidosEmpresa.jsx';
import {
  soloDigitos,
  teclaPermitidaSoloDigitos,
  teclaPermitidaPrecio,
  filtrarPrecio,
  validarTelefono,
  validarWhatsapp,
  validarUrl,
  validarPrecio,
  validarNombreProducto,
  validarMarca,
  validarModelo,
} from '../utils/validar.js';

const vacioProd = {
  nombre: '',
  marca: '',
  modelo: '',
  descripcion: '',
  precio: '',
  id_categoria: '',
  disponible: true,
  sku: '',
  numero_serie: '',
  stock_actual: '0',
  stock_minimo: '20',
  unidad: 'unidad',
};

function FormProducto({ inicial, categorias, onGuardado, onCancelar, onCategoriaSugerida }) {
  const editando = !!inicial?.id_producto;
  const [d, setD] = useState(
    inicial
      ? {
          nombre: inicial.nombre,
          marca: inicial.marca || '',
          modelo: inicial.modelo || '',
          descripcion: inicial.descripcion || '',
          precio: String(inicial.precio ?? ''),
          id_categoria: String(inicial.id_categoria ?? ''),
          disponible: inicial.disponible,
          sku: inicial.sku || '',
          numero_serie: inicial.numero_serie || '',
          stock_actual: String(inicial.stock_actual ?? 0),
          stock_minimo: String(inicial.stock_minimo ?? 20),
          unidad: inicial.unidad || 'unidad',
        }
      : vacioProd
  );
  const [modalSugerir, setModalSugerir] = useState(false);
  const [sugNombre, setSugNombre] = useState('');
  const [sugMotivo, setSugMotivo] = useState('');
  const [enviandoSug, setEnviandoSug] = useState(false);
  const [archivos, setArchivos] = useState([]);
  const [quitar, setQuitar] = useState([]);
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  // Colores opcionales del producto
  const [colores, setColores] = useState(
    inicial?.colores?.length ? inicial.colores.map((c) => ({ nombre: c.nombre, codigo_hex: c.codigo_hex || null })) : []
  );
  const [nuevoColor, setNuevoColor] = useState('');
  // Carga colores desde el servidor al editar
  useEffect(() => {
    if (inicial?.id_producto) {
      api(`/empresa/productos/${inicial.id_producto}/colores`)
        .then((rows) => setColores(rows.map((c) => ({ nombre: c.nombre, codigo_hex: c.codigo_hex || null }))))
        .catch(() => {});
    }
  }, [inicial?.id_producto]);

  // Bloquear scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancelar();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancelar]);

  const validarUnCampo = (campo) => {
    let err = '';
    if (campo === 'nombre') err = validarNombreProducto(d.nombre);
    if (campo === 'marca') err = validarMarca(d.marca);
    if (campo === 'modelo') err = validarModelo(d.modelo);
    if (campo === 'precio') err = validarPrecio(d.precio);
    if (campo === 'id_categoria') {
      if (!d.id_categoria) err = 'Debe seleccionar una categoría';
    }
    setErrores((prev) => {
      const copy = { ...prev };
      if (err) copy[campo] = err;
      else delete copy[campo];
      return copy;
    });
    return err;
  };

  const camposProdOrden = [
    { id: 'prod-nombre', clave: 'nombre', fn: () => validarNombreProducto(d.nombre) },
    { id: 'prod-marca', clave: 'marca', fn: () => validarMarca(d.marca) },
    { id: 'prod-modelo', clave: 'modelo', fn: () => validarModelo(d.modelo) },
    { id: 'prod-precio', clave: 'precio', fn: () => validarPrecio(d.precio) },
    { id: 'prod-categoria', clave: 'id_categoria', fn: () => (!d.id_categoria ? 'Debe seleccionar una categoría' : '') },
  ];

  const enviar = async (e) => {
    e.preventDefault();
    setError('');

    const nuevos = {};
    let primerId = null;

    for (const c of camposProdOrden) {
      const err = c.fn();
      if (err) {
        nuevos[c.clave] = err;
        if (!primerId) primerId = c.id;
      }
    }

    if (Object.keys(nuevos).length) {
      setErrores(nuevos);
      if (primerId) {
        const el = document.getElementById(primerId);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    const form = new FormData();
    Object.entries(d).forEach(([k, v]) => form.append(k, v));
    archivos.forEach((f) => form.append('imagenes', f));
    quitar.forEach((q) => form.append('quitar_imagenes', q));
    setCargando(true);
    try {
      const resp = await api(editando ? `/empresa/productos/${inicial.id_producto}` : '/empresa/productos', {
        method: editando ? 'PUT' : 'POST',
        form,
      });
      // Guardar colores si existen (para nuevo producto usamos el id retornado)
      const idFinal = editando ? inicial.id_producto : resp?.id_producto;
      if (idFinal) {
        try {
          await api(`/empresa/productos/${idFinal}/colores`, {
            method: 'PUT',
            body: { colores: colores.filter((c) => c.nombre.trim()) },
          });
        } catch (errColor) {
          toast.error(`Error al guardar colores: ${errColor.message}`);
        }
      }
      toast.success(editando ? 'Producto actualizado' : 'Producto creado con éxito');
      onGuardado();
    } catch (err) {
      setError(err.message);
      if (err instanceof ApiError && err.errores) {
        setErrores(err.errores);
        for (const c of camposProdOrden) {
          if (err.errores[c.clave]) {
            const el = document.getElementById(c.id);
            if (el) {
              el.focus();
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            break;
          }
        }
      }
    } finally {
      setCargando(false);
    }
  };

  const imgsActuales = (inicial?.imagenes || []).filter((i) => !quitar.includes(i.id_imagen));

  return (
    <Modal
      abierto={true}
      onCerrar={onCancelar}
      maxWidth="max-w-xl"
      ariaLabelledBy="form-prod-title"
      titulo={editando ? 'Editar producto' : 'Nuevo producto en catálogo'}
    >
      <form onSubmit={enviar} className="space-y-4 pt-1" noValidate>
            <div>
              <label className="label" htmlFor="prod-nombre">
                Nombre del producto *
              </label>
              <input
                id="prod-nombre"
                className={`input text-base sm:text-sm ${
                  errores.nombre ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''
                }`}
                value={d.nombre}
                maxLength={150}
                onChange={(e) => {
                  setD({ ...d, nombre: e.target.value });
                  if (errores.nombre) setErrores((prev) => ({ ...prev, nombre: '' }));
                }}
                onBlur={() => validarUnCampo('nombre')}
                placeholder="Ej. Teclado Mecánico RGB"
                required
              />
              {errores.nombre ? (
                <p className="err text-rose-600 text-xs mt-1.5 flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                  <span>{errores.nombre}</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">3 a 150 caracteres ({d.nombre.length}/150)</p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="prod-desc">
                Descripción (opcional)
              </label>
              <textarea
                id="prod-desc"
                className="input text-base sm:text-sm"
                rows={3}
                maxLength={2000}
                value={d.descripcion}
                onChange={(e) => setD({ ...d, descripcion: e.target.value })}
                placeholder="Características, modelo, garantía o especificaciones del artículo"
              />
              <p className="text-[11px] text-slate-400 mt-1">Máximo 2000 caracteres ({d.descripcion.length}/2000)</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="prod-marca">
                  Marca (opcional)
                </label>
                <input
                  id="prod-marca"
                  className={`input text-base sm:text-sm ${
                    errores.marca ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''
                  }`}
                  value={d.marca || ''}
                  maxLength={60}
                  onChange={(e) => {
                    setD({ ...d, marca: e.target.value });
                    if (errores.marca) setErrores((prev) => ({ ...prev, marca: '' }));
                  }}
                  onBlur={() => validarUnCampo('marca')}
                  placeholder="Ej. Sony, Logitech, KeyForge"
                />
                {errores.marca ? (
                  <p className="err text-rose-500 text-xs mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                    <span>{errores.marca}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">2 a 60 caracteres</p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="prod-modelo">
                  Modelo (opcional)
                </label>
                <input
                  id="prod-modelo"
                  className={`input text-base sm:text-sm ${
                    errores.modelo ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''
                  }`}
                  value={d.modelo || ''}
                  maxLength={60}
                  onChange={(e) => {
                    setD({ ...d, modelo: e.target.value });
                    if (errores.modelo) setErrores((prev) => ({ ...prev, modelo: '' }));
                  }}
                  onBlur={() => validarUnCampo('modelo')}
                  placeholder="Ej. KF-60, MX Master 3, SW-300"
                />
                {errores.modelo ? (
                  <p className="err text-rose-500 text-xs mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                    <span>{errores.modelo}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">1 a 60 caracteres</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="prod-precio">
                  Precio (Bs) *
                </label>
                <input
                  id="prod-precio"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className={`input text-base sm:text-sm ${
                    errores.precio ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''
                  }`}
                  value={d.precio}
                  onKeyDown={(e) => teclaPermitidaPrecio(e, d.precio)}
                  onChange={(e) => {
                    const p = filtrarPrecio(e.target.value);
                    setD({ ...d, precio: p });
                    if (errores.precio) setErrores((prev) => ({ ...prev, precio: '' }));
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const p = filtrarPrecio(e.clipboardData.getData('text'));
                    setD((prev) => ({ ...prev, precio: p }));
                    if (errores.precio) setErrores((prev) => ({ ...prev, precio: '' }));
                  }}
                  onBlur={() => validarUnCampo('precio')}
                  placeholder="Ej. 120.50"
                  required
                />
                {errores.precio ? (
                  <p className="err text-rose-500 text-xs mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                    <span>{errores.precio}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">Solo números y hasta 2 decimales (ej. 12.50)</p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="prod-categoria">
                  Categoría *
                </label>
                <Select
                  id="prod-categoria"
                  name="id_categoria"
                  value={d.id_categoria}
                  placeholder="Seleccione categoría…"
                  ariaLabel="Categoría del producto"
                  options={categorias.map((c) => ({
                    value: String(c.id_categoria),
                    label: c.nombre,
                  }))}
                  onChange={(e) => {
                    setD({ ...d, id_categoria: e.target.value });
                    if (errores.id_categoria) setErrores((prev) => ({ ...prev, id_categoria: '' }));
                  }}
                />
                <div className="flex items-center justify-between mt-1">
                  {errores.id_categoria ? (
                    <p className="err text-rose-500 text-xs flex items-center gap-1">
                      <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                      <span>{errores.id_categoria}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400">Rubro del catálogo</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setModalSugerir(true)}
                    className="text-[11px] text-cyan-300 hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    <HelpCircle size={12} aria-hidden="true" />
                    <span>¿No encuentra su rubro? Sugerir categoría</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Código SKU y Número de Serie */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="prod-sku">
                  Código SKU (opcional)
                </label>
                <input
                  id="prod-sku"
                  className={`input text-base sm:text-sm font-mono uppercase ${
                    errores.sku ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''
                  }`}
                  value={d.sku || ''}
                  maxLength={50}
                  onChange={(e) => setD({ ...d, sku: e.target.value.toUpperCase() })}
                  placeholder="Ej. TEC-0010"
                />
                {errores.sku ? (
                  <p className="err text-rose-500 text-xs mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                    <span>{errores.sku}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">Se generará automáticamente si se deja vacío</p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="prod-serie">
                  Número de serie (opcional)
                </label>
                <input
                  id="prod-serie"
                  className="input text-base sm:text-sm font-mono"
                  value={d.numero_serie || ''}
                  maxLength={100}
                  onChange={(e) => setD({ ...d, numero_serie: e.target.value })}
                  placeholder="Ej. SN-894729103"
                />
                <p className="text-[11px] text-slate-400 mt-1">Identificador de fábrica del artículo</p>
              </div>
            </div>

            {/* Control de Stock e Inventario (PARTE 4) */}
            <div className="grid gap-4 sm:grid-cols-3 bg-white/[0.02] p-3.5 rounded-2xl border border-white/10">
              <div>
                <label className="label text-xs font-bold uppercase text-slate-300" htmlFor="prod-stock-actual">
                  Stock actual *
                </label>
                <input
                  id="prod-stock-actual"
                  type="number"
                  min="0"
                  className="input text-base sm:text-sm font-bold"
                  value={d.stock_actual}
                  onChange={(e) => {
                    const val = e.target.value;
                    setD({
                      ...d,
                      stock_actual: val,
                      disponible: val === '0' || val === 0 ? false : d.disponible,
                    });
                  }}
                  placeholder="0"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">Unidades físicas en almacén</p>
              </div>

              <div>
                <label className="label text-xs font-bold uppercase text-slate-300" htmlFor="prod-stock-minimo">
                  Stock mínimo (alerta)
                </label>
                <input
                  id="prod-stock-minimo"
                  type="number"
                  min="0"
                  className="input text-base sm:text-sm"
                  value={d.stock_minimo}
                  onChange={(e) => setD({ ...d, stock_minimo: e.target.value })}
                  placeholder="20"
                />
                <p className="text-[10px] text-slate-400 mt-1">Umbral para aviso por correo</p>
              </div>

              <div>
                <label className="label text-xs font-bold uppercase text-slate-300" htmlFor="prod-unidad">
                  Unidad de medida
                </label>
                <Select
                  id="prod-unidad"
                  name="unidad"
                  value={d.unidad}
                  options={[
                    { value: 'unidad', label: 'Unidad (u)' },
                    { value: 'caja', label: 'Caja' },
                    { value: 'paquete', label: 'Paquete' },
                    { value: 'kg', label: 'Kilogramo (kg)' },
                    { value: 'litro', label: 'Litro (L)' },
                    { value: 'metro', label: 'Metro (m)' },
                  ]}
                  onChange={(e) => setD({ ...d, unidad: e.target.value })}
                />
                <p className="text-[10px] text-slate-400 mt-1">Presentación del ítem</p>
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={d.disponible && d.stock_actual !== '0' && Number(d.stock_actual) > 0}
                disabled={d.stock_actual === '0' || Number(d.stock_actual) === 0}
                onChange={(e) => setD({ ...d, disponible: e.target.checked })}
                className="h-4 w-4 rounded text-indigo-500 focus:ring-indigo-400 border-white/20 bg-white/10"
              />
              <span className="font-medium">
                Producto disponible para la venta
                {(d.stock_actual === '0' || Number(d.stock_actual) === 0) && (
                  <span className="text-xs text-amber-300 ml-2 font-normal">(Inactivo automáticamente: stock en 0)</span>
                )}
              </span>
            </label>

            {/* ── Colores disponibles (opcional) ── */}
            <div className="space-y-3 bg-white/[0.02] rounded-2xl border border-white/10 p-3.5">
              <div className="flex items-center justify-between">
                <label className="label !mb-0 text-xs font-bold uppercase text-slate-300">Colores disponibles <span className="font-normal text-slate-500 normal-case">(opcional)</span></label>
                <span className="text-[11px] text-slate-500">{colores.length === 0 ? 'Sin colores definidos' : `${colores.length} color${colores.length !== 1 ? 'es' : ''}`}</span>
              </div>
              {colores.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {colores.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.06] border border-white/10 text-xs text-slate-200">
                      {c.codigo_hex && (
                        <div className="h-3.5 w-3.5 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: c.codigo_hex }} />
                      )}
                      <span className="font-medium">{c.nombre}</span>
                      <button
                        type="button"
                        onClick={() => setColores((prev) => prev.filter((_, i) => i !== idx))}
                        className="ml-1 text-slate-400 hover:text-rose-400 transition-colors"
                        aria-label="Quitar color"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <input
                    type="text"
                    className="input text-sm !py-1.5"
                    placeholder="Nombre del color (ej: Rojo, Azul marino, Blanco)"
                    value={nuevoColor}
                    maxLength={60}
                    onChange={(e) => setNuevoColor(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const nom = nuevoColor.trim();
                        if (!nom) return;
                        if (!colores.some((c) => c.nombre.toLowerCase() === nom.toLowerCase())) {
                          setColores((prev) => [...prev, { nombre: nom, codigo_hex: null }]);
                        }
                        setNuevoColor('');
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nom = nuevoColor.trim();
                    if (!nom) return;
                    if (!colores.some((c) => c.nombre.toLowerCase() === nom.toLowerCase())) {
                      setColores((prev) => [...prev, { nombre: nom, codigo_hex: null }]);
                    }
                    setNuevoColor('');
                  }}
                  className="btn-light !py-2 !px-3 text-xs shrink-0 flex items-center gap-1.5 font-semibold"
                >
                  <Plus size={14} />
                  <span>Agregar</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500">Si el producto viene en varios colores, agréguelos aquí. El cliente podrá elegir cuántos quiere de cada uno al hacer el pedido.</p>
            </div>

            <div>
              <label className="label">Fotografías del producto (hasta 4 imágenes, máx. 3 MB)</label>

              {imgsActuales.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2.5">
                  {imgsActuales.map((i) => (
                    <div key={i.id_imagen} className="relative group">
                      <img
                        src={imgUrl(i.ruta)}
                        className="h-16 w-16 rounded-xl object-contain p-0.5 border border-white/10 bg-white/[0.04]"
                        alt=""
                      />
                      <button
                        type="button"
                        onClick={() => setQuitar([...quitar, i.id_imagen])}
                        className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-rose-600 text-white shadow-sm hover:bg-rose-700"
                        aria-label="Quitar fotografía"
                      >
                        <X size={12} strokeWidth={2.5} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="input text-xs"
                onChange={(e) => setArchivos([...e.target.files].slice(0, 4))}
              />
            </div>

            {error && (
              <div className="rounded-xl bg-rose-500/10 p-3 border border-rose-500/20 text-xs font-semibold text-rose-300 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-white/10">
              <button type="button" className="btn-light w-full sm:w-auto" onClick={onCancelar}>
                Cancelar
              </button>
              <button type="submit" className="btn-cta w-full sm:w-auto" disabled={cargando}>
                {cargando ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                <span>{cargando ? 'Guardando…' : 'Guardar producto'}</span>
              </button>
            </div>
          </form>

          {/* Modal Sugerir Categoría desde el formulario */}
          {modalSugerir && (
            <Modal
              abierto={modalSugerir}
              onCerrar={() => setModalSugerir(false)}
              titulo="Sugerir nueva categoría"
            >
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!sugNombre.trim() || sugNombre.trim().length < 3) {
                    toast.error('El nombre de la categoría debe tener al menos 3 caracteres');
                    return;
                  }
                  setEnviandoSug(true);
                  try {
                    await api('/empresa/solicitud-categoria', {
                      method: 'POST',
                      body: { nombre: sugNombre.trim(), motivo: sugMotivo.trim() },
                    });
                    toast.success('Sugerencia de categoría enviada al administrador');
                    setModalSugerir(false);
                    setSugNombre('');
                    setSugMotivo('');
                    if (onCategoriaSugerida) onCategoriaSugerida();
                  } catch (err) {
                    toast.error(err.message);
                  } finally {
                    setEnviandoSug(false);
                  }
                }}
                className="space-y-4"
              >
                <p className="text-xs text-slate-300">
                  Si no encuentra un rubro adecuado para este producto, envíe una sugerencia. El administrador la revisará y se le notificará por correo electrónico.
                </p>
                <div className="space-y-1">
                  <label className="label text-xs font-bold uppercase text-slate-300" htmlFor="sug-cat-nombre">
                    Nombre de la categoría *
                  </label>
                  <input
                    id="sug-cat-nombre"
                    className="input text-sm"
                    placeholder="Ej. Robótica y Sensores"
                    value={sugNombre}
                    onChange={(e) => setSugNombre(e.target.value)}
                    maxLength={80}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="label text-xs font-bold uppercase text-slate-300" htmlFor="sug-cat-motivo">
                    Motivo o tipo de productos (opcional)
                  </label>
                  <input
                    id="sug-cat-motivo"
                    className="input text-sm"
                    placeholder="Ej. Módulos electrónicos y componentes DIY"
                    value={sugMotivo}
                    onChange={(e) => setSugMotivo(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    className="btn-light text-xs"
                    onClick={() => setModalSugerir(false)}
                    disabled={enviandoSug}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-cta text-xs"
                    disabled={enviandoSug}
                  >
                    {enviandoSug ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    <span>Enviar sugerencia</span>
                  </button>
                </div>
              </form>
            </Modal>
          )}
    </Modal>
  );
}

function EstadoVerificacion({ perfil, onReenviado }) {
  const [archivo, setArchivo] = useState(null);
  const [msg, setMsg] = useState('');
  const [cargando, setCargando] = useState(false);

  const reenviar = async () => {
    if (!archivo) return setMsg('Seleccione el archivo PDF del NIT corregido.');
    const form = new FormData();
    form.append('documento', archivo);
    setCargando(true);
    setMsg('');
    try {
      await api('/empresa/verificacion', { method: 'POST', form });
      toast.success('Documento reenviado para revisión');
      onReenviado();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setCargando(false);
    }
  };

  if (perfil.estado_verificacion === 'pendiente') {
    return (
      <div className="card border border-cyan-400/30 bg-gradient-to-br from-[#111d4a] via-[#101b42] to-[#17134a] p-6 sm:p-8 space-y-4 shadow-lg shadow-cyan-950/20">
        <div className="flex items-center gap-2.5 text-cyan-300 font-bold text-lg">
          <Clock size={22} className="text-cyan-300" aria-hidden="true" />
          <span>Verificación legal en proceso (24 a 48 horas)</span>
        </div>
        <p className="text-sm text-slate-200 leading-relaxed max-w-3xl">
          Su aprobación está en espera. La revisión de sus datos y la verificación de su NIT tarda de <strong>24 a 48 horas</strong>.
          Una vez verificada su empresa, le enviaremos un correo electrónico de aprobación a <strong className="text-cyan-300">{perfil.correo || 'su correo registrado'}</strong> con los pasos e instrucciones de pago por QR o transferencia para activar su portal y publicar su catálogo.
        </p>
        <div className="rounded-xl bg-cyan-400/10 p-3.5 border border-cyan-300/20 text-xs text-cyan-100 font-medium">
          Si no ve el correo transcurrido este plazo, revise su carpeta de spam o correo no deseado.
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-4 border border-rose-500/30 bg-rose-500/10 p-6">
      <div className="flex items-center gap-2 text-rose-300 font-bold text-base">
        <AlertTriangle size={20} className="text-rose-400" aria-hidden="true" />
        <span>Verificación legal observada</span>
      </div>

      <div className="rounded-xl bg-white/[0.05] p-3.5 border border-white/10">
        <p className="text-[11px] uppercase font-bold text-rose-400">Observación del administrador:</p>
        <p className="text-sm font-semibold text-slate-200 mt-1">
          {perfil.observacion || 'Documento no válido o ilegible.'}
        </p>
      </div>

      <p className="text-xs text-rose-300">
        Por favor adjunte el documento NIT corregido en formato PDF para que el administrador reevalúe su solicitud:
      </p>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="input text-xs max-w-md"
          onChange={(e) => setArchivo(e.target.files[0] || null)}
        />
        <button className="btn-cta shrink-0" onClick={reenviar} disabled={cargando}>
          {cargando ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
          <span>{cargando ? 'Enviando…' : 'Reenviar documento corregido'}</span>
        </button>
      </div>

      {msg && <p className="err">{msg}</p>}
    </div>
  );
}

function MiSuscripcion({ perfil, onActualizado }) {
  const [pagos, setPagos] = useState([]);
  const [cargandoPagos, setCargandoPagos] = useState(false);
  const [modalSubir, setModalSubir] = useState(false);

  // Formulario comprobante
  const [banco, setBanco] = useState('Banco Unión S.A.');
  const [metodo, setMetodo] = useState('qr');
  const [referencia, setReferencia] = useState('');
  const [fechaPago, setFechaPago] = useState(() => new Date().toISOString().slice(0, 10));
  const [observacion, setObservacion] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [errorModal, setErrorModal] = useState('');

  const cargarPagos = useCallback(async () => {
    setCargandoPagos(true);
    try {
      const data = await api('/empresa/pagos');
      setPagos(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCargandoPagos(false);
    }
  }, []);

  useEffect(() => {
    cargarPagos();
  }, [cargarPagos]);

  const pInfo = perfil.pago_info || {};
  const suscripcionActiva = perfil.suscripcion === 'activa';
  const enRevision = perfil.suscripcion === 'en_revision';
  const pendientePago = perfil.suscripcion === 'pendiente_pago';
  const codigoPago = perfil.codigo_pago || 'UM-0001';

  // Días restantes si está activa
  const diasRestantes = perfil.fecha_vencimiento
    ? Math.max(0, Math.ceil((new Date(perfil.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;

  const copiarTexto = (txt, label) => {
    navigator.clipboard.writeText(String(txt)).then(
      () => toast.success(`${label} copiado al portapapeles`),
      () => toast.error('No se pudo copiar')
    );
  };

  const enviarComprobante = async (e) => {
    e.preventDefault();
    if (!archivo) {
      setErrorModal('Debe seleccionar el archivo del comprobante de pago (PDF o imagen).');
      return;
    }
    setErrorModal('');
    setEnviando(true);
    const form = new FormData();
    form.append('banco', banco);
    form.append('metodo', metodo);
    form.append('observacion', observacion.trim());
    form.append('meses', 1);
    form.append('comprobante', archivo);

    try {
      const res = await api('/empresa/pagos', { method: 'POST', form });
      toast.success(res.mensaje || 'Comprobante enviado para revisión del administrador');
      setModalSubir(false);
      setReferencia('');
      setObservacion('');
      setArchivo(null);
      cargarPagos();
      onActualizado();
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const verComprobante = async (id) => {
    try {
      const res = await api(`/empresa/pagos/${id}/comprobante`, { raw: true });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      toast.error(err.message || 'No se pudo abrir el comprobante');
    }
  };

  const descargarQr = async () => {
    try {
      const res = await api('/empresa/qr-pago', { raw: true });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unimarket-qr-pago-${codigoPago}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo descargar la imagen del QR');
    }
  };

  // Progreso de 4 pasos
  const paso1 = perfil.estado_verificacion === 'verificado';
  const paso2 = pagos.length > 0 || suscripcionActiva || enRevision;
  const paso3 = enRevision || suscripcionActiva;
  const paso4 = suscripcionActiva;

  return (
    <div className="space-y-6">
      {/* Barra de Progreso de 4 Pasos */}
      <div className="card p-5 border-white/10 bg-white/[0.04]">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
          Estado del Flujo de Suscripción
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Paso 1 */}
          <div
            className={`p-3 rounded-xl border flex items-center gap-2.5 ${
              paso1
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-white/[0.02] border-white/10 text-slate-400'
            }`}
          >
            <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg font-bold text-xs ${
              paso1 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'
            }`}>
              {paso1 ? <Check size={14} /> : '1'}
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-white truncate">1. Verificada</span>
              <span className="text-[10px] text-slate-400">NIT legal verificado</span>
            </div>
          </div>

          {/* Paso 2 */}
          <div
            className={`p-3 rounded-xl border flex items-center gap-2.5 ${
              paso2
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
            }`}
          >
            <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg font-bold text-xs ${
              paso2 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
            }`}>
              {paso2 ? <Check size={14} /> : '2'}
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-white truncate">2. Pago realizado</span>
              <span className="text-[10px] text-slate-400">Depósito o QR</span>
            </div>
          </div>

          {/* Paso 3 */}
          <div
            className={`p-3 rounded-xl border flex items-center gap-2.5 ${
              paso3
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : enRevision
                ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300'
                : 'bg-white/[0.02] border-white/10 text-slate-400'
            }`}
          >
            <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg font-bold text-xs ${
              paso3 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'
            }`}>
              {paso4 ? <Check size={14} /> : '3'}
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-white truncate">3. En revisión</span>
              <span className="text-[10px] text-slate-400">Verificación admin</span>
            </div>
          </div>

          {/* Paso 4 */}
          <div
            className={`p-3 rounded-xl border flex items-center gap-2.5 ${
              paso4
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 shadow-sm'
                : 'bg-white/[0.02] border-white/10 text-slate-400'
            }`}
          >
            <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg font-bold text-xs ${
              paso4 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'
            }`}>
              {paso4 ? <Sparkles size={14} /> : '4'}
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-white truncate">4. Portal activo</span>
              <span className="text-[10px] text-slate-400">Catálogo visible</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjeta de Estado Activa vs Pendiente */}
      {suscripcionActiva ? (
        <div className="card p-6 border-emerald-500/30 bg-emerald-500/10 space-y-3 rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base sm:text-lg">Suscripción activa</h3>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Plan Único · Bs {pInfo.monto_mensual || 200}/mes · Válida hasta{' '}
                  <b>{String(perfil.fecha_vencimiento).slice(0, 10)}</b> ({diasRestantes} días restantes)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModalSubir(true)}
              className="btn-light text-xs font-bold self-start sm:self-auto"
            >
              <Upload size={14} />
              <span>Renovar / Enviar comprobante</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-6 border-amber-400/30 bg-amber-500/10 space-y-4 rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-200 font-bold text-base">
                <AlertTriangle size={20} className="text-amber-400" />
                <span>
                  {enRevision
                    ? 'Comprobante en revisión por el administrador'
                    : `Active su portal realizando el pago mensual de Bs ${pInfo.monto_mensual || 200}`}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed max-w-2xl">
                {enRevision
                  ? 'Hemos recibido su comprobante de pago. El administrador confirmará el depósito bancario en breve para activar su catálogo en las búsquedas públicas.'
                  : `Su empresa fue verificada comercialmente. Para que su portal y productos se publiquen en el catálogo de UNIMARKET BO, realice el pago de su suscripción de Bs ${pInfo.monto_mensual || 200} y envíe su comprobante.`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setModalSubir(true)}
              className="btn-cta text-xs sm:text-sm shrink-0 self-start sm:self-auto"
            >
              <Upload size={16} />
              <span>Subir comprobante de depósito</span>
            </button>
          </div>

          {/* Código de pago destacado */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-white/10 bg-black/40">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 uppercase font-bold">Su Código de Pago Único:</span>
              <span className="font-mono text-base font-extrabold text-cyan-300 bg-cyan-500/20 px-3 py-1 rounded-lg border border-cyan-400/30">
                {codigoPago}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copiarTexto(codigoPago, 'Código de pago')}
              className="btn-light !py-1 text-xs inline-flex items-center gap-1.5"
            >
              <Copy size={13} />
              <span>Copiar código</span>
            </button>
          </div>
        </div>
      )}

      {/* Datos Bancarios y QR Oficiales (siempre visibles o colapsables según estado) */}
      <div className="card p-6 sm:p-8 space-y-6 border-white/10 bg-white/[0.04]">
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Landmark size={20} className="text-cyan-400" />
            <span>Datos bancarios oficiales para el depósito</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Realice la transferencia o pago por QR por el monto exacto de <b>Bs {pInfo.monto_mensual || 200}</b> indicando su código{' '}
            <b className="font-mono text-cyan-300">{codigoPago}</b> en la glosa.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 pt-2 border-t border-white/10">
          {/* Opción 1: QR Simple */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center space-y-4 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-0.5 text-xs font-bold text-cyan-300 border border-cyan-500/20">
                <QrCode size={13} />
                <span>Opción 1: Pago QR Simple (Bs {pInfo.monto_mensual || 200})</span>
              </span>
              <p className="text-xs text-slate-300">Escanee el código QR desde cualquier aplicación bancaria boliviana</p>
            </div>

            <div className="mx-auto w-48 h-48 bg-white rounded-2xl border border-white/10 p-2 shadow-2xs grid place-items-center">
              <img
                src="/qr-pago.png"
                alt="Código QR de Pago UNIMARKET BO"
                className="w-full h-full object-contain rounded-xl"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const monto = pInfo.monto_mensual ? `Bs ${pInfo.monto_mensual}` : 'Bs 200';
                  const banco = pInfo.banco || 'Banco Unión S.A.';
                  e.target.parentNode.innerHTML =
                    `<div class="flex flex-col items-center justify-center gap-2 h-full text-slate-500 text-xs text-center p-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3" rx="0.5"/><rect x="18" y="14" width="3" height="3" rx="0.5"/><rect x="14" y="18" width="3" height="3" rx="0.5"/><rect x="18" y="18" width="3" height="3" rx="0.5"/></svg>
                      <b>QR no disponible</b>
                      <span>${monto}</span>
                      <span>${banco}</span>
                    </div>`;
                }}
              />
            </div>

            <div>
              <button type="button" onClick={descargarQr} className="btn-light text-xs w-full sm:w-auto">
                <Download size={14} />
                <span>Descargar imagen QR</span>
              </button>
            </div>
          </div>

          {/* Opción 2: Transferencia Bancaria */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-0.5 text-xs font-bold text-cyan-300 border border-cyan-500/20">
                <Landmark size={13} />
                <span>Opción 2: Transferencia Bancaria Directa</span>
              </span>
              <p className="text-xs text-slate-300">Depósito a la cuenta recaudadora oficial de UNIMARKET BO</p>
            </div>

            <div className="bg-white/[0.05] rounded-2xl border border-white/10 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="text-slate-400">Banco:</span>
                <span className="font-bold text-white">{pInfo.banco || 'Banco Unión S.A.'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="text-slate-400">Titular:</span>
                <span className="font-bold text-white">{pInfo.titular || 'UNIMARKET BO'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="text-slate-400">N° de Cuenta:</span>
                <div className="flex items-center gap-1 font-mono font-bold text-white">
                  <span>{pInfo.cuenta || '10000034567890'}</span>
                  <button
                    type="button"
                    onClick={() => copiarTexto(pInfo.cuenta || '10000034567890', 'N° de Cuenta')}
                    className="p-1 text-slate-400 hover:text-cyan-300"
                    title="Copiar cuenta"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="text-slate-400">Tipo de cuenta:</span>
                <span className="font-semibold text-slate-200">{pInfo.tipo_cuenta || 'Caja de Ahorros en Bs'}</span>
              </div>
              <div className="flex justify-between items-center pt-1 text-cyan-300">
                <span className="font-bold">Glosa requerida:</span>
                <div className="flex items-center gap-1 font-mono font-bold bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/30">
                  <span>{codigoPago}</span>
                  <button
                    type="button"
                    onClick={() => copiarTexto(codigoPago, 'Glosa')}
                    className="p-0.5 text-cyan-300 hover:text-white"
                    title="Copiar código para glosa"
                  >
                    <Copy size={11} />
                  </button>
                </div>
              </div>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setModalSubir(true)}
                className="btn-cta text-xs w-full sm:w-auto"
              >
                <Upload size={14} />
                <span>Subir comprobante de pago</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Historial de Pagos y Comprobantes */}
      <div className="card p-6 sm:p-8 space-y-4 border-white/10 bg-white/[0.04]">
        <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <FileText size={20} className="text-cyan-400" />
          <span>Historial de pagos y comprobantes</span>
        </h3>

        {cargandoPagos ? (
          <div className="py-8 text-center text-slate-400 text-xs">Cargando historial de pagos…</div>
        ) : !pagos.length ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Aún no ha enviado comprobantes de pago.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-white/[0.06] text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-white/10">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Monto</th>
                  <th className="p-3">Banco / Método</th>
                  <th className="p-3">Referencia</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Comprobante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {pagos.map((p) => (
                  <tr key={p.id_pago} className="hover:bg-white/[0.05] transition-colors">
                    <td className="p-3 text-slate-400 whitespace-nowrap">
                      {p.fecha ? String(p.fecha).slice(0, 10) : '—'}
                    </td>
                    <td className="p-3 font-bold text-white whitespace-nowrap">{bs(p.monto)}</td>
                    <td className="p-3 text-xs font-semibold text-slate-300">
                      <span className="uppercase">{p.metodo}</span>
                      {p.banco && <span className="block text-[11px] text-slate-400">{p.banco}</span>}
                    </td>
                    <td className="p-3 text-slate-300 max-w-xs truncate">
                      {p.referencia || '—'}
                      {p.observacion && p.estado === 'rechazado' && (
                        <p className="text-rose-400 text-xs mt-0.5 font-medium">Obs: {p.observacion}</p>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`badge-${p.estado}`}>{p.estado}</span>
                    </td>
                    <td className="p-3 text-right">
                      {p.comprobante ? (
                        <button
                          type="button"
                          className="btn-light !px-2.5 !py-1 text-xs"
                          onClick={() => verComprobante(p.id_pago)}
                        >
                          <FileText size={13} />
                          <span>Ver</span>
                        </button>
                      ) : (
                        <span className="text-slate-500 text-xs">Sin archivo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Subir Comprobante de Depósito */}
      {modalSubir && (
        <Modal
          abierto={modalSubir}
          onCerrar={() => setModalSubir(false)}
          maxWidth="max-w-lg"
          ariaLabelledBy="modal-subir-pago-title"
          headerPersonalizado={
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-[#0A102A]">
              <div className="flex items-center gap-2 text-white font-bold text-lg">
                <Receipt size={20} className="text-cyan-300" />
                <span id="modal-subir-pago-title">Subir Comprobante de Depósito</span>
              </div>
              <button
                type="button"
                onClick={() => setModalSubir(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
          }
        >
          <form onSubmit={enviarComprobante} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="label text-xs font-bold uppercase">Monto a pagar</label>
                <input
                  type="text"
                  className="input text-sm font-bold bg-white/5 text-white"
                  value={`Bs ${pInfo.monto_mensual || 200}.00`}
                  readOnly
                  disabled
                />
              </div>
              <div className="space-y-1">
                <label className="label text-xs font-bold uppercase">Código de pago</label>
                <input
                  type="text"
                  className="input text-sm font-mono font-bold bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                  value={codigoPago}
                  readOnly
                  disabled
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="label text-xs font-bold uppercase" htmlFor="subir-banco">
                  Banco emisor *
                </label>
                <Select
                  id="subir-banco"
                  name="banco"
                  value={banco}
                  options={[
                    { value: 'Banco Unión S.A.', label: 'Banco Unión S.A.' },
                    { value: 'Banco Nacional de Bolivia', label: 'Banco Nacional de Bolivia (BNB)' },
                    { value: 'Banco Mercantil Santa Cruz', label: 'Banco Mercantil Santa Cruz' },
                    { value: 'Banco BCP', label: 'Banco de Crédito (BCP)' },
                    { value: 'Banco FIE', label: 'Banco FIE' },
                    { value: 'Banco BISA', label: 'Banco BISA' },
                    { value: 'Banco Ganadero', label: 'Banco Ganadero' },
                    { value: 'Banco Económico', label: 'Banco Económico' },
                    { value: 'Otro', label: 'Otro Banco / Entidad' },
                  ]}
                  onChange={(e) => setBanco(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="label text-xs font-bold uppercase" htmlFor="subir-metodo">
                  Método de pago *
                </label>
                <Select
                  id="subir-metodo"
                  name="metodo"
                  value={metodo}
                  options={[
                    { value: 'qr', label: 'Pago QR Simple' },
                    { value: 'transferencia', label: 'Transferencia bancaria' },
                    { value: 'deposito', label: 'Depósito en ventanilla' },
                  ]}
                  onChange={(e) => setMetodo(e.target.value)}
                />
              </div>
            </div>



            <div className="space-y-1">
              <label className="label text-xs font-bold uppercase" htmlFor="subir-archivo">
                Archivo comprobante (PDF, JPG, PNG, máx. 5 MB) *
              </label>
              <input
                id="subir-archivo"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="input text-xs"
                onChange={(e) => setArchivo(e.target.files[0] || null)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="label text-xs font-bold uppercase" htmlFor="subir-obs">
                Observación o nota adicional (opcional)
              </label>
              <input
                id="subir-obs"
                type="text"
                className="input text-sm"
                placeholder="Ej. Transferencia realizada desde cuenta titular de la empresa"
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
              />
            </div>

            {errorModal && (
              <div className="rounded-xl bg-rose-500/10 p-3 border border-rose-500/20 text-xs text-rose-300">
                {errorModal}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                className="btn-light text-xs"
                onClick={() => setModalSubir(false)}
                disabled={enviando}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-cta text-xs" disabled={enviando}>
                {enviando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                <span>{enviando ? 'Enviando…' : 'Enviar comprobante para revisión'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// PESTAÑA: CONTROL DE INVENTARIO Y MOVIMIENTOS (PARTE 5)
// -------------------------------------------------------------------------
function Inventario({ prods, perfil, onActualizado }) {
  const [ajusteProd, setAjusteProd] = useState(null);
  const [tipoAjuste, setTipoAjuste] = useState('entrada');
  const [cantidadAjuste, setCantidadAjuste] = useState('1');
  const [notaAjuste, setNotaAjuste] = useState('');
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);

  const [movProd, setMovProd] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [cargandoMovs, setCargandoMovs] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const suscripcionActiva = perfil.suscripcion === 'activa';

  // Cálculos de métricas
  const totalItems = prods.length;
  const unidadesTotales = prods.reduce((acc, p) => acc + (Number(p.stock_actual) || 0), 0);
  const valorInventario = prods.reduce((acc, p) => acc + (Number(p.stock_actual) || 0) * (Number(p.precio) || 0), 0);
  const stockBajoCount = prods.filter((p) => Number(p.stock_actual) <= Number(p.stock_minimo)).length;

  const prodsFiltrados = prods.filter((p) => {
    const coincideTexto =
      p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.sku?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.categoria?.toLowerCase().includes(busqueda.toLowerCase());

    if (!coincideTexto) return false;

    if (filtroEstado === 'bajo') return Number(p.stock_actual) <= Number(p.stock_minimo) && Number(p.stock_actual) > 0;
    if (filtroEstado === 'agotado') return Number(p.stock_actual) <= 0;
    if (filtroEstado === 'suficiente') return Number(p.stock_actual) > Number(p.stock_minimo);
    return true;
  });

  const abrirAjuste = (p) => {
    setAjusteProd(p);
    setTipoAjuste('entrada');
    setCantidadAjuste('1');
    setNotaAjuste('');
  };

  const guardarAjuste = async (e) => {
    e.preventDefault();
    if (!ajusteProd) return;
    const cant = parseInt(cantidadAjuste, 10);
    if (!Number.isInteger(cant) || cant <= 0) {
      toast.error('La cantidad debe ser un número entero mayor a 0');
      return;
    }
    if (!notaAjuste.trim() || notaAjuste.trim().length < 3) {
      toast.error('Debe ingresar un motivo o nota del ajuste (mínimo 3 caracteres)');
      return;
    }

    setGuardandoAjuste(true);
    try {
      const res = await api(`/empresa/inventario/${ajusteProd.id_producto}/ajuste`, {
        method: 'POST',
        body: {
          tipo: tipoAjuste,
          cantidad: cant,
          nota: notaAjuste.trim(),
        },
      });
      toast.success(res.mensaje || 'Inventario actualizado con éxito');
      setAjusteProd(null);
      onActualizado();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGuardandoAjuste(false);
    }
  };

  const verMovimientos = async (p) => {
    setMovProd(p);
    setCargandoMovs(true);
    try {
      const movs = await api(`/empresa/inventario/${p.id_producto}/movimientos`);
      setMovimientos(Array.isArray(movs) ? movs : []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCargandoMovs(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de solo lectura si la suscripción no está activa */}
      {!suscripcionActiva && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 flex items-center gap-3">
          <AlertTriangle size={18} className="shrink-0 text-amber-400" />
          <span>
            <b>Modo de solo lectura:</b> Su suscripción no se encuentra activa. Para registrar ajustes de inventario y
            descuentos automáticos, active su suscripción en la pestaña "Mi suscripción".
          </span>
        </div>
      )}

      {/* KPI Cards de Inventario */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 space-y-1 border-white/10 bg-white/[0.04]">
          <span className="text-[11px] font-bold uppercase text-slate-400">Total Productos</span>
          <p className="text-xl sm:text-2xl font-extrabold text-white">{totalItems}</p>
          <span className="text-[10px] text-slate-500">Ítems registrados</span>
        </div>

        <div className="card p-4 space-y-1 border-white/10 bg-white/[0.04]">
          <span className="text-[11px] font-bold uppercase text-slate-400">Unidades en Almacén</span>
          <p className="text-xl sm:text-2xl font-extrabold text-cyan-300">{unidadesTotales}</p>
          <span className="text-[10px] text-slate-500">Stock físico total</span>
        </div>

        <div className="card p-4 space-y-1 border-white/10 bg-white/[0.04]">
          <span className="text-[11px] font-bold uppercase text-slate-400">Valor Estimado</span>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-300">{bs(valorInventario)}</p>
          <span className="text-[10px] text-slate-500">Precio catálogo</span>
        </div>

        <div className="card p-4 space-y-1 border-white/10 bg-white/[0.04]">
          <span className="text-[11px] font-bold uppercase text-slate-400">Stock Bajo / Alerta</span>
          <p className={`text-xl sm:text-2xl font-extrabold ${stockBajoCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
            {stockBajoCount}
          </p>
          <span className="text-[10px] text-slate-500">Requieren reposición</span>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="card p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-white/10 bg-white/[0.04]">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            className="input pl-10 text-xs sm:text-sm"
            placeholder="Buscar por nombre, SKU o categoría…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          {['todos', 'suficiente', 'bajo', 'agotado'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFiltroEstado(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                filtroEstado === st
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {st === 'todos' ? 'Todos' : st === 'bajo' ? 'Stock bajo' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Inventario */}
      <div className="card overflow-hidden p-0 border border-white/10 bg-white/[0.04]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.06] text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-white/10">
              <tr>
                <th className="p-4">Producto</th>
                <th className="p-4">SKU</th>
                <th className="p-4">Stock Actual</th>
                <th className="p-4">Stock Mínimo</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-right whitespace-nowrap min-w-[160px]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {prodsFiltrados.map((p) => {
                const stock = Number(p.stock_actual) || 0;
                const min = Number(p.stock_minimo) || 20;
                const esAgotado = stock <= 0;
                const esBajo = stock <= min && stock > 0;

                return (
                  <tr key={p.id_producto} className="hover:bg-white/[0.05] transition-colors">
                    <td className="p-4 flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] overflow-hidden border border-white/10">
                        {p.imagenes && p.imagenes[0] ? (
                          <img src={imgUrl(p.imagenes[0].ruta)} className="h-full w-full object-contain p-0.5" alt="" />
                        ) : (
                          <Package size={18} className="text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-white text-sm block truncate">{p.nombre}</span>
                        <span className="text-xs text-slate-400">{p.categoria} · {bs(p.precio)}</span>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-300">
                      {p.sku || <span className="text-slate-500">—</span>}
                    </td>
                    <td className="p-4">
                      <span className="text-base font-extrabold text-white">{stock}</span>
                      <span className="text-xs text-slate-400 ml-1">({p.unidad || 'u'})</span>
                    </td>
                    <td className="p-4 text-xs text-slate-400 font-mono">
                      {min} {p.unidad || 'u'}
                    </td>
                    <td className="p-4">
                      {esAgotado ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                          Agotado (0 {p.unidad || 'u'})
                        </span>
                      ) : esBajo ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Stock bajo ({stock} {p.unidad || 'u'})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          Suficiente ({stock} {p.unidad || 'u'})
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => abrirAjuste(p)}
                          className="btn-light !px-2.5 !py-1 text-xs inline-flex items-center gap-1.5 shrink-0"
                          disabled={!suscripcionActiva}
                          title={suscripcionActiva ? 'Ajustar existencias físicas' : 'Suscripción no activa'}
                        >
                          <SlidersHorizontal size={12} />
                          <span>Ajustar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => verMovimientos(p)}
                          className="btn-light !px-2.5 !py-1 text-xs inline-flex items-center gap-1.5 shrink-0"
                          title="Ver historial de movimientos"
                        >
                          <Clock size={12} />
                          <span>Kardex</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!prodsFiltrados.length && (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-400 text-sm">
                    No se encontraron productos con el filtro aplicado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajustar Stock */}
      {ajusteProd && (
        <Modal
          abierto={!!ajusteProd}
          onCerrar={() => setAjusteProd(null)}
          maxWidth="max-w-md"
          ariaLabelledBy="ajuste-stock-title"
          headerPersonalizado={
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-[#0A102A]">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <SlidersHorizontal size={18} className="text-cyan-300" />
                <span id="ajuste-stock-title">Ajuste de Inventario: {ajusteProd.nombre}</span>
              </div>
              <button
                type="button"
                onClick={() => setAjusteProd(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>
          }
        >
          <form onSubmit={guardarAjuste} className="space-y-4">
            <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between text-xs">
              <span className="text-slate-400">Stock físico actual:</span>
              <span className="font-extrabold text-white font-mono text-sm">
                {ajusteProd.stock_actual} {ajusteProd.unidad || 'u'}
              </span>
            </div>

            <div className="space-y-1">
              <label className="label text-xs font-bold uppercase" htmlFor="tipo-ajuste">
                Tipo de movimiento *
              </label>
              <Select
                id="tipo-ajuste"
                name="tipoAjuste"
                value={tipoAjuste}
                options={[
                  { value: 'entrada', label: 'Entrada (+) Compra o ingreso al almacén' },
                  { value: 'salida', label: 'Salida (-) Merma, daño o ajuste negativo' },
                  { value: 'ajuste', label: 'Ajuste (=) Fijar conteo físico exacto' },
                ]}
                onChange={(e) => setTipoAjuste(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="label text-xs font-bold uppercase" htmlFor="cant-ajuste">
                Cantidad ({ajusteProd.unidad || 'unidades'}) *
              </label>
              <input
                id="cant-ajuste"
                type="number"
                min="1"
                className="input text-sm font-bold"
                value={cantidadAjuste}
                onChange={(e) => setCantidadAjuste(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="label text-xs font-bold uppercase" htmlFor="nota-ajuste">
                Motivo / Justificación *
              </label>
              <input
                id="nota-ajuste"
                type="text"
                className="input text-sm"
                placeholder="Ej. Compra proveedor lote #24, corrección inventario físico"
                value={notaAjuste}
                onChange={(e) => setNotaAjuste(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                className="btn-light text-xs"
                onClick={() => setAjusteProd(null)}
                disabled={guardandoAjuste}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-cta text-xs" disabled={guardandoAjuste}>
                {guardandoAjuste ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>{guardandoAjuste ? 'Guardando…' : 'Registrar movimiento'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Movimientos de Stock (Kardex) */}
      {movProd && (
        <Modal
          abierto={!!movProd}
          onCerrar={() => setMovProd(null)}
          maxWidth="max-w-2xl"
          ariaLabelledBy="kardex-title"
          headerPersonalizado={
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-[#0A102A]">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Clock size={18} className="text-cyan-300" />
                <span id="kardex-title">Historial de Movimientos: {movProd.nombre}</span>
              </div>
              <button
                type="button"
                onClick={() => setMovProd(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {cargandoMovs ? (
              <div className="py-8 text-center text-slate-400 text-xs">Cargando kardex…</div>
            ) : !movimientos.length ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No hay movimientos registrados para este producto.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.06] text-slate-400 font-bold uppercase tracking-wider border-b border-white/10">
                    <tr>
                      <th className="p-2.5">Fecha</th>
                      <th className="p-2.5">Tipo</th>
                      <th className="p-2.5">Cantidad</th>
                      <th className="p-2.5">Stock</th>
                      <th className="p-2.5">Referencia / Nota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {movimientos.map((m) => (
                      <tr key={m.id_movimiento} className="hover:bg-white/[0.03]">
                        <td className="p-2.5 text-slate-400 whitespace-nowrap">
                          {m.fecha ? String(m.fecha).slice(0, 16).replace('T', ' ') : '—'}
                        </td>
                        <td className="p-2.5 uppercase font-bold text-slate-200">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              m.tipo?.includes('salida') || m.tipo?.includes('venta')
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {m.tipo}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold font-mono text-white">
                          {m.cantidad}
                        </td>
                        <td className="p-2.5 text-slate-300 font-mono">
                          {m.stock_anterior} → <b>{m.stock_posterior}</b>
                        </td>
                        <td className="p-2.5 text-slate-300">
                          <div>{m.referencia || '—'}</div>
                          {m.motivo && <span className="text-[10px] text-slate-500 block">{m.motivo}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-white/10">
              <button type="button" className="btn-light text-xs" onClick={() => setMovProd(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// PESTAÑA: FACTURACIÓN / REGISTRO DE VENTAS WHATSAPP Y MOSTRADOR (PARTE 5)
// -------------------------------------------------------------------------
function Facturacion({ prods, perfil, onActualizado }) {
  const [ventas, setVentas] = useState([]);
  const [cargandoVentas, setCargandoVentas] = useState(false);
  const [modalNuevaVenta, setModalNuevaVenta] = useState(false);
  const [anularVentaModal, setAnularVentaModal] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [anulando, setAnulando] = useState(false);
  const [ventaParaCompartir, setVentaParaCompartir] = useState(null);

  // Formulario nueva venta
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState('nuevo');
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', nit_ci: '', telefono: '', correo: '', direccion: '' });
  const [itemsVenta, setItemsVenta] = useState([]);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [canal, setCanal] = useState('whatsapp');
  const [observaciones, setObservaciones] = useState('');
  const [guardandoVenta, setGuardandoVenta] = useState(false);

  // Item selector
  const [itemProdId, setItemProdId] = useState('');
  const [itemCantidad, setItemCantidad] = useState(1);
  const [itemDescuento, setItemDescuento] = useState(0);

  const suscripcionActiva = perfil.suscripcion === 'activa';

  const cargarVentas = useCallback(async () => {
    setCargandoVentas(true);
    try {
      const data = await api('/empresa/ventas');
      setVentas(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCargandoVentas(false);
    }
  }, []);

  useEffect(() => {
    cargarVentas();
  }, [cargarVentas]);

  const abrirModalNueva = async () => {
    setModalNuevaVenta(true);
    setItemsVenta([]);
    setItemProdId('');
    setItemCantidad(1);
    setItemDescuento(0);
    setObservaciones('');
    try {
      const clis = await api('/empresa/clientes');
      setClientes(Array.isArray(clis) ? clis : []);
    } catch {
      setClientes([]);
    }
  };

  const agregarItem = () => {
    if (!itemProdId) {
      toast.error('Seleccione un producto');
      return;
    }
    const prod = prods.find((p) => String(p.id_producto) === String(itemProdId));
    if (!prod) return;

    const cant = parseInt(itemCantidad, 10);
    if (!Number.isInteger(cant) || cant <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }
    if (cant > Number(prod.stock_actual)) {
      toast.error(`Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock_actual}`);
      return;
    }

    const desc = Math.max(0, Number(itemDescuento) || 0);
    const precioUnit = Number(prod.precio) || 0;
    const subtotal = Math.max(0, cant * precioUnit - desc);

    setItemsVenta((prev) => [
      ...prev,
      {
        id_producto: prod.id_producto,
        nombre: prod.nombre,
        sku: prod.sku,
        unidad: prod.unidad || 'u',
        cantidad: cant,
        precio_unitario: precioUnit,
        descuento: desc,
        subtotal: subtotal,
      },
    ]);

    setItemProdId('');
    setItemCantidad(1);
    setItemDescuento(0);
  };

  const quitarItem = (idx) => {
    setItemsVenta((prev) => prev.filter((_, i) => i !== idx));
  };

  const subtotalTotal = itemsVenta.reduce((acc, it) => acc + it.cantidad * it.precio_unitario, 0);
  const descuentoTotal = itemsVenta.reduce((acc, it) => acc + it.descuento, 0);
  const totalFinal = Math.max(0, subtotalTotal - descuentoTotal);

  const guardarVenta = async (e) => {
    e.preventDefault();
    if (!itemsVenta.length) {
      toast.error('Debe incluir al menos un producto en la venta');
      return;
    }

    let payloadCliente = null;
    if (clienteSeleccionado === 'nuevo') {
      if (!nuevoCliente.nombre.trim() || nuevoCliente.nombre.trim().length < 2) {
        toast.error('Ingrese el nombre del cliente');
        return;
      }
      payloadCliente = {
        nombre: nuevoCliente.nombre.trim(),
        nit_ci: nuevoCliente.nit_ci.trim() || '0',
        telefono: nuevoCliente.telefono.trim(),
        correo: nuevoCliente.correo ? nuevoCliente.correo.trim() : null,
        direccion: nuevoCliente.direccion.trim(),
      };
    } else {
      payloadCliente = { id_cliente: parseInt(clienteSeleccionado, 10) };
    }

    setGuardandoVenta(true);
    try {
      const res = await api('/empresa/ventas', {
        method: 'POST',
        body: {
          cliente: payloadCliente,
          items: itemsVenta,
          metodo_pago: metodoPago,
          canal: canal,
          observaciones: observaciones.trim(),
        },
      });

      toast.success(res.mensaje || 'Venta registrada con éxito');
      setModalNuevaVenta(false);
      cargarVentas();
      onActualizado();

      // Abrir modal para enviar comprobante al cliente de inmediato
      setVentaParaCompartir({
        id_venta: res.id_venta,
        correlativo: res.correlativo,
        total: res.total,
        cliente_nombre: payloadCliente?.nombre || 'Cliente General',
        cliente_telefono: payloadCliente?.telefono,
        cliente_correo: payloadCliente?.correo,
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGuardandoVenta(false);
    }
  };

  const anularVenta = async (e) => {
    e.preventDefault();
    if (!anularVentaModal) return;
    if (!motivoAnulacion.trim() || motivoAnulacion.trim().length < 3) {
      toast.error('Debe indicar el motivo de la anulación');
      return;
    }
    setAnulando(true);
    try {
      const res = await api(`/empresa/ventas/${anularVentaModal}/anular`, {
        method: 'POST',
        body: { motivo: motivoAnulacion.trim() },
      });
      toast.success(res.mensaje || 'Venta anulada e inventario restablecido');
      setAnularVentaModal(null);
      setMotivoAnulacion('');
      cargarVentas();
      onActualizado();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAnulando(false);
    }
  };

  const verPdf = async (id, formato) => {
    try {
      const res = await api(`/empresa/ventas/${id}/pdf?formato=${formato}`, { raw: true });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      toast.error(err.message || 'No se pudo generar el comprobante');
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de solo lectura si la suscripción no está activa */}
      {!suscripcionActiva && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 flex items-center gap-3">
          <AlertTriangle size={18} className="shrink-0 text-amber-400" />
          <span>
            <b>Modo de solo lectura:</b> Su suscripción no se encuentra activa. Para emitir comprobantes y registrar
            ventas con control de inventario en vivo, reactive su suscripción en "Mi suscripción".
          </span>
        </div>
      )}

      {/* Encabezado con Botón Nueva Venta */}
      <div className="card p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-white/10 bg-white/[0.04]">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Receipt size={20} className="text-cyan-400" />
            <span>Registro de Ventas y Comprobantes</span>
          </h3>
          <p className="text-xs text-slate-400">
            Registre sus ventas cerradas por WhatsApp o mostrador con descuento automático de existencias y emisión de
            tickets térmicos (80mm) y recibos en PDF.
          </p>
        </div>

        <button
          type="button"
          onClick={abrirModalNueva}
          className="btn-cta text-xs sm:text-sm shrink-0"
          disabled={!suscripcionActiva}
        >
          <Plus size={16} />
          <span>Nueva venta</span>
        </button>
      </div>

      {/* Listado de Ventas Registradas */}
      <div className="card overflow-hidden p-0 border border-white/10 bg-white/[0.04]">
        {cargandoVentas ? (
          <div className="p-8 text-center text-slate-400 text-xs">Cargando registro de ventas…</div>
        ) : !ventas.length ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Aún no ha registrado ventas. Haga clic en "+ Nueva venta" para comenzar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.06] text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-white/10">
                <tr>
                  <th className="p-4">Correlativo</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Canal / Método</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-right">Comprobantes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {ventas.map((v) => (
                  <tr key={v.id_venta} className="hover:bg-white/[0.05] transition-colors">
                    <td className="p-4 font-mono font-bold text-cyan-300 text-xs">
                      {v.correlativo || `VTA-${v.numero_formato}`}
                    </td>
                    <td className="p-4 text-xs text-slate-400">
                      {v.fecha ? String(v.fecha).slice(0, 16).replace('T', ' ') : '—'}
                    </td>
                    <td className="p-4 text-xs">
                      <span className="font-bold text-white block">{v.cliente_nombre || 'Cliente General'}</span>
                      <span className="text-slate-400 font-mono text-[11px]">NIT/CI: {v.cliente_nit || '0'}</span>
                    </td>
                    <td className="p-4 text-xs">
                      <span className="capitalize text-slate-200 font-semibold block">{v.canal}</span>
                      <span className="text-[11px] text-slate-400 uppercase">{v.metodo_pago}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-extrabold text-white text-base">{bs(v.total)}</span>
                      {Number(v.descuento) > 0 && (
                        <span className="text-[11px] text-amber-300 block">Desc: {bs(v.descuento)}</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          v.estado === 'emitida'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                        }`}
                      >
                        {v.estado}
                      </span>
                      {v.motivo_anulacion && (
                        <span className="text-[10px] text-rose-400 block mt-0.5">Obs: {v.motivo_anulacion}</span>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setVentaParaCompartir(v)}
                        className="btn-light !text-emerald-300 hover:!bg-emerald-500/15 !border-emerald-500/30 !px-2.5 !py-1 text-xs inline-flex items-center gap-1.5"
                        title="Enviar comprobante al cliente por WhatsApp o Correo"
                      >
                        <Share2 size={12} className="text-emerald-400" />
                        <span>Enviar al cliente</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => verPdf(v.id_venta, 'ticket')}
                        className="btn-light !px-2.5 !py-1 text-xs"
                        title="Ver ticket térmico de 80mm"
                      >
                        <Printer size={12} />
                        <span>Ticket 80mm</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => verPdf(v.id_venta, 'a4')}
                        className="btn-light !px-2.5 !py-1 text-xs"
                        title="Ver recibo oficial en A4"
                      >
                        <FileText size={12} />
                        <span>Recibo A4</span>
                      </button>
                      {v.estado === 'emitida' && (
                        <button
                          type="button"
                          onClick={() => setAnularVentaModal(v.id_venta)}
                          className="btn-light !text-rose-400 hover:!bg-rose-500/10 !px-2 !py-1 text-xs"
                          title="Anular venta y restaurar existencias"
                        >
                          <RotateCcw size={12} />
                          <span>Anular</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nueva Venta */}
      {modalNuevaVenta && (
        <Modal
          abierto={modalNuevaVenta}
          onCerrar={() => setModalNuevaVenta(false)}
          maxWidth="max-w-2xl"
          ariaLabelledBy="nueva-venta-title"
          headerPersonalizado={
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-[#0A102A]">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Receipt size={18} className="text-cyan-300" />
                <span id="nueva-venta-title">Registrar Nueva Venta</span>
              </div>
              <button
                type="button"
                onClick={() => setModalNuevaVenta(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>
          }
        >
          <form onSubmit={guardarVenta} className="space-y-5">
            {/* Sección 1: Cliente */}
            <div className="card p-4 space-y-3 border-white/10 bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300">Datos del Comprador</h4>
                <div className="flex items-center gap-2 text-xs">
                  <label className="text-slate-400">Cliente:</label>
                  <select
                    className="input !py-1 !px-2 text-xs"
                    value={clienteSeleccionado}
                    onChange={(e) => setClienteSeleccionado(e.target.value)}
                  >
                    <option value="nuevo">+ Nuevo cliente / Mostrador</option>
                    {clientes.map((c) => (
                      <option key={c.id_cliente} value={String(c.id_cliente)}>
                        {c.nombre} (NIT: {c.nit_ci})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {clienteSeleccionado === 'nuevo' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                  <div>
                    <label className="text-[11px] text-slate-400 block font-bold">Nombre o Razón Social *</label>
                    <input
                      type="text"
                      className="input text-xs"
                      placeholder="Ej. Juan Pérez"
                      value={nuevoCliente.nombre}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block font-bold">NIT o CI</label>
                    <input
                      type="text"
                      className="input text-xs font-mono"
                      placeholder="Ej. 6543210 (opcional)"
                      value={nuevoCliente.nit_ci}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, nit_ci: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block font-bold">WhatsApp / Teléfono</label>
                    <input
                      type="text"
                      className="input text-xs"
                      placeholder="Ej. 70000000"
                      value={nuevoCliente.telefono}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block font-bold">Correo Electrónico</label>
                    <input
                      type="email"
                      className="input text-xs"
                      placeholder="cliente@ejemplo.com"
                      value={nuevoCliente.correo || ''}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, correo: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sección 2: Agregar Productos con Control de Stock en Vivo */}
            <div className="card p-4 space-y-3 border-white/10 bg-white/[0.02]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300">Productos de la Venta</h4>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-6 space-y-1">
                  <label className="text-[11px] text-slate-400 block font-bold">Seleccionar producto</label>
                  <select
                    className="input text-xs"
                    value={itemProdId}
                    onChange={(e) => setItemProdId(e.target.value)}
                  >
                    <option value="">-- Seleccionar producto del catálogo --</option>
                    {prods.map((p) => (
                      <option
                        key={p.id_producto}
                        value={String(p.id_producto)}
                        disabled={Number(p.stock_actual) <= 0}
                      >
                        {p.nombre} · {bs(p.precio)} · (Stock: {p.stock_actual} {p.unidad || 'u'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] text-slate-400 block font-bold">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    className="input text-xs font-bold"
                    value={itemCantidad}
                    onChange={(e) => setItemCantidad(e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] text-slate-400 block font-bold">Desc (Bs)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="input text-xs"
                    value={itemDescuento}
                    onChange={(e) => setItemDescuento(e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <button type="button" onClick={agregarItem} className="btn-light !py-2 text-xs w-full">
                    <Plus size={14} />
                    <span>Agregar</span>
                  </button>
                </div>
              </div>

              {/* Lista de ítems agregados */}
              {itemsVenta.length > 0 && (
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.05] text-slate-400 font-bold border-b border-white/10">
                      <tr>
                        <th className="p-2">Ítem</th>
                        <th className="p-2">Cant</th>
                        <th className="p-2">P. Unit</th>
                        <th className="p-2">Desc</th>
                        <th className="p-2">Subtotal</th>
                        <th className="p-2 text-right">Quitar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {itemsVenta.map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-bold text-white">{it.nombre}</td>
                          <td className="p-2 font-mono">{it.cantidad} {it.unidad}</td>
                          <td className="p-2">{bs(it.precio_unitario)}</td>
                          <td className="p-2 text-amber-300">{it.descuento > 0 ? bs(it.descuento) : '—'}</td>
                          <td className="p-2 font-extrabold text-white">{bs(it.subtotal)}</td>
                          <td className="p-2 text-right">
                            <button
                              type="button"
                              onClick={() => quitarItem(idx)}
                              className="text-rose-400 hover:text-rose-300 p-1"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sección 3: Método de Pago y Canal */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="label text-xs font-bold uppercase" htmlFor="venta-canal">
                  Canal de venta
                </label>
                <Select
                  id="venta-canal"
                  name="canal"
                  value={canal}
                  options={[
                    { value: 'whatsapp', label: 'WhatsApp' },
                    { value: 'mostrador', label: 'Mostrador / Tienda física' },
                    { value: 'telefono', label: 'Llamada telefónica' },
                    { value: 'redes_sociales', label: 'Redes sociales (FB/IG/TikTok)' },
                  ]}
                  onChange={(e) => setCanal(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="label text-xs font-bold uppercase" htmlFor="venta-metodo">
                  Método de cobro
                </label>
                <Select
                  id="venta-metodo"
                  name="metodoPago"
                  value={metodoPago}
                  options={[
                    { value: 'efectivo', label: 'Efectivo' },
                    { value: 'qr', label: 'Pago por QR' },
                    { value: 'transferencia', label: 'Transferencia bancaria' },
                    { value: 'tarjeta', label: 'Tarjeta de débito / crédito' },
                  ]}
                  onChange={(e) => setMetodoPago(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="label text-xs font-bold uppercase" htmlFor="venta-obs">
                Notas u observaciones (opcional)
              </label>
              <input
                id="venta-obs"
                type="text"
                className="input text-xs"
                placeholder="Ej. Entregado por delivery a domicilio, pagado contra entrega"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </div>

            {/* Resumen Total */}
            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400">Total a facturar:</span>
                <p className="text-xl font-black text-cyan-300">{bs(totalFinal)}</p>
              </div>
              <div className="text-right text-xs text-slate-400">
                <span>Subtotal: {bs(subtotalTotal)}</span>
                {descuentoTotal > 0 && <span className="block text-amber-300">Desc: -{bs(descuentoTotal)}</span>}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                className="btn-light text-xs"
                onClick={() => setModalNuevaVenta(false)}
                disabled={guardandoVenta}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-cta text-xs"
                disabled={guardandoVenta || itemsVenta.length === 0}
              >
                {guardandoVenta ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>{guardandoVenta ? 'Emitiendo comprobante…' : 'Emitir comprobante y descontar stock'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Anular Venta */}
      <ModalConfirmacion
        abierto={!!anularVentaModal}
        titulo="Anular Venta y Restaurar Stock"
        mensaje="Indique el motivo de la anulación. Las existencias descontadas de los productos se restablecerán automáticamente en el inventario:"
        tipo="peligro"
        requiereTexto={true}
        tipoEntrada="textarea"
        placeholderTexto="Ej. Cancelación del pedido por parte del cliente o error en la cantidad facturada."
        textoBotonConfirmar="Anular venta y reponer stock"
        onConfirmar={(texto) => {
          setMotivoAnulacion(texto);
          anularVenta({ preventDefault: () => {} });
        }}
        onCancelar={() => setAnularVentaModal(null)}
      />

      {/* Modal Enviar Comprobante al Cliente */}
      <ModalEnviarComprobante
        venta={ventaParaCompartir}
        abierto={!!ventaParaCompartir}
        onCerrar={() => setVentaParaCompartir(null)}
      />
    </div>
  );
}

// -------------------------------------------------------------------------
// PESTAÑA: REPORTES COMERCIALES Y EN PDF (PARTE 5)
// -------------------------------------------------------------------------
function Reportes({ prods, perfil }) {
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [periodo, setPeriodo] = useState('mes');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [prodFiltro, setProdFiltro] = useState('');

  const suscripcionActiva = perfil.suscripcion === 'activa';

  // Configurar fechas según el período predeterminado
  useEffect(() => {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().slice(0, 10);

    if (periodo === 'hoy') {
      setDesde(hoyStr);
      setHasta(hoyStr);
    } else if (periodo === 'semana') {
      const hace7Dias = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
      setDesde(hace7Dias.toISOString().slice(0, 10));
      setHasta(hoyStr);
    } else if (periodo === 'mes') {
      const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      setDesde(primerDiaMes.toISOString().slice(0, 10));
      setHasta(hoyStr);
    } else if (periodo === 'anio') {
      const primerDiaAnio = new Date(hoy.getFullYear(), 0, 1);
      setDesde(primerDiaAnio.toISOString().slice(0, 10));
      setHasta(hoyStr);
    } else if (periodo === 'todos') {
      setDesde('');
      setHasta('');
    }
  }, [periodo]);

  const cargarReporte = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (desde) params.append('desde', desde);
      if (hasta) params.append('hasta', hasta);
      if (prodFiltro) params.append('id_producto', prodFiltro);

      const data = await api(`/empresa/reportes/resumen?${params.toString()}`);
      setResumen(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCargando(false);
    }
  }, [desde, hasta, prodFiltro]);

  useEffect(() => {
    cargarReporte();
  }, [cargarReporte]);

  const descargarPdfReporte = async () => {
    try {
      const params = new URLSearchParams();
      if (desde) params.append('desde', desde);
      if (hasta) params.append('hasta', hasta);
      const res = await api(`/empresa/reportes/pdf?${params.toString()}`, { raw: true });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-ventas-${desde || 'historico'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message || 'No se pudo generar el reporte PDF');
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de solo lectura si la suscripción no está activa */}
      {!suscripcionActiva && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 flex items-center gap-3">
          <AlertTriangle size={18} className="shrink-0 text-amber-400" />
          <span>
            <b>Modo de solo lectura:</b> Su suscripción no se encuentra activa. Para consultar informes completos y
            descargar reportes en PDF, reactive su suscripción en "Mi suscripción".
          </span>
        </div>
      )}

      {/* Barra de Filtros de Período y Exportación */}
      <div className="card p-5 space-y-4 border-white/10 bg-white/[0.04]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'hoy', label: 'Hoy' },
              { id: 'semana', label: 'Últimos 7 días' },
              { id: 'mes', label: 'Este mes' },
              { id: 'anio', label: 'Este año' },
              { id: 'todos', label: 'Histórico completo' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodo(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  periodo === p.id
                    ? 'bg-white/15 text-white border border-white/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={descargarPdfReporte}
            className="btn-light !py-2 text-xs inline-flex items-center gap-1.5 font-bold self-start sm:self-auto"
            disabled={!suscripcionActiva}
          >
            <Download size={14} />
            <span>Exportar reporte en PDF</span>
          </button>
        </div>

        {/* Filtros personalizados de fechas y producto */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-white/10 text-xs">
          <div>
            <label className="text-slate-400 block font-bold mb-1">Fecha inicial (Desde)</label>
            <input
              type="date"
              className="input text-xs"
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value);
                setPeriodo('personalizado');
              }}
            />
          </div>
          <div>
            <label className="text-slate-400 block font-bold mb-1">Fecha final (Hasta)</label>
            <input
              type="date"
              className="input text-xs"
              value={hasta}
              onChange={(e) => {
                setHasta(e.target.value);
                setPeriodo('personalizado');
              }}
            />
          </div>
          <div>
            <label className="text-slate-400 block font-bold mb-1">Filtrar por producto</label>
            <select
              className="input text-xs"
              value={prodFiltro}
              onChange={(e) => setProdFiltro(e.target.value)}
            >
              <option value="">-- Todos los productos --</option>
              {prods.map((p) => (
                <option key={p.id_producto} value={String(p.id_producto)}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards de Rendimiento Comercial */}
      {cargando ? (
        <div className="py-12 text-center text-slate-400 text-xs">Cargando reporte comercial…</div>
      ) : resumen ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card p-4 space-y-1 border-white/10 bg-white/[0.04]">
              <span className="text-[11px] font-bold uppercase text-slate-400">Total Ventas</span>
              <p className="text-xl sm:text-2xl font-extrabold text-white">{resumen.total_ventas || 0}</p>
              <span className="text-[10px] text-slate-500">Transacciones emitidas</span>
            </div>

            <div className="card p-4 space-y-1 border-white/10 bg-white/[0.04]">
              <span className="text-[11px] font-bold uppercase text-slate-400">Ingresos Totales</span>
              <p className="text-xl sm:text-2xl font-extrabold text-emerald-300">
                {bs(resumen.ingresos_totales || 0)}
              </p>
              <span className="text-[10px] text-slate-500">Recaudación en período</span>
            </div>

            <div className="card p-4 space-y-1 border-white/10 bg-white/[0.04]">
              <span className="text-[11px] font-bold uppercase text-slate-400">Unidades Vendidas</span>
              <p className="text-xl sm:text-2xl font-extrabold text-cyan-300">
                {resumen.total_unidades_vendidas || 0}
              </p>
              <span className="text-[10px] text-slate-500">Productos despachados</span>
            </div>

            <div className="card p-4 space-y-1 border-white/10 bg-white/[0.04]">
              <span className="text-[11px] font-bold uppercase text-slate-400">Ticket Promedio</span>
              <p className="text-xl sm:text-2xl font-extrabold text-violet-300">
                {bs(resumen.ticket_promedio || 0)}
              </p>
              <span className="text-[10px] text-slate-500">Por venta registrada</span>
            </div>
          </div>

          {/* Gráfico y desglose: Top 5 Productos Más Vendidos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5 space-y-4 border-white/10 bg-white/[0.04]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <TrendingUp size={15} />
                <span>Top Productos Más Vendidos</span>
              </h4>

              {!resumen.top_productos?.length ? (
                <p className="text-xs text-slate-400 py-6 text-center">No hay ventas en este período.</p>
              ) : (
                <div className="space-y-3">
                  {resumen.top_productos.map((tp, idx) => {
                    const maxUnidades = resumen.top_productos[0]?.unidades_vendidas || 1;
                    const pct = Math.round((tp.unidades_vendidas / maxUnidades) * 100);

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-white truncate max-w-[200px]">{tp.nombre}</span>
                          <span className="font-mono text-cyan-300 font-bold">
                            {tp.unidades_vendidas} u · {bs(tp.total_recaudado)}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Alertas de Stock Bajo / Reposición Urgente */}
            <div className="card p-5 space-y-4 border-white/10 bg-white/[0.04]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <AlertTriangle size={15} />
                <span>Productos en Alerta de Stock Bajo ({resumen.productos_stock_bajo?.length || 0})</span>
              </h4>

              {!resumen.productos_stock_bajo?.length ? (
                <p className="text-xs text-emerald-300 py-6 text-center font-medium">
                  Excelente: Todos los productos cuentan con existencias por encima del umbral mínimo.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {resumen.productos_stock_bajo.map((sb, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-white block">{sb.nombre}</span>
                        <span className="text-[10px] text-slate-400 font-mono">SKU: {sb.sku || '—'}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-amber-300 font-mono">
                          {sb.stock_actual} {sb.unidad || 'u'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">mín: {sb.stock_minimo}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


function FormMiPortal({ perfil, onActualizado }) {
  const rawWa = String(perfil.whatsapp || '');
  const waInicial = rawWa.startsWith('591') && rawWa.length === 11 ? rawWa.slice(3) : rawWa;

  const [d, setD] = useState({
    descripcion: perfil.descripcion || '',
    direccion: perfil.direccion || '',
    telefono: perfil.telefono || '',
    whatsapp: waInicial,
    sitio_web: perfil.sitio_web || '',
    facebook: perfil.facebook || '',
    instagram: perfil.instagram || '',
    tiktok: perfil.tiktok || '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [portadaFile, setPortadaFile] = useState(null);
  const [logoPrev, setLogoPrev] = useState(empImgUrl(perfil.logo));
  const [portadaPrev, setPortadaPrev] = useState(empImgUrl(perfil.portada));
  const [errores, setErrores] = useState({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const urlPortal = `${window.location.origin}/tienda/${perfil.slug}`;

  const copiarEnlace = () => {
    navigator.clipboard.writeText(urlPortal);
    toast.success('Enlace de su portal copiado al portapapeles');
  };

  const cambioLogo = (e) => {
    const f = e.target.files[0];
    if (f) {
      setLogoFile(f);
      setLogoPrev(URL.createObjectURL(f));
    }
  };

  const cambioPortada = (e) => {
    const f = e.target.files[0];
    if (f) {
      setPortadaFile(f);
      setPortadaPrev(URL.createObjectURL(f));
    }
  };

  const validarUnCampo = (campo) => {
    let err = '';
    if (campo === 'telefono') err = validarTelefono(d.telefono, true);
    if (campo === 'whatsapp') err = validarWhatsapp(d.whatsapp);
    if (campo === 'sitio_web') err = validarUrl(d.sitio_web, true);
    if (campo === 'facebook') err = validarUrl(d.facebook, true);
    if (campo === 'instagram') err = validarUrl(d.instagram, true);
    if (campo === 'tiktok') err = validarUrl(d.tiktok, true);

    setErrores((prev) => {
      const copy = { ...prev };
      if (err) copy[campo] = err;
      else delete copy[campo];
      return copy;
    });
    return err;
  };

  const camposPortalOrden = [
    { id: 'portal-tel', clave: 'telefono', fn: () => validarTelefono(d.telefono, true) },
    { id: 'portal-wa', clave: 'whatsapp', fn: () => validarWhatsapp(d.whatsapp) },
    { id: 'portal-sitio', clave: 'sitio_web', fn: () => validarUrl(d.sitio_web, true) },
    { id: 'portal-fb', clave: 'facebook', fn: () => validarUrl(d.facebook, true) },
    { id: 'portal-ig', clave: 'instagram', fn: () => validarUrl(d.instagram, true) },
    { id: 'portal-tk', clave: 'tiktok', fn: () => validarUrl(d.tiktok, true) },
  ];

  const guardar = async (e) => {
    e.preventDefault();
    setError('');

    const nuevos = {};
    let primerId = null;

    for (const c of camposPortalOrden) {
      const err = c.fn();
      if (err) {
        nuevos[c.clave] = err;
        if (!primerId) primerId = c.id;
      }
    }

    if (Object.keys(nuevos).length) {
      setErrores(nuevos);
      if (primerId) {
        const el = document.getElementById(primerId);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    setCargando(true);
    const form = new FormData();
    Object.entries(d).forEach(([k, v]) => form.append(k, v));
    if (logoFile) form.append('logo', logoFile);
    if (portadaFile) form.append('portada', portadaFile);

    try {
      const res = await api('/empresa/perfil', { method: 'PUT', form });
      toast.success(res.mensaje || 'Portal actualizado');
      onActualizado();
    } catch (err) {
      setError(err.message);
      if (err instanceof ApiError && err.errores) {
        setErrores(err.errores);
        for (const c of camposPortalOrden) {
          if (err.errores[c.clave]) {
            const el = document.getElementById(c.id);
            if (el) {
              el.focus();
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            break;
          }
        }
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de Enlace Público Oficial */}
      <div className="card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/[0.05] border-white/10 p-5 shadow-2xs">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
            <Store size={15} aria-hidden="true" />
            <span>Enlace público de su tienda oficial</span>
          </p>
          <p className="font-mono text-xs sm:text-sm text-cyan-300 break-all font-medium">{urlPortal}</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button type="button" onClick={copiarEnlace} className="btn-light flex-1 sm:flex-none text-xs">
            <Copy size={14} aria-hidden="true" />
            <span>Copiar enlace</span>
          </button>
          <a
            href={`/tienda/${perfil.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-cta flex-1 sm:flex-none text-xs"
          >
            <span>Visitar portal</span>
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </div>

      <form onSubmit={guardar} className="card space-y-6 p-6 sm:p-8 border-white/10 bg-white/[0.04]" noValidate>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Personalización del Portal Web</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure la información de presentación, canales de contacto y medios que verán los compradores.
          </p>
        </div>

        {/* Carga de Imágenes: Portada y Logo */}
        <div className="grid gap-6 sm:grid-cols-2 pt-2 border-t border-white/10">
          <div>
            <label className="label">Foto de portada (máx. 3 MB)</label>
            <div className="mb-2 h-32 w-full overflow-hidden rounded-2xl bg-white/[0.03] border border-white/10">
              {portadaPrev ? (
                <img src={portadaPrev} alt="Portada" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-xs text-slate-400">
                  <div className="flex flex-col items-center gap-1 text-slate-400">
                    <Image size={28} aria-hidden="true" />
                    <span>Sin imagen de portada</span>
                  </div>
                </div>
              )}
            </div>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={cambioPortada} className="input text-xs" />
          </div>

          <div>
            <label className="label">Logotipo de la empresa (máx. 3 MB)</label>
            <div className="mb-2 flex items-center gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/[0.03] border border-white/10 p-1">
                {logoPrev ? (
                  <img src={logoPrev} alt="Logo" className="h-full w-full object-cover rounded-xl" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs text-slate-400">
                    <Store size={24} aria-hidden="true" />
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Formato cuadrado recomendado (PNG o JPG). Se mostrará en las búsquedas y tarjetas de producto.
              </p>
            </div>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={cambioLogo} className="input text-xs" />
          </div>
        </div>

        {/* Datos descriptivos */}
        <div className="space-y-4 pt-2 border-t border-white/10">
          <div>
            <label className="label">Descripción de la empresa</label>
            <textarea
              className="input text-base sm:text-sm"
              rows={3}
              maxLength={2000}
              value={d.descripcion}
              onChange={(e) => setD({ ...d, descripcion: e.target.value })}
              placeholder="Describa la actividad comercial, trayectoria, catálogo principal o términos de entrega."
            />
          </div>

          <div>
            <label className="label">Dirección física / Local comercial</label>
            <input
              className="input text-base sm:text-sm"
              maxLength={200}
              value={d.direccion}
              onChange={(e) => setD({ ...d, direccion: e.target.value })}
              placeholder="Ej. Av. 6 de Agosto #2450, Sopocachi, La Paz"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="portal-tel">
                Teléfono de contacto (opcional)
              </label>
              <div className="relative">
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="portal-tel"
                  type="text"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={8}
                  pattern="[0-9]*"
                  className={`input pl-10 text-base sm:text-sm ${
                    errores.telefono ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''
                  }`}
                  value={d.telefono}
                  onKeyDown={teclaPermitidaSoloDigitos}
                  onChange={(e) => {
                    const val = soloDigitos(e.target.value);
                    setD({ ...d, telefono: val });
                    if (errores.telefono) setErrores((prev) => ({ ...prev, telefono: '' }));
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const p = soloDigitos(e.clipboardData.getData('text'));
                    setD((prev) => ({ ...prev, telefono: (prev.telefono + p).slice(0, 8) }));
                    if (errores.telefono) setErrores((prev) => ({ ...prev, telefono: '' }));
                  }}
                  onBlur={() => validarUnCampo('telefono')}
                  placeholder="Ej. 22123456"
                />
              </div>
              {errores.telefono ? (
                <p className="err text-rose-600 text-xs mt-1.5 flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                  <span>{errores.telefono}</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">7 u 8 dígitos ({d.telefono.length}/8)</p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="portal-wa">
                WhatsApp para pedidos *
              </label>
              <div className="relative">
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600" aria-hidden="true" />
                <input
                  id="portal-wa"
                  type="text"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={8}
                  pattern="[0-9]*"
                  className={`input pl-10 text-base sm:text-sm ${
                    errores.whatsapp ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''
                  }`}
                  value={d.whatsapp}
                  onKeyDown={teclaPermitidaSoloDigitos}
                  onChange={(e) => {
                    const val = soloDigitos(e.target.value);
                    setD({ ...d, whatsapp: val });
                    if (errores.whatsapp) setErrores((prev) => ({ ...prev, whatsapp: '' }));
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const p = soloDigitos(e.clipboardData.getData('text'));
                    setD((prev) => ({ ...prev, whatsapp: (prev.whatsapp + p).slice(0, 8) }));
                    if (errores.whatsapp) setErrores((prev) => ({ ...prev, whatsapp: '' }));
                  }}
                  onBlur={() => validarUnCampo('whatsapp')}
                  placeholder="Ej. 70000000"
                  required
                />
              </div>
              {errores.whatsapp ? (
                <p className="err text-rose-600 text-xs mt-1.5 flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                  <span>{errores.whatsapp}</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">8 dígitos, empieza con 6 o 7 ({d.whatsapp.length}/8)</p>
              )}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="portal-sitio">
              Sitio web oficial (opcional)
            </label>
            <div className="relative">
              <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="portal-sitio"
                type="url"
                className={`input pl-10 text-base sm:text-sm ${
                  errores.sitio_web ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''
                }`}
                value={d.sitio_web}
                onChange={(e) => {
                  setD({ ...d, sitio_web: e.target.value });
                  if (errores.sitio_web) setErrores((prev) => ({ ...prev, sitio_web: '' }));
                }}
                onBlur={() => validarUnCampo('sitio_web')}
                placeholder="https://suempresa.com"
              />
            </div>
            {errores.sitio_web && (
              <p className="err text-rose-600 text-xs mt-1.5 flex items-center gap-1">
                <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                <span>{errores.sitio_web}</span>
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="portal-fb">
                Facebook (URL)
              </label>
              <input
                id="portal-fb"
                type="url"
                className={`input text-base sm:text-sm ${
                  errores.facebook ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''
                }`}
                value={d.facebook}
                onChange={(e) => {
                  setD({ ...d, facebook: e.target.value });
                  if (errores.facebook) setErrores((prev) => ({ ...prev, facebook: '' }));
                }}
                onBlur={() => validarUnCampo('facebook')}
                placeholder="https://facebook.com/..."
              />
              {errores.facebook && (
                <p className="err text-rose-600 text-xs mt-1.5 flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                  <span>{errores.facebook}</span>
                </p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="portal-ig">
                Instagram (URL)
              </label>
              <input
                id="portal-ig"
                type="url"
                className={`input text-base sm:text-sm ${
                  errores.instagram ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''
                }`}
                value={d.instagram}
                onChange={(e) => {
                  setD({ ...d, instagram: e.target.value });
                  if (errores.instagram) setErrores((prev) => ({ ...prev, instagram: '' }));
                }}
                onBlur={() => validarUnCampo('instagram')}
                placeholder="https://instagram.com/..."
              />
              {errores.instagram && (
                <p className="err text-rose-600 text-xs mt-1.5 flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                  <span>{errores.instagram}</span>
                </p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="portal-tk">
                TikTok (URL)
              </label>
              <input
                id="portal-tk"
                type="url"
                className={`input text-base sm:text-sm ${
                  errores.tiktok ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''
                }`}
                value={d.tiktok}
                onChange={(e) => {
                  setD({ ...d, tiktok: e.target.value });
                  if (errores.tiktok) setErrores((prev) => ({ ...prev, tiktok: '' }));
                }}
                onBlur={() => validarUnCampo('tiktok')}
                placeholder="https://tiktok.com/@..."
              />
              {errores.tiktok && (
                <p className="err text-rose-600 text-xs mt-1.5 flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                  <span>{errores.tiktok}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-500/10 p-3 border border-rose-500/20 text-xs font-semibold text-rose-300 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-white/10">
          <button type="submit" className="btn-cta w-full sm:w-auto" disabled={cargando}>
            {cargando ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
            <span>{cargando ? 'Guardando cambios…' : 'Guardar perfil del portal'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PanelEmpresa() {
  const { refrescar } = useAuth();
  const [tab, setTab] = useState('catalogo');
  const [perfil, setPerfil] = useState(null);
  const [prods, setProds] = useState([]);
  const [cats, setCats] = useState([]);
  const [form, setForm] = useState(null);
  const [nuevaCat, setNuevaCat] = useState('');
  const [error, setError] = useState('');
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [pedidosContador, setPedidosContador] = useState({ no_vistos: 0, pendientes: 0, total: 0 });
  const [modalCambiarPass, setModalCambiarPass] = useState(false);

  // Soporte para navegar directamente a una pestaña vía ?tab=pedidos
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['catalogo', 'pedidos', 'inventario', 'facturacion', 'reportes', 'suscripcion', 'portal'].includes(tabParam)) {
        setTab(tabParam);
      }
    } catch {}
  }, []);

  const cargar = useCallback(async () => {
    try {
      const p = await api('/empresa/perfil');
      setPerfil(p);
      refrescar();
      if (p.estado_verificacion === 'verificado') {
        setProds(await api('/empresa/productos'));
        setCats(await api('/empresa/categorias'));
        api('/empresa/pedidos/contador').then(setPedidosContador).catch(() => {});
      }
    } catch (e) {
      setError(e.message);
    }
  }, [refrescar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ejecutarEliminar = async () => {
    if (!confirmarEliminar) return;
    try {
      await api(`/empresa/productos/${confirmarEliminar.id_producto}`, { method: 'DELETE' });
      toast.success('Producto eliminado del catálogo');
      setConfirmarEliminar(null);
      cargar();
    } catch (e) {
      toast.error(e.message || 'Error al eliminar');
    }
  };

  const reportar = async (e) => {
    e.preventDefault();
    const nombre = nuevaCat.trim();
    if (nombre.length < 3 || nombre.length > 80) {
      toast.error('El nombre de la categoría debe tener entre 3 y 80 caracteres');
      return;
    }
    try {
      const r = await api('/empresa/categorias/reportar', { method: 'POST', body: { nombre } });
      toast.success(r.mensaje || 'Categoría reportada al administrador');
      setNuevaCat('');
    } catch (e2) {
      toast.error(e2.message);
    }
  };

  if (!perfil) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center p-10 text-slate-400">
        <Loader2 size={28} className="animate-spin text-brand-600" aria-hidden="true" />
      </div>
    );
  }

  const verificada = perfil.estado_verificacion === 'verificado';

  return (
    <div className="w-full">
      <Encabezado
        migas={[{ etiqueta: 'Mi Empresa' }]}
        titulo={perfil.razon_social}
        subtitulo={[perfil.nit && `NIT: ${perfil.nit}`, perfil.whatsapp && `WhatsApp: ${perfil.whatsapp}`].filter(Boolean).join(' · ') || undefined}
        icono={Store}
        acciones={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`badge-${perfil.estado_verificacion}`}>
              Verificación: {perfil.estado_verificacion}
            </span>
            <span className={`badge-${perfil.suscripcion}`}>
              Suscripción: {perfil.suscripcion}
            </span>
            {perfil.slug && verificada && perfil.suscripcion === 'activa' && (
              <a
                href={`/tienda/${perfil.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-light text-xs !py-1.5 !px-2.5 inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white border-white/20"
              >
                <span>Ver portal público</span>
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setModalCambiarPass(true)}
              className="btn-light text-xs !py-1.5 !px-2.5 inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white border-white/20"
              title="Cambiar contraseña de acceso a su cuenta"
            >
              <Key size={13} aria-hidden="true" />
              <span>Cambiar contraseña</span>
            </button>
          </div>
        }
      />

      <div className="-mt-8 relative z-20 mx-auto max-w-6xl px-4 sm:px-6 pb-16 space-y-6">

      {!verificada ? (
        <EstadoVerificacion perfil={perfil} onReenviado={cargar} />
      ) : (
        <>
          {perfil.suscripcion !== 'activa' && (
            <div className={`card p-4 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              perfil.suscripcion === 'pendiente_pago'
                ? 'border-amber-300 bg-amber-50/80 text-amber-900'
                : 'border-rose-300 bg-rose-50/70 text-rose-800'
            }`}>
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={18} className={`shrink-0 ${perfil.suscripcion === 'pendiente_pago' ? 'text-amber-700' : 'text-rose-700'}`} aria-hidden="true" />
                <span>
                  {perfil.suscripcion === 'pendiente_pago' ? (
                    <>Su empresa ha sido verificada. Su suscripción está <b>pendiente de pago</b> (Plan Único · Bs 200/mes). Envíe su comprobante para publicar su catálogo y portal.</>
                  ) : (
                    <>Su suscripción está <b>{perfil.suscripcion}</b>. Sus productos no aparecen en las búsquedas públicas hasta que sea reactivada.</>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTab('suscripcion')}
                className="btn-light !py-1.5 !px-3 text-xs shrink-0 font-bold self-end sm:self-auto"
              >
                <CreditCard size={14} aria-hidden="true" />
                <span>Ver suscripción y pago</span>
              </button>
            </div>
          )}

          {/* Navegación por Pestañas Horizontal Desplazable en Móvil */}
          <div className="flex gap-2 border-b border-white/10 overflow-x-auto no-scrollbar scrollbar-none pb-1">
            <button
              onClick={() => setTab('catalogo')}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
                tab === 'catalogo'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Package size={16} aria-hidden="true" />
              <span>Mi catálogo ({prods.length})</span>
            </button>
            <button
              onClick={() => {
                setTab('pedidos');
                // Al entrar a pedidos, refrescamos el contador
                api('/empresa/pedidos/contador').then(setPedidosContador).catch(() => {});
              }}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap relative ${
                tab === 'pedidos'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <ShoppingBag size={16} aria-hidden="true" />
              <span>Pedidos</span>
              {pedidosContador.no_vistos > 0 ? (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
                  {pedidosContador.no_vistos} nuevo{pedidosContador.no_vistos === 1 ? '' : 's'}
                </span>
              ) : pedidosContador.pendientes > 0 ? (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {pedidosContador.pendientes}
                </span>
              ) : null}
            </button>
            <button
              onClick={() => setTab('inventario')}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
                tab === 'inventario'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Boxes size={16} aria-hidden="true" />
              <span>Inventario</span>
            </button>
            <button
              onClick={() => setTab('facturacion')}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
                tab === 'facturacion'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Receipt size={16} aria-hidden="true" />
              <span>Facturación</span>
            </button>
            <button
              onClick={() => setTab('reportes')}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
                tab === 'reportes'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 size={16} aria-hidden="true" />
              <span>Reportes</span>
            </button>
            <button
              onClick={() => setTab('suscripcion')}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
                tab === 'suscripcion'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard size={16} aria-hidden="true" />
              <span>Mi suscripción</span>
              {perfil.suscripcion === 'pendiente_pago' && (
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Pago pendiente
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('portal')}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
                tab === 'portal'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Store size={16} aria-hidden="true" />
              <span>Mi portal público</span>
            </button>
          </div>

          {tab === 'catalogo' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Catálogo de Productos</h2>
                  <p className="text-xs text-slate-400">Gestione inventario, precios y disponibilidad en su tienda</p>
                </div>
                <button className="btn-cta shrink-0" onClick={() => setForm({})}>
                  <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
                  <span>Nuevo producto</span>
                </button>
              </div>

              {error && <p className="err">{error}</p>}

              {/* Vista Móvil: Lista de Tarjetas Apiladas (para pantallas < md) */}
              <div className="grid gap-3 md:hidden">
                {prods.map((p) => {
                  const stock = Number(p.stock_actual) || 0;
                  const min = Number(p.stock_minimo) || 20;
                  const esAgotado = stock <= 0;
                  const esBajo = stock <= min && stock > 0;

                  return (
                    <div key={p.id_producto} className="card p-4 space-y-3 border-white/10 bg-white/[0.04]">
                      <div className="flex items-start gap-3">
                        <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl bg-white/[0.05] shrink-0 border border-white/10">
                          {p.imagenes && p.imagenes[0] ? (
                            <img src={imgUrl(p.imagenes[0].ruta)} className="h-full w-full object-contain p-1" alt="" />
                          ) : (
                            <Package size={24} className="text-slate-400" aria-hidden="true" />
                          )}
                        </div>
                        <div className="grow min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                            {p.categoria}
                          </span>
                          <h3 className="font-bold text-white text-sm truncate">{p.nombre}</h3>
                          <p className="text-base font-extrabold text-white mt-1">{bs(p.precio)}</p>
                          <div className="mt-1">
                            {esAgotado ? (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                Agotado (0 {p.unidad || 'u'})
                              </span>
                            ) : esBajo ? (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                Stock bajo ({stock} {p.unidad || 'u'})
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                Suficiente ({stock} {p.unidad || 'u'})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-white/10">
                        <button
                          className="btn-light flex-1 !py-2 text-xs"
                          onClick={() => setForm(p)}
                        >
                          <Pencil size={14} aria-hidden="true" />
                          <span>Editar</span>
                        </button>
                        <button
                          className="btn-light !text-rose-400 hover:!bg-rose-500/10 flex-1 !py-2 text-xs"
                          onClick={() => setConfirmarEliminar(p)}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {!prods.length && (
                  <div className="card p-8 text-center text-slate-400 border-white/10 bg-white/[0.04]">
                    <Package size={36} className="mx-auto mb-2 text-slate-400" aria-hidden="true" />
                    <p className="text-sm">No tiene productos registrados todavía.</p>
                  </div>
                )}
              </div>

              {/* Vista Escritorio: Tabla Normal (para pantallas md+) */}
              <div className="card hidden md:block overflow-hidden p-0 border border-white/10 bg-white/[0.04] shadow-2xs">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/[0.06] text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="p-4">Producto</th>
                      <th className="p-4">Categoría</th>
                      <th className="p-4">Precio</th>
                      <th className="p-4">Existencias</th>
                      <th className="p-4 text-right whitespace-nowrap min-w-[170px]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prods.map((p) => {
                      const stock = Number(p.stock_actual) || 0;
                      const min = Number(p.stock_minimo) || 20;
                      const esAgotado = stock <= 0;
                      const esBajo = stock <= min && stock > 0;

                      return (
                        <tr key={p.id_producto} className="border-t border-white/10 hover:bg-white/[0.05] transition-colors">
                          <td className="p-4 flex items-center gap-3">
                            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-white/[0.05] shrink-0 border border-white/10">
                              {p.imagenes && p.imagenes[0] ? (
                                <img src={imgUrl(p.imagenes[0].ruta)} className="h-full w-full object-contain p-1" alt="" />
                              ) : (
                                <Package size={20} className="text-slate-400" aria-hidden="true" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-white text-sm block truncate">{p.nombre}</span>
                              {p.descripcion && (
                                <p className="line-clamp-1 text-xs text-slate-400 mt-0.5">{p.descripcion}</p>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-slate-300 text-xs font-medium">{p.categoria}</td>
                          <td className="p-4 font-bold text-white">{bs(p.precio)}</td>
                          <td className="p-4">
                            {esAgotado ? (
                              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                Agotado (0 {p.unidad || 'u'})
                              </span>
                            ) : esBajo ? (
                              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                Stock bajo ({stock} {p.unidad || 'u'})
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                Suficiente ({stock} {p.unidad || 'u'})
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-2">
                              <button
                                className="btn-light !px-2.5 !py-1 text-xs inline-flex items-center gap-1.5 shrink-0 hover:!border-cyan-400/50 hover:!text-cyan-300 transition-all"
                                onClick={() => setForm(p)}
                                aria-label={`Editar ${p.nombre}`}
                              >
                                <Pencil size={12} aria-hidden="true" />
                                <span>Editar</span>
                              </button>
                              <button
                                className="btn-light !px-2.5 !py-1 text-xs !text-rose-400 hover:!bg-rose-500/10 hover:!border-rose-500/40 inline-flex items-center gap-1.5 shrink-0 transition-all"
                                onClick={() => setConfirmarEliminar(p)}
                                aria-label={`Eliminar ${p.nombre}`}
                              >
                                <Trash2 size={12} aria-hidden="true" />
                                <span>Eliminar</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!prods.length && (
                      <tr>
                        <td colSpan="5" className="p-12 text-center text-slate-400">
                          <Package size={36} className="mx-auto mb-2 text-slate-400" aria-hidden="true" />
                          <p className="text-sm">Aún no tiene productos registrados. Haga clic en "+ Nuevo producto".</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Reporte de Categoría Inexistente */}
              <form onSubmit={reportar} className="card flex flex-col sm:flex-row items-stretch sm:items-end gap-3 p-5 bg-white/[0.04] border-white/10">
                <div className="grow space-y-1">
                  <label className="label text-slate-300 flex items-center gap-1.5" htmlFor="rep-cat">
                    <HelpCircle size={14} aria-hidden="true" />
                    <span>¿No encuentra una categoría adecuada para su producto? Reporte una:</span>
                  </label>
                  <input
                    id="rep-cat"
                    className="input text-base sm:text-sm"
                    maxLength={80}
                    value={nuevaCat}
                    onChange={(e) => setNuevaCat(e.target.value)}
                    placeholder="Ej. Instrumentos Musicales"
                  />
                </div>
                <button className="btn-light text-xs sm:text-sm shrink-0 !py-2.5">
                  Reportar categoría
                </button>
              </form>
            </div>
          )}

          {tab === 'pedidos' && (
            <PedidosEmpresa
              perfil={perfil}
              onActualizado={() => {
                api('/empresa/pedidos/contador').then(setPedidosContador).catch(() => {});
                cargar();
              }}
            />
          )}
          {tab === 'inventario' && <Inventario prods={prods} perfil={perfil} onActualizado={cargar} />}
          {tab === 'facturacion' && <Facturacion prods={prods} perfil={perfil} onActualizado={cargar} />}
          {tab === 'reportes' && <Reportes prods={prods} perfil={perfil} />}
          {tab === 'suscripcion' && <MiSuscripcion perfil={perfil} onActualizado={cargar} />}
          {tab === 'portal' && <FormMiPortal perfil={perfil} onActualizado={cargar} />}
        </>
      )}

      {/* Modal para Crear / Editar Producto */}
      {form && (
        <FormProducto
          inicial={form.id_producto ? form : null}
          categorias={cats}
          onCancelar={() => setForm(null)}
          onGuardado={() => {
            setForm(null);
            cargar();
          }}
        />
      )}

      {/* Modal de Confirmación para Eliminar Producto */}
      <ModalConfirmacion
        abierto={!!confirmarEliminar}
        titulo="Eliminar producto"
        mensaje={`¿Está seguro de eliminar "${confirmarEliminar?.nombre}" de su catálogo? Esta acción no se puede deshacer.`}
        tipo="peligro"
        textoBotonConfirmar="Eliminar producto"
        onConfirmar={ejecutarEliminar}
        onCancelar={() => setConfirmarEliminar(null)}
      />

      {/* Modal para cambiar contraseña */}
      <ModalCambiarPassword
        abierto={modalCambiarPass}
        onCerrar={() => setModalCambiarPass(false)}
      />
      </div>
    </div>
  );
}

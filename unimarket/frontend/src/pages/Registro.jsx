import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2,
  UserCheck,
  FileCheck,
  UploadCloud,
  FileText,
  X,
  AlertCircle,
  Clock,
  CheckCircle2,
  Phone,
  Mail,
  Lock,
  Globe,
  Loader2,
  Sparkles,
  Home,
  LogIn,
} from 'lucide-react';
import { api, ApiError } from '../api.js';
import Encabezado from '../components/Encabezado.jsx';
import {
  soloDigitos,
  teclaPermitidaSoloDigitos,
  validarRazonSocial,
  validarNit,
  validarTelefono,
  validarWhatsapp,
  validarUsuario,
  validarCorreo,
  validarContrasena,
  validarUrl,
} from '../utils/validar.js';

const vacio = {
  razon_social: '',
  nit: '',
  telefono: '',
  whatsapp: '',
  sitio_web: '',
  usuario: '',
  correo: '',
  contrasena: '',
};

export default function Registro() {
  const [d, setD] = useState(vacio);
  const [confirmarCorreo, setConfirmarCorreo] = useState('');
  const [aceptoTerminos, setAceptoTerminos] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [errores, setErrores] = useState({});
  const [colisiones, setColisiones] = useState({});
  const [verificando, setVerificando] = useState({});
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [datosExito, setDatosExito] = useState(null);
  const [cargando, setCargando] = useState(false);

  // Verificación en vivo de disponibilidad en backend (PARTE 1)
  const verificarDisponibilidad = async (campo, valor) => {
    const valLimpio = String(valor ?? '').trim();
    if (!valLimpio) {
      setColisiones((prev) => ({ ...prev, [campo]: '' }));
      return;
    }
    // Solo consultar si cumple con longitud mínima
    if (campo === 'nit' && valLimpio.length < 7) return;
    if (campo === 'whatsapp' && valLimpio.length < 8) return;
    if (campo === 'telefono' && valLimpio.length < 7) return;
    if (campo === 'usuario' && valLimpio.length < 3) return;
    if (campo === 'correo' && !valLimpio.includes('@')) return;
    if (campo === 'razon_social' && valLimpio.length < 3) return;

    setVerificando((prev) => ({ ...prev, [campo]: true }));
    try {
      const res = await api(`/auth/disponibilidad?campo=${campo}&valor=${encodeURIComponent(valLimpio)}`);
      if (!res.disponible) {
        setColisiones((prev) => ({ ...prev, [campo]: res.mensaje || 'Ya se encuentra registrado en el sistema.' }));
      } else {
        setColisiones((prev) => ({ ...prev, [campo]: '' }));
      }
    } catch {
      // Ignorar fallos de red en chequeo previo
    } finally {
      setVerificando((prev) => ({ ...prev, [campo]: false }));
    }
  };

  const validarUnCampo = (campo) => {
    let err = '';
    switch (campo) {
      case 'razon_social':
        err = validarRazonSocial(d.razon_social);
        if (!err && d.razon_social.trim().length >= 3) {
          verificarDisponibilidad('razon_social', d.razon_social);
        }
        break;
      case 'nit':
        err = validarNit(d.nit);
        if (!err && d.nit.trim().length >= 7) {
          verificarDisponibilidad('nit', d.nit);
        }
        break;
      case 'telefono':
        err = validarTelefono(d.telefono, true);
        if (!err && d.telefono.trim().length >= 7) {
          verificarDisponibilidad('telefono', d.telefono);
        }
        break;
      case 'whatsapp':
        err = validarWhatsapp(d.whatsapp);
        if (!err && d.whatsapp.trim().length === 8) {
          verificarDisponibilidad('whatsapp', d.whatsapp);
        }
        break;
      case 'sitio_web':
        err = validarUrl(d.sitio_web, true);
        break;
      case 'usuario':
        err = validarUsuario(d.usuario);
        if (!err && d.usuario.trim().length >= 3) {
          verificarDisponibilidad('usuario', d.usuario);
        }
        break;
      case 'correo':
        err = validarCorreo(d.correo);
        if (!err && d.correo.trim().includes('@')) {
          verificarDisponibilidad('correo', d.correo);
        }
        break;
      case 'confirmar_correo':
        if (!confirmarCorreo.trim()) {
          err = 'Confirme su correo electrónico';
        } else if (confirmarCorreo.trim().toLowerCase() !== d.correo.trim().toLowerCase()) {
          err = 'Los correos electrónicos no coinciden';
        }
        break;
      case 'contrasena':
        err = validarContrasena(d.contrasena);
        break;
      case 'documento':
        if (!archivo) err = 'Debe adjuntar el documento de NIT en formato PDF';
        break;
      case 'acepto_terminos':
        if (!aceptoTerminos) err = 'Debe aceptar las reglas de uso y los términos del servicio';
        break;
      default:
        break;
    }
    setErrores((prev) => ({ ...prev, [campo]: err }));
    return !err;
  };

  const manejarArchivo = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrores((prev) => ({ ...prev, documento: 'El archivo debe ser un documento PDF' }));
      setArchivo(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrores((prev) => ({ ...prev, documento: 'El archivo PDF no debe superar 5 MB' }));
      setArchivo(null);
      return;
    }
    setArchivo(file);
    setErrores((prev) => ({ ...prev, documento: '' }));
  };

  const validarTodo = () => {
    const errs = {};
    const eRazon = validarRazonSocial(d.razon_social);
    if (eRazon) errs.razon_social = eRazon;

    const eNit = validarNit(d.nit);
    if (eNit) errs.nit = eNit;

    const eTel = validarTelefono(d.telefono, true);
    if (eTel) errs.telefono = eTel;

    const eWsp = validarWhatsapp(d.whatsapp);
    if (eWsp) errs.whatsapp = eWsp;

    const eUrl = validarUrl(d.sitio_web, true);
    if (eUrl) errs.sitio_web = eUrl;

    const eUsu = validarUsuario(d.usuario);
    if (eUsu) errs.usuario = eUsu;

    const eMail = validarCorreo(d.correo);
    if (eMail) errs.correo = eMail;

    if (!confirmarCorreo.trim()) {
      errs.confirmar_correo = 'Confirme su correo electrónico';
    } else if (confirmarCorreo.trim().toLowerCase() !== d.correo.trim().toLowerCase()) {
      errs.confirmar_correo = 'Los correos electrónicos no coinciden';
    }

    const ePass = validarContrasena(d.contrasena);
    if (ePass) errs.contrasena = ePass;

    if (!archivo) errs.documento = 'Debe adjuntar el documento de NIT en formato PDF';
    if (!aceptoTerminos) errs.acepto_terminos = 'Debe aceptar las reglas de uso y los términos del servicio';

    setErrores(errs);
    return Object.keys(errs).length === 0;
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError('');

    if (!validarTodo()) {
      return;
    }

    if (Object.values(colisiones).some(Boolean)) {
      setError('Existen campos con datos que ya se encuentran registrados en UNIMARKET BO. Corrija los valores marcados.');
      return;
    }

    setCargando(true);
    try {
      const fd = new FormData();
      fd.append('razon_social', d.razon_social.trim());
      fd.append('nit', d.nit.trim());
      if (d.telefono.trim()) fd.append('telefono', d.telefono.trim());
      fd.append('whatsapp', d.whatsapp.trim());
      if (d.sitio_web.trim()) fd.append('sitio_web', d.sitio_web.trim());
      fd.append('usuario', d.usuario.trim().toLowerCase());
      fd.append('correo', d.correo.trim().toLowerCase());
      fd.append('contrasena', d.contrasena);
      fd.append('documento', archivo);

      const res = await api('/auth/registro-empresa', {
        method: 'POST',
        form: fd,
      });

      setDatosExito({
        razon_social: d.razon_social.trim(),
        nit: d.nit.trim(),
        correo: d.correo.trim().toLowerCase(),
        id_empresa: res.id_empresa,
      });
      setOk(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(err.message || 'El NIT, correo o usuario ya se encuentra registrado en el sistema.');
      } else {
        setError(err.message || 'Error al procesar el registro de la empresa');
      }
    } finally {
      setCargando(false);
    }
  };

  // Pantalla de éxito tras enviar el registro
  if (ok && datosExito) {
    return (
      <div className="flex min-h-[70dvh] items-center justify-center py-8 px-4">
        <motion.div
          className="card max-w-lg w-full p-6 sm:p-8 text-center space-y-6 shadow-floating border-white/10 bg-[#0A1338]/95 backdrop-blur-xl text-white rounded-3xl"
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          {/* Icono animado CheckCircle2 */}
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-emerald-500/20 text-emerald-300 mx-auto border border-emerald-500/30 shadow-xs">
            <CheckCircle2 size={36} strokeWidth={2} aria-hidden="true" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              ¡Solicitud enviada correctamente!
            </h1>
            <p className="text-xs text-slate-300">
              Su registro ha sido recibido satisfactoriamente por el sistema
            </p>
          </div>

          {/* Texto explicativo exacto */}
          <div className="rounded-2xl bg-white/[0.05] p-5 border border-white/10 text-left space-y-3">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
              <Clock size={16} aria-hidden="true" />
              <span>Plazo de verificación legal</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Su aprobación está en espera. La revisión de sus datos y la verificación de su NIT tarda de <strong className="text-white">24 a 48 horas</strong>.
              Una vez verificada su empresa, le enviaremos un correo electrónico de aprobación a <strong className="text-cyan-300">{datosExito.correo}</strong> con los pasos para activar su portal.
            </p>
            <p className="text-xs text-slate-400 italic border-t border-white/10 pt-2">
              Si no ve el correo, revise su carpeta de spam o correo no deseado.
            </p>
          </div>

          {/* Resumen de la empresa registrada */}
          <div className="rounded-2xl bg-white/[0.04] p-4 border border-white/10 text-left text-xs space-y-1.5">
            <p className="font-semibold text-white">
              <span className="text-slate-400 font-normal">Razón Social:</span> {datosExito.razon_social}
            </p>
            <p className="font-semibold text-white">
              <span className="text-slate-400 font-normal">NIT:</span> {datosExito.nit}
            </p>
            <p className="font-semibold text-white">
              <span className="text-slate-400 font-normal">Estado:</span>{' '}
              <span className="badge-pendiente">Pendiente de verificación</span>
            </p>
          </div>

          {/* Botones de navegación Volver al inicio e Ingresar */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Link to="/" className="btn-light w-full justify-center !py-3 text-xs sm:text-sm">
              <Home size={16} aria-hidden="true" />
              <span>Volver al inicio</span>
            </Link>
            <Link to="/login" className="btn-cta w-full justify-center !py-3 text-xs sm:text-sm">
              <LogIn size={16} aria-hidden="true" />
              <span>Ingresar</span>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Encabezado
        migas={[{ etiqueta: 'Planes', ruta: '/planes' }, { etiqueta: 'Registro' }]}
        titulo="Registrar empresa"
        subtitulo="Crea tu catálogo oficial verificado y publica tus productos en UNIMARKET BO."
        icono={Building2}
      />

      <div className="-mt-8 relative z-20 max-w-3xl mx-auto px-4 pb-16 space-y-6">
        {/* Resumen Superior del Plan en vidrio oscuro sin botón Cambiar */}
        <div className="card flex items-center justify-between p-4 border border-white/10 bg-white/[0.06] backdrop-blur-md shadow-2xs rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold shadow-xs">
              <Sparkles size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white">Plan Único · Bs 200/mes</p>
              <p className="text-[11px] sm:text-xs text-slate-300">Suscripción todo incluido para comercializar tu catálogo digital</p>
            </div>
          </div>
        </div>

        <motion.form
          onSubmit={enviar}
          className="card p-6 sm:p-8 space-y-8 shadow-floating border border-white/10 bg-white/[0.05] backdrop-blur-xl rounded-3xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          noValidate
        >
          {/* Sección 1: Datos de la Empresa */}
          <fieldset className="space-y-4">
            <legend className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider mb-2">
              <Building2 size={18} className="text-cyan-300" aria-hidden="true" />
              <span>1. Datos de la empresa</span>
            </legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label !text-slate-200" htmlFor="reg-razon">
                  Razón Social / Nombre Comercial *
                </label>
                <input
                  id="reg-razon"
                  className={`input ${errores.razon_social || colisiones.razon_social ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''}`}
                  value={d.razon_social}
                  maxLength={150}
                  onChange={(e) => {
                    setD({ ...d, razon_social: e.target.value });
                    if (errores.razon_social) setErrores((prev) => ({ ...prev, razon_social: '' }));
                    if (colisiones.razon_social) setColisiones((prev) => ({ ...prev, razon_social: '' }));
                  }}
                  onBlur={() => validarUnCampo('razon_social')}
                  placeholder="Ej. Distribuidora Andina S.R.L."
                  required
                />
                {verificando.razon_social ? (
                  <p className="text-[11px] text-cyan-300 mt-1 flex items-center gap-1">
                    <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                    <span>Verificando disponibilidad...</span>
                  </p>
                ) : (errores.razon_social || colisiones.razon_social) ? (
                  <p className="err text-rose-300 text-xs mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                    <span>{errores.razon_social || colisiones.razon_social}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">Nombre comercial o razón social oficial</p>
                )}
              </div>

              <div>
                <label className="label !text-slate-200" htmlFor="reg-nit">
                  NIT (solo números) *
                </label>
                <input
                  id="reg-nit"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={15}
                  pattern="[0-9]*"
                  className={`input ${errores.nit || colisiones.nit ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''}`}
                  value={d.nit}
                  onKeyDown={teclaPermitidaSoloDigitos}
                  onChange={(e) => {
                    const val = soloDigitos(e.target.value);
                    setD({ ...d, nit: val });
                    if (errores.nit) setErrores((prev) => ({ ...prev, nit: '' }));
                    if (colisiones.nit) setColisiones((prev) => ({ ...prev, nit: '' }));
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const p = soloDigitos(e.clipboardData.getData('text'));
                    setD((prev) => ({ ...prev, nit: (prev.nit + p).slice(0, 15) }));
                    if (errores.nit) setErrores((prev) => ({ ...prev, nit: '' }));
                    if (colisiones.nit) setColisiones((prev) => ({ ...prev, nit: '' }));
                  }}
                  onBlur={() => validarUnCampo('nit')}
                  placeholder="Ej. 1023456789"
                  required
                />
                {verificando.nit ? (
                  <p className="text-[11px] text-cyan-300 mt-1 flex items-center gap-1">
                    <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                    <span>Verificando NIT en el sistema...</span>
                  </p>
                ) : (errores.nit || colisiones.nit) ? (
                  <p className="err text-rose-300 text-xs mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                    <span>{errores.nit || colisiones.nit}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">7 a 15 dígitos ({d.nit.length}/15)</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label !text-slate-200" htmlFor="reg-telefono">
                  Teléfono de contacto (opcional)
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="reg-telefono"
                    type="text"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={8}
                    pattern="[0-9]*"
                    className={`input pl-10 ${errores.telefono || colisiones.telefono ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''}`}
                    value={d.telefono}
                    onKeyDown={teclaPermitidaSoloDigitos}
                    onChange={(e) => {
                      const val = soloDigitos(e.target.value);
                      setD({ ...d, telefono: val });
                      if (errores.telefono) setErrores((prev) => ({ ...prev, telefono: '' }));
                      if (colisiones.telefono) setColisiones((prev) => ({ ...prev, telefono: '' }));
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const p = soloDigitos(e.clipboardData.getData('text'));
                      setD((prev) => ({ ...prev, telefono: (prev.telefono + p).slice(0, 8) }));
                      if (errores.telefono) setErrores((prev) => ({ ...prev, telefono: '' }));
                      if (colisiones.telefono) setColisiones((prev) => ({ ...prev, telefono: '' }));
                    }}
                    onBlur={() => validarUnCampo('telefono')}
                    placeholder="Ej. 22123456"
                  />
                </div>
                {verificando.telefono ? (
                  <p className="text-[11px] text-cyan-300 mt-1 flex items-center gap-1">
                    <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                    <span>Verificando disponibilidad...</span>
                  </p>
                ) : (errores.telefono || colisiones.telefono) ? (
                  <p className="err text-rose-300 text-xs mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                    <span>{errores.telefono || colisiones.telefono}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">Opcional, 7 u 8 dígitos ({d.telefono.length}/8)</p>
                )}
              </div>

              <div>
                <label className="label !text-slate-200" htmlFor="reg-whatsapp">
                  WhatsApp comercial (pedidos) *
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400" aria-hidden="true" />
                  <input
                    id="reg-whatsapp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={8}
                    pattern="[0-9]*"
                    className={`input pl-10 ${errores.whatsapp || colisiones.whatsapp ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''}`}
                    value={d.whatsapp}
                    onKeyDown={teclaPermitidaSoloDigitos}
                    onChange={(e) => {
                      const val = soloDigitos(e.target.value);
                      setD({ ...d, whatsapp: val });
                      if (errores.whatsapp) setErrores((prev) => ({ ...prev, whatsapp: '' }));
                      if (colisiones.whatsapp) setColisiones((prev) => ({ ...prev, whatsapp: '' }));
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const p = soloDigitos(e.clipboardData.getData('text'));
                      setD((prev) => ({ ...prev, whatsapp: (prev.whatsapp + p).slice(0, 8) }));
                      if (errores.whatsapp) setErrores((prev) => ({ ...prev, whatsapp: '' }));
                      if (colisiones.whatsapp) setColisiones((prev) => ({ ...prev, whatsapp: '' }));
                    }}
                    onBlur={() => validarUnCampo('whatsapp')}
                    placeholder="Ej. 70000000"
                    required
                  />
                </div>
                {verificando.whatsapp ? (
                  <p className="text-[11px] text-cyan-300 mt-1 flex items-center gap-1">
                    <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                    <span>Verificando número en el sistema...</span>
                  </p>
                ) : (errores.whatsapp || colisiones.whatsapp) ? (
                  <p className="err text-rose-300 text-xs mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                    <span>{errores.whatsapp || colisiones.whatsapp}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">8 dígitos, empieza con 6 o 7 ({d.whatsapp.length}/8)</p>
                )}
              </div>
            </div>

            <div>
              <label className="label !text-slate-200" htmlFor="reg-sitio">
                Sitio web o red social (opcional)
              </label>
              <div className="relative">
                <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="reg-sitio"
                  type="url"
                  className={`input pl-10 ${errores.sitio_web ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''}`}
                  value={d.sitio_web}
                  onChange={(e) => {
                    setD({ ...d, sitio_web: e.target.value });
                    if (errores.sitio_web) setErrores((prev) => ({ ...prev, sitio_web: '' }));
                  }}
                  onBlur={() => validarUnCampo('sitio_web')}
                  placeholder="https://suempresa.com"
                />
              </div>
              {errores.sitio_web ? (
                <p className="err text-rose-300 text-xs mt-1.5 flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                  <span>{errores.sitio_web}</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">Debe comenzar con http:// o https://</p>
              )}
            </div>
          </fieldset>

          {/* Sección 2: Cuenta de Acceso */}
          <fieldset className="space-y-4 pt-4 border-t border-white/10">
            <legend className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider mb-2">
              <UserCheck size={18} className="text-cyan-300" aria-hidden="true" />
              <span>2. Cuenta de acceso</span>
            </legend>

            <div>
              <label className="label !text-slate-200" htmlFor="reg-usuario">
                Nombre de usuario *
              </label>
              <input
                id="reg-usuario"
                className={`input ${errores.usuario || colisiones.usuario ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''}`}
                value={d.usuario}
                maxLength={30}
                onChange={(e) => {
                  setD({ ...d, usuario: e.target.value.toLowerCase() });
                  if (errores.usuario) setErrores((prev) => ({ ...prev, usuario: '' }));
                  if (colisiones.usuario) setColisiones((prev) => ({ ...prev, usuario: '' }));
                }}
                onBlur={() => validarUnCampo('usuario')}
                placeholder="4 a 30 caracteres (a-z, 0-9)"
                autoComplete="username"
                required
              />
              {verificando.usuario ? (
                <p className="text-[11px] text-cyan-300 mt-1 flex items-center gap-1">
                  <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                  <span>Verificando usuario...</span>
                </p>
              ) : (errores.usuario || colisiones.usuario) ? (
                <p className="err text-rose-300 text-xs mt-1.5 flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                  <span>{errores.usuario || colisiones.usuario}</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">Solo letras minúsculas, números y guión bajo</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label !text-slate-200" htmlFor="reg-correo">
                  Correo electrónico *
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="reg-correo"
                    type="email"
                    className={`input pl-10 ${errores.correo || colisiones.correo ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''}`}
                    value={d.correo}
                    onChange={(e) => {
                      setD({ ...d, correo: e.target.value.toLowerCase() });
                      if (errores.correo) setErrores((prev) => ({ ...prev, correo: '' }));
                      if (colisiones.correo) setColisiones((prev) => ({ ...prev, correo: '' }));
                    }}
                    onBlur={() => validarUnCampo('correo')}
                    placeholder="contacto@empresa.bo"
                    required
                  />
                </div>
                {verificando.correo ? (
                  <p className="text-[11px] text-cyan-300 mt-1 flex items-center gap-1">
                    <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                    <span>Verificando correo electrónico...</span>
                  </p>
                ) : (errores.correo || colisiones.correo) ? (
                  <p className="err text-rose-300 text-xs mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                    <span>{errores.correo || colisiones.correo}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Aquí le enviaremos la confirmación de su solicitud y el aviso de aprobación
                  </p>
                )}
              </div>

              <div>
                <label className="label !text-slate-200" htmlFor="reg-confirmar-correo">
                  Confirmar correo electrónico *
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="reg-confirmar-correo"
                    type="email"
                    className={`input pl-10 ${errores.confirmar_correo ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''}`}
                    value={confirmarCorreo}
                    onChange={(e) => {
                      setConfirmarCorreo(e.target.value.toLowerCase());
                      if (errores.confirmar_correo) setErrores((prev) => ({ ...prev, confirmar_correo: '' }));
                    }}
                    onBlur={() => validarUnCampo('confirmar_correo')}
                    placeholder="contacto@empresa.bo"
                    required
                  />
                </div>
                {errores.confirmar_correo ? (
                  <p className="err text-rose-300 text-xs mt-1.5 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                    <span>{errores.confirmar_correo}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">Debe coincidir exactamente con el correo anterior</p>
                )}
              </div>
            </div>

            <div>
              <label className="label !text-slate-200" htmlFor="reg-clave">
                Contraseña de acceso *
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="reg-clave"
                  type="password"
                  className={`input pl-10 ${errores.contrasena ? 'input-error !border-rose-500 ring-2 ring-rose-500/20' : ''}`}
                  value={d.contrasena}
                  onChange={(e) => {
                    setD({ ...d, contrasena: e.target.value });
                    if (errores.contrasena) setErrores((prev) => ({ ...prev, contrasena: '' }));
                  }}
                  onBlur={() => validarUnCampo('contrasena')}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  required
                />
              </div>
              {errores.contrasena ? (
                <p className="err text-rose-300 text-xs mt-1.5 flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                  <span>{errores.contrasena}</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">Mínimo 8 caracteres</p>
              )}
            </div>
          </fieldset>

          {/* Sección 3: Documento de Verificación NIT */}
          <fieldset className="space-y-3 pt-4 border-t border-white/10">
            <legend className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider mb-2">
              <FileCheck size={18} className="text-cyan-300" aria-hidden="true" />
              <span>3. Documento de verificación legal</span>
            </legend>

            {/* Zona Drag and Drop en vidrio oscuro */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                manejarArchivo(e.dataTransfer.files[0]);
              }}
              className={`relative rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                arrastrando
                  ? 'border-cyan-400 bg-cyan-400/10'
                  : errores.documento
                  ? 'border-rose-400/70 bg-rose-500/10'
                  : 'border-white/20 hover:border-cyan-400/50 bg-white/[0.03]'
              }`}
            >
              {archivo ? (
                <div className="flex items-center justify-between gap-3 bg-white/[0.06] p-3 rounded-xl border border-white/15 text-left max-w-md mx-auto shadow-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      <FileText size={20} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{archivo.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {(archivo.size / (1024 * 1024)).toFixed(2)} MB · PDF
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setArchivo(null);
                      setErrores((prev) => ({ ...prev, documento: 'Debe adjuntar el documento de NIT en formato PDF' }));
                    }}
                    className="p-1 text-slate-400 hover:text-rose-300 rounded-lg transition-colors"
                    aria-label="Quitar archivo"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-cyan-300 mx-auto border border-white/15">
                    <UploadCloud size={24} aria-hidden="true" />
                  </div>
                  <div>
                    <label
                      htmlFor="archivo-nit"
                      className="cursor-pointer text-xs sm:text-sm font-semibold text-cyan-300 hover:underline"
                    >
                      Haga clic para seleccionar el PDF del NIT
                    </label>
                    <span className="text-xs text-slate-400"> o arrastre el archivo aquí</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Formato PDF, tamaño máximo 5 MB</p>
                  <input
                    id="archivo-nit"
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={(e) => manejarArchivo(e.target.files[0])}
                  />
                </div>
              )}
            </div>
            {errores.documento && (
              <p className="err text-rose-300 text-xs mt-1.5 flex items-center gap-1">
                <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                <span>{errores.documento}</span>
              </p>
            )}
          </fieldset>

          {/* Casilla obligatoria: Términos y Reglas de Uso */}
          <div className="pt-2 border-t border-white/10 space-y-1.5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                id="reg-terminos"
                type="checkbox"
                checked={aceptoTerminos}
                onChange={(e) => {
                  setAceptoTerminos(e.target.checked);
                  if (e.target.checked) {
                    setErrores((prev) => {
                      const c = { ...prev };
                      delete c.acepto_terminos;
                      return c;
                    });
                  }
                }}
                className="mt-0.5 h-4 w-4 rounded border-white/30 bg-white/10 text-cyan-400 focus:ring-cyan-400"
              />
              <span className="text-xs sm:text-sm text-slate-200 leading-snug">
                Acepto las{' '}
                <Link to="/terminos" target="_blank" className="font-semibold text-cyan-300 hover:underline">
                  reglas de uso y los términos del servicio
                </Link>{' '}
                de UNIMARKET BO *
              </span>
            </label>
            {errores.acepto_terminos && (
              <p className="err text-rose-300 text-xs flex items-center gap-1 pl-7">
                <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
                <span>{errores.acepto_terminos}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-rose-500/15 p-3.5 border border-rose-500/30 text-xs font-semibold text-rose-300 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="btn-cta w-full !py-3.5 !text-base shadow-sm"
              disabled={cargando || Object.values(colisiones).some(Boolean) || Object.values(verificando).some(Boolean)}
            >
              {cargando ? (
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              ) : (
                <UserCheck size={18} aria-hidden="true" />
              )}
              <span>{cargando ? 'Procesando registro…' : 'Enviar solicitud de registro'}</span>
            </button>
          </div>

          <p className="text-center text-xs text-slate-300 pt-2 border-t border-white/10">
            ¿Ya tiene cuenta?{' '}
            <Link to="/login" className="text-cyan-300 font-semibold hover:underline">
              Ingresar al panel
            </Link>
          </p>
        </motion.form>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Database,
  Store,
  Share2,
  TrendingUp,
  Search,
  MessageCircle,
  BadgeCheck,
  Headphones,
  UserPlus,
  Clock,
  QrCode,
  ChevronDown,
  ShieldCheck,
  Boxes,
  Receipt,
  BarChart3,
} from 'lucide-react';
import { api } from '../api.js';
import Encabezado from '../components/Encabezado.jsx';

// Mapeo de iconos para los beneficios oficiales
const ICONOS_BENEFICIOS = [
  Database,
  Store,
  Boxes,
  Receipt,
  BarChart3,
  Share2,
  TrendingUp,
  Search,
  MessageCircle,
  BadgeCheck,
  Headphones,
];

export default function Planes() {
  const [plan, setPlan] = useState({
    nombre: 'Plan Único',
    precio: 200,
    moneda: 'Bs',
    periodo: 'mes',
    descripcion: 'Para empresas pequeñas y medianas que quieren vender más sin desarrollar su propio sitio web',
    beneficios: [
      'Centralización de tus datos: catálogo, precios y disponibilidad siempre actualizados en un solo lugar.',
      'Portal individual propio dentro de UNIMARKET BO, sin el costo de desarrollar un sitio web.',
      'Control de inventario con alertas automáticas de stock bajo por correo electrónico.',
      'Registro interno de ventas (WhatsApp y mostrador) y emisión de comprobantes en PDF.',
      'Reportes comerciales detallados por día, mes, año y producto con exportación a PDF.',
      'Anuncios de tu portal en Facebook, Instagram y TikTok.',
      'Mayor alcance con la promoción global de UNIMARKET BO.',
      'Búsqueda avanzada y filtros que ponen tus productos frente a quien los busca.',
      'Contacto directo con tus clientes por WhatsApp.',
      'Insignia de empresa verificada comercialmente.',
      'Infraestructura, soporte y atención a la empresa.',
    ],
    pasos: [
      {
        numero: 1,
        titulo: 'Registra tu empresa',
        descripcion: 'Completa los datos de tu empresa, tu cuenta de acceso y adjunta el documento de tu NIT en formato PDF.',
      },
      {
        numero: 2,
        titulo: 'Verificamos tu NIT (24 a 48 horas)',
        descripcion: 'Nuestro equipo revisa la documentación legal y te envía la notificación de aprobación por correo electrónico.',
      },
      {
        numero: 3,
        titulo: 'Realizas el pago por QR o transferencia y publicas tu catálogo',
        descripcion: 'Efectúas el pago fuera de la plataforma, confirmamos tu suscripción y tu portal queda publicado.',
      },
    ],
    faqs: [
      {
        pregunta: '¿Cuánto tarda la aprobación?',
        respuesta: 'La revisión de sus datos y la verificación legal de su NIT tarda de 24 a 48 horas. Una vez aprobada, le enviaremos un correo con las instrucciones para activar su portal.',
      },
      {
        pregunta: '¿Qué documento necesito?',
        respuesta: 'Únicamente el documento de su NIT en formato PDF (emitido por el Servicio de Impuestos Nacionales, máximo 5 MB).',
      },
      {
        pregunta: '¿Cómo se paga?',
        respuesta: 'Por QR simple o transferencia bancaria, una vez aprobada la empresa. El pago no se procesa dentro de la plataforma (las transacciones comerciales y suscripciones se realizan fuera del sistema para mayor seguridad).',
      },
      {
        pregunta: '¿Cómo contacto soporte?',
        respuesta: 'Puede comunicarse directamente a través de nuestro correo electrónico oficial unimarketbo@gmail.com o desde la sección de ayuda de su panel.',
      },
    ],
  });

  const [faqAbierta, setFaqAbierta] = useState(null);

  useEffect(() => {
    api('/publico/plan')
      .then((data) => {
        if (data && data.nombre) setPlan(data);
      })
      .catch(() => {});
  }, []);

  const toggleFaq = (idx) => {
    setFaqAbierta(faqAbierta === idx ? null : idx);
  };

  return (
    <div className="w-full">
      {/* Encabezado Principal Visual Compartido */}
      <Encabezado
        migas={[{ etiqueta: 'Planes y Precios' }]}
        titulo="Un solo plan, todo incluido"
        subtitulo="Para empresas bolivianas que quieren vender más y digitalizar su catálogo sin comisiones ni intermediarios."
        icono={Sparkles}
      />

      <div className="-mt-10 relative z-20 mx-auto max-w-6xl px-4 sm:px-6 space-y-12 sm:space-y-16 pb-16">
        {/* Tarjeta Destacada y Centrada del Plan Único con borde de degradado y vidrio oscuro */}
        <section className="max-w-xl mx-auto px-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="p-[2px] rounded-[28px] bg-gradient-to-tr from-[#4F46E5] via-cyan-400 to-[#7C3AED] shadow-glow-cta"
          >
            <div className="relative rounded-[26px] bg-[#0A1338]/95 backdrop-blur-xl p-6 sm:p-10 shadow-elevated border border-white/10">
              {/* Insignia Funcional Plan Único con degradado */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 border border-white/20 px-4 py-1 text-xs font-extrabold uppercase tracking-wider text-white shadow-md">
                  <ShieldCheck size={14} aria-hidden="true" />
                  <span>Plan único</span>
                </span>
              </div>

              <div className="text-center space-y-2 border-b border-white/10 pb-6 pt-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {plan.nombre}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300">
                  Para empresas pequeñas y medianas
                </p>

                <div className="pt-3 flex items-baseline justify-center gap-1">
                  <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                    {plan.moneda} {plan.precio}
                  </span>
                  <span className="text-base sm:text-lg font-bold text-slate-400">
                    /{plan.periodo}
                  </span>
                </div>

                <p className="text-xs text-slate-400 font-medium">
                  Facturación referencial mensual · Sin comisiones por venta
                </p>
              </div>

              {/* Botón Principal Comenzar unificado a .btn-cta */}
              <div className="py-6">
                <Link
                  to="/registro"
                  className="btn-cta w-full !py-3.5 !text-base !font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <span>Comenzar</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>

              {/* Lista de Beneficios con Iconos en recuadros tintados alternados */}
              <div className="space-y-4 pt-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Beneficios incluidos en su suscripción:
                </p>

                <ul className="space-y-3.5">
                  {plan.beneficios.map((beneficio, idx) => {
                    const IconoComp = ICONOS_BENEFICIOS[idx % ICONOS_BENEFICIOS.length] || CheckCircle2;
                    const esCian = idx % 2 === 0;
                    return (
                      <li key={idx} className="flex items-start gap-3 text-sm text-slate-200">
                        <div
                          className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg mt-0.5 border ${
                            esCian
                              ? 'bg-cyan-400/15 text-cyan-300 border-cyan-400/30'
                              : 'bg-violet-400/15 text-violet-300 border-violet-400/30'
                          }`}
                        >
                          <IconoComp size={14} strokeWidth={2.5} aria-hidden="true" />
                        </div>
                        <span className="leading-snug">{beneficio}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Sección Cómo Funciona (3 pasos) */}
        <section className="max-w-5xl mx-auto px-4 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Cómo funciona
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
              Tres pasos sencillos para tener su empresa publicada y visible en todo el país
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Paso 1 - Cian */}
            <div className="card p-6 space-y-3 text-left relative overflow-hidden group border border-white/10 bg-white/[0.05] hover:bg-white/[0.08] hover:border-cyan-400/40 transition-colors rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-300 border border-cyan-400/30 shadow-xs">
                  <UserPlus size={22} strokeWidth={2} aria-hidden="true" />
                </div>
                <span className="text-3xl font-black text-white/15 group-hover:text-white/25 transition-colors">
                  01
                </span>
              </div>
              <h3 className="text-base font-bold text-white">1. Registra tu empresa</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Completa el formulario con la razón social de tu empresa, datos de contacto comercial y adjunta el documento de tu NIT en PDF.
              </p>
            </div>

            {/* Paso 2 - Violeta */}
            <div className="card p-6 space-y-3 text-left relative overflow-hidden group border border-white/10 bg-white/[0.05] hover:bg-white/[0.08] hover:border-violet-400/40 transition-colors rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-400/15 text-violet-300 border border-violet-400/30 shadow-xs">
                  <Clock size={22} strokeWidth={2} aria-hidden="true" />
                </div>
                <span className="text-3xl font-black text-white/15 group-hover:text-white/25 transition-colors">
                  02
                </span>
              </div>
              <h3 className="text-base font-bold text-white">2. Verificamos tu NIT</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                En un plazo de <strong className="text-white">24 a 48 horas</strong> validamos la legitimidad de tu NIT y te enviamos un correo con la aprobación y las instrucciones de pago.
              </p>
            </div>

            {/* Paso 3 - Esmeralda */}
            <div className="card p-6 space-y-3 text-left relative overflow-hidden group border border-white/10 bg-white/[0.05] hover:bg-white/[0.08] hover:border-emerald-400/40 transition-colors rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 shadow-xs">
                  <QrCode size={22} strokeWidth={2} aria-hidden="true" />
                </div>
                <span className="text-3xl font-black text-white/15 group-hover:text-white/25 transition-colors">
                  03
                </span>
              </div>
              <h3 className="text-base font-bold text-white">3. Realizas el pago y publicas</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Realizas el pago por QR o transferencia bancaria, subes tu comprobante y al confirmarlo, tu catálogo y portal quedan visibles para todos los compradores.
              </p>
            </div>
          </div>
        </section>

        {/* Preguntas Frecuentes (Acordeón Animado en Vidrio Oscuro) */}
        <section className="max-w-3xl mx-auto px-4 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Preguntas frecuentes
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Todo lo que necesitas saber antes de registrar tu empresa
            </p>
          </div>

          <div className="space-y-3">
            {plan.faqs.map((faq, idx) => {
              const abierta = faqAbierta === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-2xl border transition-colors overflow-hidden ${
                    abierta
                      ? 'border-cyan-400/40 bg-white/[0.08]'
                      : 'border-white/10 bg-white/[0.05] hover:bg-white/[0.07]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full flex items-center justify-between p-4 sm:p-5 text-left font-bold text-white text-sm sm:text-base transition-colors"
                    aria-expanded={abierta}
                  >
                    <span>{faq.pregunta}</span>
                    <ChevronDown
                      size={18}
                      className={`text-slate-300 transition-transform duration-200 shrink-0 ml-2 ${
                        abierta ? 'rotate-180 text-cyan-300' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {abierta && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-5 sm:px-5 sm:pb-6 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-white/10 pt-3">
                          {faq.respuesta}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        {/* Banner Final de Llamada a la Acción con vidrio oscuro y botón primario unificado */}
        <section className="max-w-4xl mx-auto px-4">
          <div className="p-[2px] rounded-3xl bg-gradient-to-r from-indigo-500/50 via-cyan-400/40 to-violet-500/50 shadow-elevated">
            <div className="rounded-[22px] bg-[#0A1338]/90 backdrop-blur-xl p-8 sm:p-10 text-white text-center space-y-4 border border-white/10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                ¿Listo para digitalizar el catálogo de su empresa?
              </h2>
              <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
                Regístrese hoy en UNIMARKET BO. Verificamos su empresa y active su tienda digital en minutos.
              </p>
              <div className="pt-2">
                <Link
                  to="/registro"
                  className="btn-cta !px-6 !py-3 text-sm sm:text-base font-bold inline-flex items-center gap-2"
                >
                  <span>Comenzar ahora</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

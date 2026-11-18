import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Scale, ArrowLeft, ArrowRight } from 'lucide-react';
import { api } from '../api.js';
import Encabezado from '../components/Encabezado.jsx';

export default function Terminos() {
  const [reglas, setReglas] = useState([
    'Publicar solo productos de su propiedad o que tenga autorización expresa de comercializar.',
    'Mantener precios, descripciones, fotografías y disponibilidad siempre actualizados y veraces.',
    'No publicar productos ilegales, falsificados, de contrabando ni prohibidos por ley.',
    'Respetar en todo momento a las demás empresas registradas y a los clientes compradores.',
    'Las compras, el pago y la entrega se coordinan directamente entre la empresa y el cliente por WhatsApp (UNIMARKET BO no procesa pagos de compras ni retiene fondos).',
    'Mantener la suscripción al día (si vence o se suspende, el portal deja de mostrarse hasta regularizarla).',
    'UNIMARKET BO puede observar o suspender portales por información falsa o incumplimiento de estas reglas.',
  ]);

  useEffect(() => {
    api('/publico/reglas')
      .then((data) => {
        if (data && Array.isArray(data.reglas)) setReglas(data.reglas);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="w-full">
      <Encabezado
        migas={[{ etiqueta: 'Términos y Reglas' }]}
        titulo="Reglas de Uso y Términos del Servicio"
        subtitulo="Normas de publicación, verificación legal de empresas bolivianas y condiciones de uso de UNIMARKET BO."
        icono={Scale}
        acciones={
          <Link
            to="/registro"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-cyan-300 hover:text-white transition-colors bg-white/10 hover:bg-white/15 px-3 py-2 rounded-xl border border-white/15"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Volver al registro</span>
          </Link>
        }
      />

      <div className="-mt-8 relative z-20 max-w-4xl mx-auto px-4 sm:px-6 pb-16 space-y-8">
        {/* Bloque Destacado de Reglas de Uso en Vidrio Oscuro */}
        <section className="card p-6 sm:p-8 space-y-5 border-white/10 bg-white/[0.06] backdrop-blur-xl rounded-3xl shadow-floating text-white">
          <div className="flex items-center gap-2.5 text-white font-bold text-lg">
            <ShieldCheck size={22} className="text-cyan-300" aria-hidden="true" />
            <h2>Reglas obligatorias para empresas registradas</h2>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Toda empresa que registre su actividad comercial en UNIMARKET BO asume la responsabilidad legal y ética sobre sus publicaciones, comprometiéndose expresamente a:
          </p>

          <ol className="space-y-3.5 pt-2">
            {reglas.map((regla, idx) => (
              <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-200">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-cyan-400/15 text-cyan-300 text-xs font-bold shrink-0 border border-cyan-400/30">
                  {idx + 1}
                </span>
                <span className="leading-relaxed">{regla}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Artículos Explicativos */}
        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <section className="card p-6 space-y-3 border-white/10 bg-white/[0.05] rounded-2xl">
            <h3 className="font-bold text-white text-base">
              1. Naturaleza del Servicio y Contacto por WhatsApp
            </h3>
            <p className="text-slate-300">
              UNIMARKET BO es una plataforma de catálogo digital para empresas legalmente establecidas en el Estado Plurinacional de Bolivia. El sistema facilita la visibilidad de los productos y habilita el contacto directo hacia el canal de WhatsApp comercial de cada empresa. UNIMARKET BO no retiene comisiones sobre las ventas ni interviene en los métodos de entrega acordados entre comprador y vendedor.
            </p>
          </section>

          <section className="card p-6 space-y-3 border-white/10 bg-white/[0.05] rounded-2xl">
            <h3 className="font-bold text-white text-base">
              2. Verificación de NIT y Documentación
            </h3>
            <p className="text-slate-300">
              Para garantizar la confiabilidad hacia el público, cada empresa debe presentar su documento de NIT vigente en formato PDF. El equipo administrativo revisa la legitimidad en un plazo de <strong className="text-white">24 a 48 horas</strong>. La empresa no será visible públicamente hasta contar con la verificación aprobada y la suscripción activa.
            </p>
          </section>

          <section className="card p-6 space-y-3 border-white/10 bg-white/[0.05] rounded-2xl">
            <h3 className="font-bold text-white text-base">
              3. Veracidad de la Información y Propiedad Intelectual
            </h3>
            <p className="text-slate-300">
              La empresa declara ser propietaria legítima o contar con las autorizaciones comerciales para la venta de los productos publicados. Los precios declarados deben ser exactos y en moneda nacional (Bolivianos). Queda estrictamente prohibida la publicación de artículos falsificados, ilícitos o engañosos.
            </p>
          </section>

          <section className="card p-6 space-y-3 border-white/10 bg-white/[0.05] rounded-2xl">
            <h3 className="font-bold text-white text-base">
              4. Suspensión y Observación de Portales
            </h3>
            <p className="text-slate-300">
              UNIMARKET BO se reserva el derecho de observar, suspender temporalmente o dar de baja definitiva el portal y catálogo de cualquier empresa ante incumplimiento de las presentes reglas, denuncias justificadas de clientes o falta de pago oportuno de la suscripción.
            </p>
          </section>
        </div>

        <div className="pt-4 text-center">
          <Link to="/planes" className="btn-cta !px-6 !py-3 inline-flex items-center gap-2">
            <span>Ver características del Plan Único</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

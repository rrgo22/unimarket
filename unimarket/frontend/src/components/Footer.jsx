import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Store, ShoppingBag, Sparkles, ShieldCheck } from 'lucide-react';
import Logo from './Logo.jsx';

export default function Footer() {
  const irAlCatalogo = (e) => {
    if (window.location.pathname === '/') {
      e.preventDefault();
      const el = document.getElementById('catalogo');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        window.history.pushState(null, '', '#catalogo');
      }
    }
  };

  return (
    <footer className="relative w-full z-10 bg-[#070F2B] text-slate-300">
      {/* Desvanecido superior suave detrás del contenido para apagar los iconos del fondo sin cubrir tarjetas */}
      <div
        aria-hidden="true"
        className="absolute -top-36 sm:-top-40 inset-x-0 h-36 sm:h-40 bg-gradient-to-b from-transparent via-[#070F2B]/60 to-[#070F2B] pointer-events-none z-0"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          {/* Columna 1: Marca y Propuesta */}
          <div className="space-y-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 text-lg font-bold text-white group outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070F2B] rounded-xl"
              aria-label="Ir al inicio de UNIMARKET BO"
            >
              <Logo tamano="footer" />
            </Link>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xs">
              Conectando empresas bolivianas con clientes de todo el país sin intermediarios ni comisiones.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
              <MapPin size={14} className="text-cyan-400 shrink-0" aria-hidden="true" />
              <span>Bolivia · Cobertura nacional</span>
            </div>
          </div>

          {/* Columna 2: Navegación */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-white">Navegación</p>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <Link
                  to="/catalogo"
                  className="hover:text-cyan-300 transition-colors inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 rounded"
                >
                  <ShoppingBag size={14} className="text-slate-400" aria-hidden="true" />
                  <span>Catálogo de productos</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/empresas"
                  className="hover:text-cyan-300 transition-colors inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 rounded"
                >
                  <Store size={14} className="text-slate-400" aria-hidden="true" />
                  <span>Empresas verificadas</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/planes"
                  className="hover:text-cyan-300 transition-colors inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 rounded"
                >
                  <Sparkles size={14} className="text-slate-400" aria-hidden="true" />
                  <span>Planes y precios</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 3: Cuenta y Legal */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-white">Cuenta y Legal</p>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <Link
                  to="/login"
                  className="hover:text-cyan-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 rounded"
                >
                  Ingresar a mi cuenta
                </Link>
              </li>
              <li>
                <Link
                  to="/registro"
                  className="hover:text-cyan-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 rounded"
                >
                  Registrar mi empresa
                </Link>
              </li>
              <li>
                <Link
                  to="/terminos"
                  className="hover:text-cyan-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 rounded"
                >
                  Términos del servicio y reglas
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 4: Contacto */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-white">Contacto y Soporte</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              ¿Tienes dudas o necesitas asistencia para registrar tu empresa?
            </p>
            <div className="pt-1">
              <a
                href="mailto:unimarketbo@gmail.com"
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-cyan-300 hover:text-cyan-200 transition-colors bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <Mail size={15} aria-hidden="true" />
                <span>unimarketbo@gmail.com</span>
              </a>
            </div>
          </div>
        </div>

        {/* Separación interna fina entre columnas y derechos */}
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <p className="font-medium tracking-wide text-slate-300">UNIMARKET BO · 2026</p>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck size={14} className="text-emerald-400" aria-hidden="true" />
            <span>Plataforma oficial de catálogos bolivianos</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

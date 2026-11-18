import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  Store,
  LogIn,
  UserPlus,
  LayoutDashboard,
  LogOut,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { useAuth } from './auth.jsx';
import Inicio from './pages/Inicio.jsx';
import Catalogo from './pages/Catalogo.jsx';
import Login from './pages/Login.jsx';
import Registro from './pages/Registro.jsx';
import Planes from './pages/Planes.jsx';
import Terminos from './pages/Terminos.jsx';
import PanelEmpresa from './pages/PanelEmpresa.jsx';
import PanelAdmin from './pages/PanelAdmin.jsx';
import PortalEmpresa from './pages/PortalEmpresa.jsx';
import Empresas from './pages/Empresas.jsx';
import RecuperarPassword from './pages/RecuperarPassword.jsx';
import ComprobantePublico from './pages/ComprobantePublico.jsx';
import MenuExplorar from './components/MenuExplorar.jsx';
import FondoAnimado from './components/FondoAnimado.jsx';
import Footer from './components/Footer.jsx';
import Logo from './components/Logo.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const panel = user?.rol === 'administrador' ? '/admin' : '/empresa';

  // Altura y elevación translúcida al hacer scroll (de 80px a 64px)
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setMenuAbierto(false);
  }, [location.pathname]);

  const esCatalogoActivo = location.pathname.startsWith('/catalogo');
  const esEmpresasActivo = location.pathname.startsWith('/empresas');
  const esPlanesActivo = location.pathname.startsWith('/planes');
  const esPanelActivo = user && location.pathname.startsWith(panel);

  return (
    <header
      className={`navbar fixed top-0 inset-x-0 z-40 w-full text-white transition-all duration-200 ${
        scrolled ? 'h-16 navbar-scrolled shadow-subtle' : 'h-20'
      }`}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logotipo oficial con imagen /logo1.png y fallback UM */}
        <Link
          to="/"
          className="flex items-center gap-2.5 group rounded-xl outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070F2B] navbar-text-shadow"
          aria-label="Ir a la página de inicio de UNIMARKET BO"
        >
          <Logo tamano="navbar" />
        </Link>

        {/* Navegación de Escritorio Permanente Oscura */}
        <nav className="hidden md:flex items-center gap-2 text-sm font-medium navbar-text-shadow">
          <MenuExplorar esOscuro={true} />

          <Link
            to="/catalogo"
            className={`!px-3.5 !py-2 rounded-xl flex items-center gap-2 transition-all focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070F2B] ${
              esCatalogoActivo
                ? 'bg-white/10 text-cyan-300 font-semibold border-b-2 border-cyan-400 rounded-b-none'
                : 'text-slate-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <ShoppingBag size={16} strokeWidth={2} aria-hidden="true" />
            <span>Catálogo</span>
          </Link>

          <Link
            to="/empresas"
            className={`!px-3.5 !py-2 rounded-xl flex items-center gap-2 transition-all focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070F2B] ${
              esEmpresasActivo
                ? 'bg-white/10 text-cyan-300 font-semibold border-b-2 border-cyan-400 rounded-b-none'
                : 'text-slate-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <Store size={16} strokeWidth={2} aria-hidden="true" />
            <span>Empresas</span>
          </Link>

          {user ? (
            <>
              <Link
                to={panel}
                className={`!px-3.5 !py-2 rounded-xl flex items-center gap-2 transition-all focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070F2B] ${
                  esPanelActivo
                    ? 'bg-white/10 text-cyan-300 font-semibold border-b-2 border-cyan-400 rounded-b-none'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <LayoutDashboard size={16} strokeWidth={2} aria-hidden="true" />
                <span>Mi panel</span>
              </Link>

              <button
                type="button"
                className="!px-3.5 !py-2 rounded-xl flex items-center gap-2 transition-colors border border-rose-400/30 text-rose-300 hover:bg-rose-500/20 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                onClick={() => {
                  logout();
                  nav('/');
                }}
              >
                <LogOut size={16} strokeWidth={2} aria-hidden="true" />
                <span>Salir ({user.usuario})</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="!px-3.5 !py-2 rounded-xl flex items-center gap-2 transition-colors border border-white/20 text-white hover:bg-white/10 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <LogIn size={16} strokeWidth={2} aria-hidden="true" />
                <span>Ingresar</span>
              </Link>
              <Link
                to="/planes"
                className="btn-cta !px-4 !py-2 text-sm rounded-xl font-bold flex items-center gap-2 shadow-xs focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <UserPlus size={16} strokeWidth={2} aria-hidden="true" />
                <span>Registrarse</span>
              </Link>
            </>
          )}
        </nav>

        {/* Botón Menú Móvil */}
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setMenuAbierto(!menuAbierto)}
            className="grid h-11 w-11 place-items-center rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 active:bg-white/25 transition-colors shadow-2xs focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuAbierto}
          >
            {menuAbierto ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
          </button>
        </div>
      </div>

      {/* Drawer Menú Móvil Oscuro con opacidad 0.94 para alta legibilidad */}
      <AnimatePresence>
        {menuAbierto && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-b border-white/10 bg-[#080F2B]/94 backdrop-blur-md px-4 pb-5 pt-2 md:hidden shadow-floating text-white"
          >
            <div className="flex flex-col gap-2 pt-2">
              <MenuExplorar esBotonMovil={true} onNavegarMovil={() => setMenuAbierto(false)} />

              <Link
                to="/catalogo"
                onClick={() => setMenuAbierto(false)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  esCatalogoActivo ? 'bg-white/15 text-cyan-300' : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <ShoppingBag size={18} className="text-cyan-300" aria-hidden="true" />
                <span>Catálogo de productos</span>
              </Link>

              <Link
                to="/empresas"
                onClick={() => setMenuAbierto(false)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  esEmpresasActivo ? 'bg-white/15 text-cyan-300' : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <Store size={18} className="text-cyan-300" aria-hidden="true" />
                <span>Directorio de empresas</span>
              </Link>

              {user ? (
                <>
                  <Link
                    to={panel}
                    onClick={() => setMenuAbierto(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
                  >
                    <LayoutDashboard size={18} className="text-cyan-300" aria-hidden="true" />
                    <span>Mi panel</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setMenuAbierto(false);
                      nav('/');
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-rose-300 hover:bg-rose-500/20"
                  >
                    <LogOut size={18} aria-hidden="true" />
                    <span>Salir ({user.usuario})</span>
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Link
                    to="/login"
                    onClick={() => setMenuAbierto(false)}
                    className="flex items-center justify-center gap-2 border border-white/20 text-white hover:bg-white/10 rounded-xl py-3 text-sm font-medium"
                  >
                    <LogIn size={16} strokeWidth={2} aria-hidden="true" />
                    <span>Ingresar</span>
                  </Link>
                  <Link
                    to="/planes"
                    onClick={() => setMenuAbierto(false)}
                    className="btn-cta w-full justify-center !py-3 text-sm font-bold shadow-xs flex items-center gap-2"
                  >
                    <UserPlus size={16} strokeWidth={2} aria-hidden="true" />
                    <span>Registrarse</span>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function Protegida({ rol, children }) {
  const { user, cargando } = useAuth();
  if (cargando) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center p-10 text-slate-400">
        <p className="animate-pulse text-sm">Cargando sesión…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.rol !== rol) return <Navigate to={user.rol === 'administrador' ? '/admin' : '/empresa'} replace />;
  return children;
}

export default function App() {
  const location = useLocation();

  // Restaurar automáticamente el scroll arriba (top: 0) en cada cambio de ruta
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  // Determinar nivel de intensidad del fondo animado según la ruta
  const ruta = location.pathname;
  let intensidad = 'media';
  if (ruta === '/' || ruta === '/login') {
    intensidad = 'alta';
  } else if (ruta === '/planes' || ruta === '/terminos') {
    intensidad = 'baja';
  }

  return (
    <ErrorBoundary>
      <div className="min-h-dvh flex flex-col text-slate-100 bg-[#070F2B] relative selection:bg-cyan-500/30 selection:text-cyan-200">
        {/* Fondo animado global permanente con soporte de intensidad */}
        <FondoAnimado intensidad={intensidad} />

        <Navbar />

        <main className="flex-1 w-full flex flex-col relative z-20 bg-transparent">
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/planes" element={<Planes />} />
            <Route path="/terminos" element={<Terminos />} />
            <Route path="/login" element={<Login />} />
            <Route path="/recuperar-password/:token" element={<RecuperarPassword />} />
            <Route path="/comprobante/:token" element={<ComprobantePublico />} />
            <Route path="/registro" element={<Registro />} />
            <Route path="/tienda/:slug" element={<PortalEmpresa />} />
            <Route path="/empresas" element={<Empresas />} />
            <Route
              path="/empresa"
              element={
                <Protegida rol="empresa">
                  <PanelEmpresa />
                </Protegida>
              }
            />
            <Route
              path="/admin"
              element={
                <Protegida rol="administrador">
                  <PanelAdmin />
                </Protegida>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </ErrorBoundary>
  );
}

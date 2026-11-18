import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturó un error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card mx-auto mt-12 max-w-md p-8 text-center space-y-4 shadow-floating border border-rose-500/30 bg-[#0A1338]/95 backdrop-blur-xl text-white rounded-3xl">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-rose-500/20 text-rose-300 mx-auto border border-rose-500/30">
            <AlertTriangle size={32} strokeWidth={2} aria-hidden="true" />
          </div>

          <h2 className="text-xl font-bold text-white">Ha ocurrido un problema inesperado</h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            No se pudo renderizar la vista solicitada. Por favor, intente recargar la página o volver a la portada principal.
          </p>

          {this.state.error?.message && (
            <p className="rounded-xl bg-white/[0.05] p-2.5 font-mono text-xs text-rose-300 break-words border border-white/10">
              {this.state.error.message}
            </p>
          )}

          <div className="flex flex-col sm:flex-row justify-center gap-2 pt-2">
            <button
              onClick={() => window.location.reload()}
              className="btn-cta"
            >
              <RotateCcw size={15} aria-hidden="true" />
              <span>Recargar página</span>
            </button>
            <a href="/" className="btn-light">
              <Home size={15} aria-hidden="true" />
              <span>Ir al inicio</span>
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

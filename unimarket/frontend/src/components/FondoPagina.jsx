import React from 'react';

export default function FondoPagina({ children, className = '' }) {
  return (
    <div className={`relative min-h-full w-full bg-[#070F2B] text-slate-100 ${className}`}>
      {/* Capa de textura ambiental fija y sutil */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        {/* Mancha radial 1: Índigo sutil superior */}
        <div
          className="absolute -top-[15%] left-[10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full blur-[140px] opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(79, 70, 229, 0.20) 0%, transparent 70%)' }}
        />

        {/* Mancha radial 2: Cian sutil inferior */}
        <div
          className="absolute top-[45%] -right-[10%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full blur-[130px] opacity-25 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(34, 211, 238, 0.15) 0%, transparent 70%)' }}
        />

        {/* Cuadrícula de puntos suaves */}
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.3) 1px, transparent 0)`,
            backgroundSize: '28px 28px',
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,0.2) 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,0.2) 100%)',
          }}
        />
      </div>

      {/* Contenido principal por encima del fondo decorativo */}
      <div className="relative z-10 w-full flex flex-col flex-1">
        {children}
      </div>
    </div>
  );
}

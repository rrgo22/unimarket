import React, { useEffect, useState, useMemo } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { obtenerIconosPlataforma } from './iconosFondo.js';

export default function FondoAnimado({ intensidad = 'alta' }) {
  const shouldReduceMotion = useReducedMotion();
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [isTouchOrCoarse, setIsTouchOrCoarse] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 1440,
    h: typeof window !== 'undefined' ? window.innerHeight : 900,
  });

  // Detección de pantalla táctil y redimensionamiento
  useEffect(() => {
    const checkEnvironment = () => {
      const isCoarse = window.matchMedia('(pointer: coarse)').matches;
      setIsTouchOrCoarse(isCoarse);
      setWindowDimensions({ w: window.innerWidth, h: window.innerHeight });
    };
    checkEnvironment();
    window.addEventListener('resize', checkEnvironment, { passive: true });
    return () => window.removeEventListener('resize', checkEnvironment);
  }, []);

  // Pausar animaciones continuas cuando la pestaña no está activa
  useEffect(() => {
    const handleVisibility = () => setIsTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Listener pasivo único de cursor de mouse en window con rAF
  const mouseNormX = useMotionValue(0);
  const mouseNormY = useMotionValue(0);
  const cursorPxX = useMotionValue(-2000);
  const cursorPxY = useMotionValue(-2000);

  // Suavizado cinético ágil con useSpring (stiffness: 140, damping: 16, mass: 0.6)
  const springConfig = useMemo(() => ({ stiffness: 140, damping: 16, mass: 0.6 }), []);
  const smoothMouseX = useSpring(mouseNormX, springConfig);
  const smoothMouseY = useSpring(mouseNormY, springConfig);

  useEffect(() => {
    if (shouldReduceMotion || isTouchOrCoarse) return;

    let rafId = null;
    const handlePointerMove = (e) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const halfW = window.innerWidth / 2;
        const halfH = window.innerHeight / 2;
        const nx = Math.max(-1, Math.min(1, (e.clientX - halfW) / halfW));
        const ny = Math.max(-1, Math.min(1, (e.clientY - halfH) / halfH));
        mouseNormX.set(nx);
        mouseNormY.set(ny);
        cursorPxX.set(e.clientX);
        cursorPxY.set(e.clientY);
      });
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [shouldReduceMotion, isTouchOrCoarse, mouseNormX, mouseNormY, cursorPxX, cursorPxY]);

  const isMobile = windowDimensions.w < 768;
  const multIntensidad = intensidad === 'alta' ? 1.0 : intensidad === 'media' ? 0.7 : 0.5;

  const opacidadAurora =
    intensidad === 'alta' ? 1.0 : intensidad === 'media' ? 0.65 : 0.40;

  // Catálogo de iconos para toda la plataforma (más pequeños, 28 a 56 px con degradados SVG)
  const listaIconos = useMemo(
    () => obtenerIconosPlataforma(intensidad, isMobile),
    [intensidad, isMobile]
  );

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-0 pointer-events-none select-none overflow-hidden bg-[#070F2B] ${
        !isTabVisible ? 'paused-animations' : ''
      }`}
    >
      {/* Definición de degradados SVG globales accesibles por ID en toda la plataforma */}
      <svg
        width="0"
        height="0"
        className="absolute pointer-events-none"
        aria-hidden="true"
        style={{ position: 'fixed', top: -9999, left: -9999 }}
      >
        <defs>
          {/* 1. Cian a Violeta */}
          <linearGradient id="grad-cyan-violet" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>

          {/* 2. Violeta a Rosa */}
          <linearGradient id="grad-violet-pink" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#F472B6" />
          </linearGradient>

          {/* 3. Esmeralda a Cian */}
          <linearGradient id="grad-emerald-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>

          {/* 4. Azul cielo a Índigo */}
          <linearGradient id="grad-sky-indigo" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#818CF8" />
          </linearGradient>
        </defs>
      </svg>

      {/* 1. Malla de aurora cósmica (Cian eléctrico + Índigo/Violeta profundo) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none transition-opacity duration-700"
        style={{ opacity: opacidadAurora }}
      >
        <div
          className={`absolute -top-[20%] -left-[10%] w-[55vw] h-[55vw] max-w-[750px] max-h-[750px] rounded-full bg-gradient-to-tr from-cyan-500/22 via-teal-400/15 to-transparent blur-[110px] mix-blend-screen pointer-events-none ${
            !shouldReduceMotion ? 'animate-aurora-1' : ''
          }`}
        />
        <div
          className={`absolute top-[20%] -right-[15%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full bg-gradient-to-bl from-[#4F46E5]/30 via-[#7C3AED]/20 to-transparent blur-[130px] mix-blend-screen pointer-events-none ${
            !shouldReduceMotion ? 'animate-aurora-2' : ''
          }`}
        />
        <div
          className={`absolute bottom-[-15%] left-[20%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] rounded-full bg-gradient-to-t from-[#7C3AED]/18 via-[#A78BFA]/10 to-transparent blur-[120px] mix-blend-screen pointer-events-none ${
            !shouldReduceMotion ? 'animate-aurora-3' : ''
          }`}
        />
      </div>

      {/* 2. Cuadrícula de puntos radial suave */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.3) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 85%)',
        }}
      />

      {/* 3. Iconos flotantes para toda la plataforma (más pequeños con color y trazo fino) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {listaIconos.map((item) => (
          <IconoPlataformaElemento
            key={item.id}
            item={item}
            multIntensidad={multIntensidad}
            smoothMouseX={smoothMouseX}
            smoothMouseY={smoothMouseY}
            cursorPxX={cursorPxX}
            cursorPxY={cursorPxY}
            winW={windowDimensions.w}
            winH={windowDimensions.h}
            isTouchOrCoarse={isTouchOrCoarse}
            shouldReduceMotion={shouldReduceMotion}
            isTabVisible={isTabVisible}
          />
        ))}
      </div>
    </div>
  );
}

function IconoPlataformaElemento({
  item,
  multIntensidad,
  smoothMouseX,
  smoothMouseY,
  cursorPxX,
  cursorPxY,
  winW,
  winH,
  isTouchOrCoarse,
  shouldReduceMotion,
  isTabVisible,
}) {
  const {
    Icon,
    x,
    y,
    size,
    opacity,
    gradId,
    color,
    blur,
    depthFactor,
    dur,
    delay,
    amplitudY,
    rotacion,
  } = item;

  const basePxX = (parseFloat(x) / 100) * winW;
  const basePxY = (parseFloat(y) / 100) * winH;
  const maxOffset = 48 * depthFactor * multIntensidad;

  // Seguimiento con profundidad + atracción si cursor está a menos de 250px
  const offsetX = useTransform([smoothMouseX, cursorPxX], ([smX, cx]) => {
    if (shouldReduceMotion || isTouchOrCoarse) return 0;
    const baseFollow = smX * maxOffset;
    const dx = cx - basePxX;
    const dy = cursorPxY.get() - basePxY;
    const dist = Math.hypot(dx, dy);
    let attraction = 0;
    if (dist > 0 && dist < 250) {
      const pull = (1 - dist / 250) * 14 * multIntensidad;
      attraction = (dx / dist) * pull;
    }
    return baseFollow + attraction;
  });

  const offsetY = useTransform([smoothMouseY, cursorPxY], ([smY, cy]) => {
    if (shouldReduceMotion || isTouchOrCoarse) return 0;
    const baseFollow = smY * maxOffset;
    const dx = cursorPxX.get() - basePxX;
    const dy = cy - basePxY;
    const dist = Math.hypot(dx, dy);
    let attraction = 0;
    if (dist > 0 && dist < 250) {
      const pull = (1 - dist / 250) * 14 * multIntensidad;
      attraction = (dy / dist) * pull;
    }
    return baseFollow + attraction;
  });

  if (shouldReduceMotion) {
    return (
      <div
        className={`absolute pointer-events-none ${blur}`}
        style={{
          left: x,
          top: y,
          opacity,
        }}
      >
        <Icon
          size={size}
          stroke={gradId ? `url(#${gradId})` : 'currentColor'}
          className={color || ''}
          strokeWidth={1.35}
        />
      </div>
    );
  }

  return (
    <motion.div
      style={{
        left: x,
        top: y,
        x: offsetX,
        y: offsetY,
      }}
      className={`absolute pointer-events-none will-change-transform ${blur}`}
    >
      <motion.div
        animate={
          isTabVisible
            ? {
                y: [-amplitudY, amplitudY, -amplitudY],
                rotate: [-rotacion, rotacion, -rotacion],
              }
            : false
        }
        transition={{
          duration: dur,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
          delay,
        }}
        style={{ opacity }}
      >
        <Icon
          size={size}
          stroke={gradId ? `url(#${gradId})` : 'currentColor'}
          className={color || ''}
          strokeWidth={1.35}
        />
      </motion.div>
    </motion.div>
  );
}

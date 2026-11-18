import React, { useEffect, useState, useMemo } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { CATALOGO_HERO } from './iconosFondo.js';

export default function HeroFondo() {
  const shouldReduceMotion = useReducedMotion();
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isTouchOrCoarse, setIsTouchOrCoarse] = useState(false);
  const [videoAvailable, setVideoAvailable] = useState(true);
  const [windowDimensions, setWindowDimensions] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 1440,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    const checkEnvironment = () => {
      const mobile = window.innerWidth < 768;
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      setIsMobile(mobile);
      setIsTouchOrCoarse(coarse);
      setWindowDimensions({ w: window.innerWidth, h: window.innerHeight });
    };
    checkEnvironment();
    window.addEventListener('resize', checkEnvironment, { passive: true });
    return () => window.removeEventListener('resize', checkEnvironment);
  }, []);

  useEffect(() => {
    const handleVisibility = () => setIsTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Control compartido de mouse con rAF
  const mouseNormX = useMotionValue(0);
  const mouseNormY = useMotionValue(0);
  const cursorPxX = useMotionValue(-2000);
  const cursorPxY = useMotionValue(-2000);

  const springConfig = useMemo(() => ({ stiffness: 140, damping: 16, mass: 0.6 }), []);
  const smoothMouseX = useSpring(mouseNormX, springConfig);
  const smoothMouseY = useSpring(mouseNormY, springConfig);

  useEffect(() => {
    if (shouldReduceMotion || isTouchOrCoarse || isMobile) return;

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
  }, [shouldReduceMotion, isTouchOrCoarse, isMobile, mouseNormX, mouseNormY, cursorPxX, cursorPxY]);

  // Selección de iconos grandes para el Hero
  const visibleIcons = useMemo(() => {
    if (isMobile) {
      // 8 iconos balanceados en móvil
      return [
        CATALOGO_HERO[0], // Coffee
        CATALOGO_HERO[1], // Laptop
        CATALOGO_HERO[2], // Wrench
        CATALOGO_HERO[3], // Smartphone
        CATALOGO_HERO[5], // Shirt
        CATALOGO_HERO[7], // Sparkles
        CATALOGO_HERO[8], // Store
        CATALOGO_HERO[9], // Headphones
      ];
    }
    // Todos los del catálogo hero
    return CATALOGO_HERO;
  }, [isMobile]);

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none z-0 ${
        !isTabVisible ? 'paused-animations' : ''
      }`}
      style={{
        maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 65%, rgba(0,0,0,0) 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 65%, rgba(0,0,0,0) 100%)',
      }}
    >
      {/* 1. Ranura de video opcional */}
      {videoAvailable && !isMobile && !shouldReduceMotion && (
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            onError={() => setVideoAvailable(false)}
            className="w-full h-full object-cover opacity-20 mix-blend-luminosity filter contrast-125"
          >
            <source src="/videos/hero.webm" type="video/webm" />
            <source src="/videos/hero.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-[#0B1437]/75" />
        </div>
      )}

      {/* 2. Malla de aurora cósmica (Cian + Índigo/Violeta + Lavanda) */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* Mancha 1: Cian eléctrico */}
        <div
          className={`absolute -top-[20%] -left-[10%] w-[55vw] h-[55vw] max-w-[750px] max-h-[750px] rounded-full bg-gradient-to-tr from-cyan-500/25 via-teal-400/20 to-transparent blur-[100px] mix-blend-screen pointer-events-none ${
            !shouldReduceMotion ? 'animate-aurora-1' : ''
          }`}
        />
        {/* Mancha 2: Índigo / Violeta profundo */}
        <div
          className={`absolute top-[10%] -right-[15%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full bg-gradient-to-bl from-[#4F46E5]/35 via-[#7C3AED]/22 to-transparent blur-[120px] mix-blend-screen pointer-events-none ${
            !shouldReduceMotion ? 'animate-aurora-2' : ''
          }`}
        />
        {/* Mancha 3: Lavanda y violeta suave */}
        <div
          className={`absolute -bottom-[25%] left-[25%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] rounded-full bg-gradient-to-t from-[#7C3AED]/20 via-[#A78BFA]/12 to-transparent blur-[110px] mix-blend-screen pointer-events-none ${
            !shouldReduceMotion ? 'animate-aurora-3' : ''
          }`}
        />
        {/* Mancha 4: Destello cian central de profundidad */}
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[35vw] h-[35vw] max-w-[450px] max-h-[450px] rounded-full bg-cyan-400/10 blur-[90px] mix-blend-screen pointer-events-none" />
      </div>

      {/* 3. Cuadrícula radial y textura de grano */}
      <div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.35) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 75%)',
        }}
      />

      <svg
        className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none mix-blend-overlay z-0"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="hero-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#hero-grain)" />
      </svg>

      {/* 4. Iconos grandes del hero con profundidad y degradados */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {visibleIcons.map((item) => (
          <HeroIconoFlotante
            key={item.id}
            item={item}
            smoothMouseX={smoothMouseX}
            smoothMouseY={smoothMouseY}
            cursorPxX={cursorPxX}
            cursorPxY={cursorPxY}
            winW={windowDimensions.w}
            winH={windowDimensions.h}
            shouldReduceMotion={shouldReduceMotion}
            isTouchOrCoarse={isTouchOrCoarse}
            isMobile={isMobile}
            isTabVisible={isTabVisible}
          />
        ))}
      </div>
    </div>
  );
}

function HeroIconoFlotante({
  item,
  smoothMouseX,
  smoothMouseY,
  cursorPxX,
  cursorPxY,
  winW,
  winH,
  shouldReduceMotion,
  isTouchOrCoarse,
  isMobile,
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
  const maxOffset = 48 * depthFactor;

  const offsetX = useTransform([smoothMouseX, cursorPxX], ([smX, cx]) => {
    if (shouldReduceMotion || isTouchOrCoarse || isMobile) return 0;
    const baseFollow = smX * maxOffset;
    const dx = cx - basePxX;
    const dy = cursorPxY.get() - basePxY;
    const dist = Math.hypot(dx, dy);
    let attraction = 0;
    if (dist > 0 && dist < 250) {
      const pull = (1 - dist / 250) * 14;
      attraction = (dx / dist) * pull;
    }
    return baseFollow + attraction;
  });

  const offsetY = useTransform([smoothMouseY, cursorPxY], ([smY, cy]) => {
    if (shouldReduceMotion || isTouchOrCoarse || isMobile) return 0;
    const baseFollow = smY * maxOffset;
    const dx = cursorPxX.get() - basePxX;
    const dy = cy - basePxY;
    const dist = Math.hypot(dx, dy);
    let attraction = 0;
    if (dist > 0 && dist < 250) {
      const pull = (1 - dist / 250) * 14;
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

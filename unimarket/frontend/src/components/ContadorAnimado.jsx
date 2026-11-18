import React, { useEffect, useState, useRef } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

export default function ContadorAnimado({ objetivo, valor, duracion = 1200 }) {
  const meta = typeof valor === 'number' ? valor : (typeof objetivo === 'number' ? objetivo : 0);
  const ref = useRef(null);
  const estaEnVista = useInView(ref, { once: true, margin: '-20px' });
  const shouldReduceMotion = useReducedMotion();
  const [conteo, setConteo] = useState(0);

  useEffect(() => {
    if (shouldReduceMotion) {
      setConteo(meta);
      return;
    }

    if (!estaEnVista) return;

    if (meta === 0) {
      setConteo(0);
      return;
    }

    let inicioTimestamp = null;
    let animId = null;

    const animar = (timestamp) => {
      if (!inicioTimestamp) inicioTimestamp = timestamp;
      const progreso = Math.min((timestamp - inicioTimestamp) / duracion, 1);

      // Easing suave cuadrático hacia el final
      const ease = 1 - Math.pow(1 - progreso, 3);
      setConteo(Math.round(ease * meta));

      if (progreso < 1) {
        animId = requestAnimationFrame(animar);
      } else {
        setConteo(meta);
      }
    };

    animId = requestAnimationFrame(animar);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [estaEnVista, meta, duracion, shouldReduceMotion]);

  return (
    <span ref={ref} className="tabular-nums">
      {conteo}
    </span>
  );
}

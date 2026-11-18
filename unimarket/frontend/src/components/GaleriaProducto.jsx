import { useState, useEffect, useCallback, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import 'yet-another-react-lightbox/plugins/counter.css';
import { ChevronLeft, ChevronRight, Maximize2, Package } from 'lucide-react';
import { imgUrl } from '../api.js';

export default function GaleriaProducto({ imagenes = [], nombre = 'Producto' }) {
  const lista = (Array.isArray(imagenes) ? imagenes : []).filter(Boolean);
  const total = lista.length;

  const [indiceActivo, setIndiceActivo] = useState(0);
  const [lightboxAbierto, setLightboxAbierto] = useState(false);
  const [zoomActivo, setZoomActivo] = useState(false);
  const [posicionMouse, setPosicionMouse] = useState({ x: 50, y: 50 });

  // Embla carousel para swipe táctil y navegación
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: total > 1,
    skipSnaps: false,
  });

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setIndiceActivo(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    return () => emblaApi.off('select', onSelect);
  }, [emblaApi, onSelect]);

  // Precargar la imagen siguiente para transición inmediata
  useEffect(() => {
    if (total <= 1) return;
    const proxIndice = (indiceActivo + 1) % total;
    const precarga = new Image();
    precarga.src = imgUrl(lista[proxIndice]);
  }, [indiceActivo, lista, total]);

  const anterior = useCallback(
    (e) => {
      e?.stopPropagation();
      if (!emblaApi) return;
      emblaApi.scrollPrev();
    },
    [emblaApi]
  );

  const siguiente = useCallback(
    (e) => {
      e?.stopPropagation();
      if (!emblaApi) return;
      emblaApi.scrollNext();
    },
    [emblaApi]
  );

  const irA = useCallback(
    (index) => {
      if (!emblaApi) return;
      emblaApi.scrollTo(index);
      setIndiceActivo(index);
    },
    [emblaApi]
  );

  // Navegación por teclado con flechas izquierda y derecha
  const manejarTeclado = (e) => {
    if (total <= 1) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      anterior();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      siguiente();
    }
  };

  // Lupa de zoom en escritorio
  const manejarMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPosicionMouse({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  };

  // Manejo de doble toque en móvil para abrir lightbox directamente
  const ultimoTap = useRef(0);
  const manejarTouchEnd = () => {
    const ahora = Date.now();
    if (ahora - ultimoTap.current < 300) {
      setLightboxAbierto(true);
    }
    ultimoTap.current = ahora;
  };

  if (total === 0) {
    return (
      <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white/[0.04] flex flex-col items-center justify-center gap-2 border border-white/10 text-slate-500">
        <Package size={56} strokeWidth={1.5} aria-hidden="true" />
        <span className="text-xs text-slate-400 font-medium">Sin imagen registrada</span>
      </div>
    );
  }

  return (
    <div
      className="select-none outline-none"
      onKeyDown={manejarTeclado}
      tabIndex={0}
      aria-label={`Galería de fotos de ${nombre}`}
    >
      {/* Contenedor Principal de la Imagen */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white/[0.04] border border-white/10 group">
        {/* Carrusel Embla */}
        <div className="h-full w-full overflow-hidden" ref={emblaRef}>
          <div className="flex h-full w-full">
            {lista.map((img, idx) => (
              <div
                key={img + idx}
                className="relative h-full w-full shrink-0 grow-0 basis-full flex items-center justify-center overflow-hidden cursor-zoom-in"
                onClick={() => setLightboxAbierto(true)}
                onTouchEnd={manejarTouchEnd}
                onMouseEnter={() => setZoomActivo(true)}
                onMouseLeave={() => setZoomActivo(false)}
                onMouseMove={manejarMouseMove}
              >
                <img
                  src={imgUrl(img)}
                  alt={`${nombre} - Imagen ${idx + 1} de ${total}`}
                  loading="lazy"
                  className="h-full w-full object-contain p-2 transition-transform duration-100 ease-out"
                  style={
                    zoomActivo && idx === indiceActivo
                      ? {
                          transform: 'scale(2.2)',
                          transformOrigin: `${posicionMouse.x}% ${posicionMouse.y}%`,
                        }
                      : {
                          transform: 'scale(1)',
                        }
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {/* Contador indicador "2 / 4" */}
        {total > 1 && (
          <div className="absolute top-3 left-3 z-20 pointer-events-none">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-semibold text-white shadow-2xs backdrop-blur-xs border border-white/10">
              {indiceActivo + 1} / {total}
            </span>
          </div>
        )}

        {/* Botón para abrir Lightbox a pantalla completa */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxAbierto(true);
          }}
          className="absolute top-3 right-3 z-20 grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white shadow-sm backdrop-blur-xs hover:bg-white/20 hover:scale-105 active:scale-95 transition-all border border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          aria-label="Ampliar imagen"
        >
          <Maximize2 size={16} strokeWidth={2} aria-hidden="true" />
        </button>

        {/* Flechas de navegación (solo si hay más de 1 imagen) */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={anterior}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white shadow-md backdrop-blur-xs hover:bg-white/20 hover:scale-105 active:scale-95 transition-all border border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              aria-label="Imagen anterior"
            >
              <ChevronLeft size={20} strokeWidth={2.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={siguiente}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white shadow-md backdrop-blur-xs hover:bg-white/20 hover:scale-105 active:scale-95 transition-all border border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              aria-label="Imagen siguiente"
            >
              <ChevronRight size={20} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </>
        )}

        {/* Puntos de paginación (solo si hay más de 1 imagen) */}
        {total > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-slate-950/60 px-2.5 py-1 backdrop-blur-xs pointer-events-auto border border-white/10">
            {lista.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  irA(i);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  i === indiceActivo ? 'w-4 bg-cyan-400' : 'w-1.5 bg-white/40 hover:bg-white'
                }`}
                aria-label={`Ir a imagen ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tira de Miniaturas Inferior */}
      {total > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {lista.map((img, i) => (
            <button
              key={img + i}
              type="button"
              onClick={() => irA(i)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all bg-white/[0.04] ${
                i === indiceActivo
                  ? 'border-cyan-400 ring-2 ring-cyan-400/30 shadow-sm opacity-100'
                  : 'border-white/15 opacity-60 hover:opacity-100'
              }`}
              aria-label={`Ver foto ${i + 1} de ${total}`}
              aria-current={i === indiceActivo ? 'true' : undefined}
            >
              <img
                src={imgUrl(img)}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Visor Lightbox a Pantalla Completa */}
      <Lightbox
        open={lightboxAbierto}
        close={() => setLightboxAbierto(false)}
        index={indiceActivo}
        slides={lista.map((img, i) => ({
          src: imgUrl(img),
          alt: `${nombre} - Foto ${i + 1} de ${total}`,
        }))}
        plugins={[Zoom, Thumbnails, Counter]}
        zoom={{
          maxZoomPixelRatio: 3,
          zoomInMultiplier: 1.5,
          doubleTapDelay: 300,
          doubleClickDelay: 300,
        }}
        on={{
          view: ({ index }) => {
            setIndiceActivo(index);
            emblaApi?.scrollTo(index);
          },
        }}
        labels={{
          Next: 'Imagen siguiente',
          Previous: 'Imagen anterior',
          Close: 'Cerrar visor',
          Reset: 'Restablecer',
          'Zoom in': 'Acercar',
          'Zoom out': 'Alejar',
        }}
      />
    </div>
  );
}

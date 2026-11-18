import {
  // Herramientas de trabajo
  Hammer,
  Wrench,
  Drill,
  PaintRoller,
  HardHat,
  Toolbox,
  Plug,
  Cable,
  Nut,
  Ruler,
  Axe,
  // Tecnología
  Laptop,
  Headphones,
  Smartphone,
  Watch,
  Gamepad2,
  Camera,
  Mouse,
  Keyboard,
  Monitor,
  Speaker,
  Printer,
  // Electrodomésticos y hogar
  Refrigerator,
  Microwave,
  Fan,
  Lamp,
  Coffee,
  CookingPot,
  WashingMachine,
  // Ropa y accesorios
  Shirt,
  Footprints,
  Backpack,
  Gem,
  Glasses,
  ShoppingBag,
  // Otros
  Gift,
  Book,
  Dumbbell,
  Package,
  Store,
  Sparkles,
  Bike,
  Tag,
  Apple,
} from 'lucide-react';

/**
 * 1. ICONOS GRANDES PARA EL HERO (Inicio)
 * Conservan tamaños destacados (44 a 104 px) con soporte de degradados SVG y colores vibrantes
 */
export const CATALOGO_HERO = [
  { id: 'h-coffee', Icon: Coffee, categoria: 'hogar', capa: 'cercana', x: '3%', y: '12%', size: 48, opacity: 0.20, gradId: 'grad-violet-pink', color: '', blur: '', depthFactor: 1.0, dur: 7.2, delay: 0.2, amplitudY: 15, rotacion: 5 },
  { id: 'h-laptop', Icon: Laptop, categoria: 'tecnologia', capa: 'lejana', x: '10%', y: '24%', size: 96, opacity: 0.10, gradId: 'grad-sky-indigo', color: '', blur: 'blur-[1.5px]', depthFactor: 0.25, dur: 9.8, delay: 1.1, amplitudY: 18, rotacion: -4 },
  { id: 'h-wrench', Icon: Wrench, categoria: 'herramientas', capa: 'media', x: '4%', y: '40%', size: 68, opacity: 0.14, gradId: null, color: 'text-white', blur: '', depthFactor: 0.6, dur: 8.0, delay: 0.6, amplitudY: 14, rotacion: 6 },
  { id: 'h-phone', Icon: Smartphone, categoria: 'tecnologia', capa: 'cercana', x: '14%', y: '52%', size: 46, opacity: 0.22, gradId: 'grad-cyan-violet', color: '', blur: '', depthFactor: 1.0, dur: 6.8, delay: 1.8, amplitudY: 16, rotacion: -5 },
  { id: 'h-hammer', Icon: Hammer, categoria: 'herramientas', capa: 'lejana', x: '5%', y: '68%', size: 104, opacity: 0.09, gradId: null, color: 'text-white', blur: 'blur-[1.5px]', depthFactor: 0.25, dur: 10.4, delay: 0.9, amplitudY: 19, rotacion: 5 },
  { id: 'h-shirt', Icon: Shirt, categoria: 'ropa', capa: 'media', x: '13%', y: '80%', size: 64, opacity: 0.15, gradId: 'grad-violet-pink', color: '', blur: '', depthFactor: 0.6, dur: 7.6, delay: 2.3, amplitudY: 15, rotacion: -4 },
  { id: 'h-gift', Icon: Gift, categoria: 'otros', capa: 'cercana', x: '6%', y: '90%', size: 52, opacity: 0.20, gradId: 'grad-emerald-cyan', color: '', blur: '', depthFactor: 1.0, dur: 6.5, delay: 0.4, amplitudY: 13, rotacion: 4 },
  { id: 'h-sparkles', Icon: Sparkles, categoria: 'otros', capa: 'cercana', x: '92%', y: '12%', size: 48, opacity: 0.22, gradId: 'grad-cyan-violet', color: '', blur: '', depthFactor: 1.0, dur: 7.0, delay: 0.8, amplitudY: 16, rotacion: 6 },
  { id: 'h-store', Icon: Store, categoria: 'hogar', capa: 'media', x: '84%', y: '24%', size: 72, opacity: 0.15, gradId: null, color: 'text-white', blur: '', depthFactor: 0.6, dur: 8.5, delay: 1.5, amplitudY: 14, rotacion: -5 },
  { id: 'h-headphones', Icon: Headphones, categoria: 'tecnologia', capa: 'lejana', x: '93%', y: '38%', size: 92, opacity: 0.10, gradId: 'grad-sky-indigo', color: '', blur: 'blur-[1.5px]', depthFactor: 0.25, dur: 10.1, delay: 2.0, amplitudY: 17, rotacion: 4 },
  { id: 'h-watch', Icon: Watch, categoria: 'tecnologia', capa: 'cercana', x: '85%', y: '50%', size: 50, opacity: 0.20, gradId: 'grad-emerald-cyan', color: '', blur: '', depthFactor: 1.0, dur: 6.7, delay: 0.5, amplitudY: 14, rotacion: -6 },
  { id: 'h-backpack', Icon: Backpack, categoria: 'ropa', capa: 'media', x: '93%', y: '64%', size: 64, opacity: 0.16, gradId: 'grad-cyan-violet', color: '', blur: '', depthFactor: 0.6, dur: 8.2, delay: 1.2, amplitudY: 15, rotacion: 5 },
  { id: 'h-fridge', Icon: Refrigerator, categoria: 'hogar', capa: 'lejana', x: '84%', y: '76%', size: 100, opacity: 0.09, gradId: null, color: 'text-white', blur: 'blur-[1.5px]', depthFactor: 0.25, dur: 10.6, delay: 2.5, amplitudY: 18, rotacion: -4 },
  { id: 'h-gamepad', Icon: Gamepad2, categoria: 'tecnologia', capa: 'cercana', x: '91%', y: '89%', size: 48, opacity: 0.21, gradId: 'grad-violet-pink', color: '', blur: '', depthFactor: 1.0, dur: 6.9, delay: 1.0, amplitudY: 16, rotacion: 6 },
  { id: 'h-drill', Icon: Drill, categoria: 'herramientas', capa: 'media', x: '25%', y: '8%', size: 60, opacity: 0.13, gradId: null, color: 'text-white', blur: '', depthFactor: 0.6, dur: 7.8, delay: 1.4, amplitudY: 13, rotacion: -5 },
  { id: 'h-lamp', Icon: Lamp, categoria: 'hogar', capa: 'cercana', x: '75%', y: '8%', size: 46, opacity: 0.19, gradId: 'grad-cyan-violet', color: '', blur: '', depthFactor: 1.0, dur: 7.4, delay: 0.3, amplitudY: 15, rotacion: 4 },
  { id: 'h-book', Icon: Book, categoria: 'otros', capa: 'media', x: '27%', y: '92%', size: 62, opacity: 0.14, gradId: 'grad-sky-indigo', color: '', blur: '', depthFactor: 0.6, dur: 8.8, delay: 2.1, amplitudY: 14, rotacion: 5 },
  { id: 'h-footprints', Icon: Footprints, categoria: 'ropa', capa: 'cercana', x: '72%', y: '92%', size: 46, opacity: 0.19, gradId: null, color: 'text-white', blur: '', depthFactor: 1.0, dur: 6.6, delay: 1.7, amplitudY: 15, rotacion: -5 },
];

/**
 * 2. ICONOS COMPACTOS PARA TODA LA PLATAFORMA (FondoAnimado)
 * Más pequeños (28 a 56 px), con 70% color degradado SVG y 30% blanco,
 * repartidos perimetralmente para no tapar texto ni formularios.
 * - Lejana: 40 a 56 px, blur 1px, opacidad 8 a 12 %, factor 0.25
 * - Media: 32 a 44 px, sin blur, opacidad 12 a 18 %, factor 0.60
 * - Cercana: 28 a 36 px, sin blur, opacidad 16 a 24 %, factor 1.00
 */
export const CATALOGO_PLATAFORMA = [
  // Flanco Izquierdo Superior (y: 4% - 28%)
  { id: 'p-wrench', Icon: Wrench, categoria: 'herramientas', capa: 'cercana', x: '3%', y: '6%', size: 32, opacity: 0.20, gradId: 'grad-cyan-violet', color: '', blur: '', depthFactor: 1.0, dur: 7.0, delay: 0.3, amplitudY: 14, rotacion: 5 },
  { id: 'p-laptop', Icon: Laptop, categoria: 'tecnologia', capa: 'lejana', x: '9%', y: '16%', size: 48, opacity: 0.10, gradId: 'grad-sky-indigo', color: '', blur: 'blur-[1px]', depthFactor: 0.25, dur: 9.5, delay: 1.2, amplitudY: 16, rotacion: -4 },
  { id: 'p-coffee', Icon: Coffee, categoria: 'hogar', capa: 'media', x: '4%', y: '28%', size: 38, opacity: 0.15, gradId: 'grad-violet-pink', color: '', blur: '', depthFactor: 0.6, dur: 7.8, delay: 0.7, amplitudY: 13, rotacion: 4 },

  // Flanco Izquierdo Medio (y: 36% - 64%)
  { id: 'p-shirt', Icon: Shirt, categoria: 'ropa', capa: 'cercana', x: '12%', y: '38%', size: 34, opacity: 0.22, gradId: null, color: 'text-white', blur: '', depthFactor: 1.0, dur: 6.8, delay: 2.1, amplitudY: 15, rotacion: -5 },
  { id: 'p-drill', Icon: Drill, categoria: 'herramientas', capa: 'media', x: '3%', y: '48%', size: 40, opacity: 0.16, gradId: 'grad-emerald-cyan', color: '', blur: '', depthFactor: 0.6, dur: 8.2, delay: 0.9, amplitudY: 14, rotacion: 6 },
  { id: 'p-headphones', Icon: Headphones, categoria: 'tecnologia', capa: 'lejana', x: '10%', y: '58%', size: 52, opacity: 0.11, gradId: 'grad-cyan-violet', color: '', blur: 'blur-[1px]', depthFactor: 0.25, dur: 10.0, delay: 1.6, amplitudY: 17, rotacion: -4 },

  // Flanco Izquierdo Inferior (y: 68% - 94%)
  { id: 'p-backpack', Icon: Backpack, categoria: 'ropa', capa: 'media', x: '4%', y: '68%', size: 36, opacity: 0.15, gradId: 'grad-violet-pink', color: '', blur: '', depthFactor: 0.6, dur: 7.6, delay: 0.4, amplitudY: 13, rotacion: 5 },
  { id: 'p-hammer', Icon: Hammer, categoria: 'herramientas', capa: 'lejana', x: '11%', y: '78%', size: 50, opacity: 0.10, gradId: null, color: 'text-white', blur: 'blur-[1px]', depthFactor: 0.25, dur: 9.8, delay: 2.3, amplitudY: 18, rotacion: -5 },
  { id: 'p-gift', Icon: Gift, categoria: 'otros', capa: 'cercana', x: '5%', y: '88%', size: 30, opacity: 0.21, gradId: 'grad-emerald-cyan', color: '', blur: '', depthFactor: 1.0, dur: 6.5, delay: 1.1, amplitudY: 14, rotacion: 4 },

  // Flanco Derecho Superior (y: 4% - 28%)
  { id: 'p-sparkles', Icon: Sparkles, categoria: 'otros', capa: 'cercana', x: '92%', y: '7%', size: 32, opacity: 0.22, gradId: 'grad-cyan-violet', color: '', blur: '', depthFactor: 1.0, dur: 7.2, delay: 0.5, amplitudY: 15, rotacion: 6 },
  { id: 'p-store', Icon: Store, categoria: 'hogar', capa: 'media', x: '85%', y: '17%', size: 42, opacity: 0.16, gradId: null, color: 'text-white', blur: '', depthFactor: 0.6, dur: 8.4, delay: 1.8, amplitudY: 14, rotacion: -5 },
  { id: 'p-phone', Icon: Smartphone, categoria: 'tecnologia', capa: 'cercana', x: '93%', y: '28%', size: 30, opacity: 0.20, gradId: 'grad-sky-indigo', color: '', blur: '', depthFactor: 1.0, dur: 6.9, delay: 0.8, amplitudY: 13, rotacion: 4 },

  // Flanco Derecho Medio (y: 38% - 64%)
  { id: 'p-watch', Icon: Watch, categoria: 'tecnologia', capa: 'media', x: '86%', y: '40%', size: 36, opacity: 0.15, gradId: 'grad-violet-pink', color: '', blur: '', depthFactor: 0.6, dur: 7.9, delay: 2.0, amplitudY: 14, rotacion: -6 },
  { id: 'p-fridge', Icon: Refrigerator, categoria: 'hogar', capa: 'lejana', x: '92%', y: '50%', size: 54, opacity: 0.10, gradId: 'grad-emerald-cyan', color: '', blur: 'blur-[1px]', depthFactor: 0.25, dur: 10.4, delay: 1.3, amplitudY: 18, rotacion: 4 },
  { id: 'p-footprints', Icon: Footprints, categoria: 'ropa', capa: 'cercana', x: '85%', y: '62%', size: 32, opacity: 0.19, gradId: null, color: 'text-white', blur: '', depthFactor: 1.0, dur: 6.7, delay: 0.6, amplitudY: 15, rotacion: -4 },

  // Flanco Derecho Inferior (y: 70% - 94%)
  { id: 'p-gamepad', Icon: Gamepad2, categoria: 'tecnologia', capa: 'cercana', x: '92%', y: '72%', size: 34, opacity: 0.21, gradId: 'grad-cyan-violet', color: '', blur: '', depthFactor: 1.0, dur: 7.1, delay: 1.9, amplitudY: 14, rotacion: 5 },
  { id: 'p-roller', Icon: PaintRoller, categoria: 'herramientas', capa: 'lejana', x: '84%', y: '82%', size: 48, opacity: 0.11, gradId: 'grad-sky-indigo', color: '', blur: 'blur-[1px]', depthFactor: 0.25, dur: 9.6, delay: 0.9, amplitudY: 16, rotacion: -5 },
  { id: 'p-gem', Icon: Gem, categoria: 'ropa', capa: 'media', x: '91%', y: '91%', size: 38, opacity: 0.17, gradId: 'grad-violet-pink', color: '', blur: '', depthFactor: 0.6, dur: 8.0, delay: 1.4, amplitudY: 15, rotacion: 6 },

  // Perímetro Superior Despejado (y: 3% - 10%)
  { id: 'p-lamp', Icon: Lamp, categoria: 'hogar', capa: 'cercana', x: '24%', y: '5%', size: 28, opacity: 0.18, gradId: null, color: 'text-white', blur: '', depthFactor: 1.0, dur: 7.3, delay: 0.4, amplitudY: 13, rotacion: 4 },
  { id: 'p-camera', Icon: Camera, categoria: 'tecnologia', capa: 'media', x: '76%', y: '5%', size: 36, opacity: 0.14, gradId: 'grad-emerald-cyan', color: '', blur: '', depthFactor: 0.6, dur: 8.1, delay: 1.7, amplitudY: 14, rotacion: -4 },

  // Perímetro Inferior Despejado (y: 89% - 95%)
  { id: 'p-book', Icon: Book, categoria: 'otros', capa: 'media', x: '25%', y: '93%', size: 38, opacity: 0.15, gradId: 'grad-sky-indigo', color: '', blur: '', depthFactor: 0.6, dur: 8.6, delay: 1.0, amplitudY: 14, rotacion: 5 },
  { id: 'p-dumbbell', Icon: Dumbbell, categoria: 'otros', capa: 'cercana', x: '75%', y: '93%', size: 30, opacity: 0.19, gradId: 'grad-cyan-violet', color: '', blur: '', depthFactor: 1.0, dur: 6.8, delay: 2.2, amplitudY: 13, rotacion: -5 },

  // 4 Iconos de Refuerzo para Nivel Alto (26 en total)
  { id: 'p-glasses', Icon: Glasses, categoria: 'ropa', capa: 'media', x: '14%', y: '22%', size: 34, opacity: 0.14, gradId: 'grad-violet-pink', color: '', blur: '', depthFactor: 0.6, dur: 7.7, delay: 1.5, amplitudY: 13, rotacion: 4 },
  { id: 'p-microwave', Icon: Microwave, categoria: 'hogar', capa: 'lejana', x: '88%', y: '33%', size: 46, opacity: 0.09, gradId: null, color: 'text-white', blur: 'blur-[1px]', depthFactor: 0.25, dur: 10.2, delay: 0.3, amplitudY: 17, rotacion: -4 },
  { id: 'p-toolbox', Icon: Toolbox, categoria: 'herramientas', capa: 'cercana', x: '13%', y: '84%', size: 32, opacity: 0.20, gradId: 'grad-emerald-cyan', color: '', blur: '', depthFactor: 1.0, dur: 6.9, delay: 1.8, amplitudY: 14, rotacion: 5 },
  { id: 'p-tag', Icon: Tag, categoria: 'otros', capa: 'media', x: '87%', y: '75%', size: 36, opacity: 0.16, gradId: 'grad-cyan-violet', color: '', blur: '', depthFactor: 0.6, dur: 8.3, delay: 0.7, amplitudY: 14, rotacion: -4 },
];

/**
 * Retorna la lista determinística de iconos según la intensidad y tamaño de pantalla
 * - 'alta' (Inicio): 26 en escritorio, 10 en móvil
 * - 'media' (Empresas, Registro, Portal, Paneles): 18 en escritorio, 8 en móvil
 * - 'baja' (Planes, Términos, Login): 12 en escritorio, 6 en móvil
 */
export function obtenerIconosPlataforma(intensidad = 'alta', isMobile = false) {
  if (isMobile) {
    if (intensidad === 'baja') {
      // 6 iconos variados para móvil
      return [
        CATALOGO_PLATAFORMA[0], // Wrench (Herramientas)
        CATALOGO_PLATAFORMA[1], // Laptop (Tecnología)
        CATALOGO_PLATAFORMA[2], // Coffee (Hogar)
        CATALOGO_PLATAFORMA[3], // Shirt (Ropa)
        CATALOGO_PLATAFORMA[9], // Sparkles (Otros)
        CATALOGO_PLATAFORMA[10], // Store (Hogar/Comercio)
      ];
    }
    if (intensidad === 'media') {
      // 8 iconos para móvil
      return [
        CATALOGO_PLATAFORMA[0], // Wrench
        CATALOGO_PLATAFORMA[1], // Laptop
        CATALOGO_PLATAFORMA[2], // Coffee
        CATALOGO_PLATAFORMA[3], // Shirt
        CATALOGO_PLATAFORMA[8], // Gift
        CATALOGO_PLATAFORMA[9], // Sparkles
        CATALOGO_PLATAFORMA[10], // Store
        CATALOGO_PLATAFORMA[12], // Watch
      ];
    }
    // 'alta' móvil: 10 iconos
    return [
      CATALOGO_PLATAFORMA[0], // Wrench
      CATALOGO_PLATAFORMA[1], // Laptop
      CATALOGO_PLATAFORMA[2], // Coffee
      CATALOGO_PLATAFORMA[3], // Shirt
      CATALOGO_PLATAFORMA[4], // Drill
      CATALOGO_PLATAFORMA[8], // Gift
      CATALOGO_PLATAFORMA[9], // Sparkles
      CATALOGO_PLATAFORMA[10], // Store
      CATALOGO_PLATAFORMA[11], // Smartphone
      CATALOGO_PLATAFORMA[15], // Gamepad2
    ];
  }

  // Escritorio
  if (intensidad === 'baja') {
    return CATALOGO_PLATAFORMA.slice(0, 12);
  }
  if (intensidad === 'media') {
    return CATALOGO_PLATAFORMA.slice(0, 18);
  }
  // 'alta': todos los 26
  return CATALOGO_PLATAFORMA;
}

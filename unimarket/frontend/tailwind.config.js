/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb', // Primario sobrio accesible
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        cta: {
          from: '#4F46E5',
          to: '#7C3AED',
          hoverFrom: '#5B52F0',
          hoverTo: '#8B4BF5',
        },
        hero: {
          dark: '#070F2B',
          deep: '#0B1437',
          indigo: '#14205F',
          cyan: '#22D3EE',
          teal: '#14B8A6',
          lavender: '#A78BFA',
          violet: '#7C3AED',
        },
        dark: {
          base: '#070F2B',
          deep: '#0B1437',
          surface: '#0E1A44',
          card: 'rgba(255, 255, 255, 0.05)',
          border: 'rgba(255, 255, 255, 0.10)',
        },
      },
      screens: {
        xs: '390px',
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgb(0 0 0 / 0.15)',
        'xs': '0 1px 3px 0 rgb(0 0 0 / 0.25)',
        'subtle': '0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.2)',
        'elevated': '0 4px 12px -1px rgb(0 0 0 / 0.35), 0 2px 6px -2px rgb(0 0 0 / 0.25)',
        'floating': '0 10px 25px -3px rgb(0 0 0 / 0.5), 0 4px 10px -4px rgb(0 0 0 / 0.3)',
        'glow-cyan': '0 0 30px -5px rgba(34, 211, 238, 0.35)',
        'glow-cta': '0 0 30px -5px rgba(124, 58, 237, 0.35)',
        'glow-violet': '0 0 30px -5px rgba(124, 58, 237, 0.35)',
      },
    },
  },
  plugins: [],
};

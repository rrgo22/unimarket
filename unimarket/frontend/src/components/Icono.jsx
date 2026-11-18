import * as Icons from 'lucide-react';

/**
 * Componente Icono para mantener tamaño y trazo consistentes en toda la aplicación.
 * @param {string} name - Nombre del icono en Lucide (ej. 'Search', 'Package', 'Store')
 * @param {number} size - Tamaño en píxeles (default 18)
 * @param {number} strokeWidth - Grosor de trazo (default 2)
 * @param {string} className - Clases adicionales de Tailwind
 */
export default function Icono({
  name,
  size = 18,
  strokeWidth = 2,
  className = '',
  'aria-label': ariaLabel,
  ...props
}) {
  const LucideIcon = Icons[name];

  if (!LucideIcon) {
    return null;
  }

  return (
    <LucideIcon
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={!ariaLabel}
      aria-label={ariaLabel}
      {...props}
    />
  );
}

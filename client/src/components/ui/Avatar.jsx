import { useState } from 'react';

const SIZE_CLASSES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
};

export function Avatar({ src, name = '', size = 'md', className = '' }) {
  const [failed, setFailed] = useState(false);
  const initial = String(name).trim().charAt(0) || 'م';
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className={`${sizeClass} shrink-0 rounded-full border border-line object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-label={name}
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-full bg-navy font-extrabold text-gold ${className}`}
    >
      {initial}
    </span>
  );
}

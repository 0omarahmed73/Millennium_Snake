import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary/secondary use the concept-sheet button art; hot = invisible hit area over baked art. */
  variant?: 'primary' | 'secondary' | 'hot';
  children?: ReactNode;
  style?: CSSProperties;
}

export function GoldButton({ variant = 'secondary', children, onClick, className = '', ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`art-btn art-btn--${variant} ${className}`}
      onClick={(e) => {
        audio.unlock();
        audio.play('click');
        haptic('light');
        onClick?.(e);
      }}
    >
      {children !== undefined && <span className="art-btn__label">{children}</span>}
    </button>
  );
}

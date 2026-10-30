import type { ReactNode } from 'react';
import type { PanelDef } from '../ui/panels';

interface Props {
  panel: PanelDef;
  children?: ReactNode;
  /** Content below the art (tall phones have spare room under the shorter panels). */
  below?: ReactNode;
  /** 'fit' = whole panel visible & centered (full-height screens); 'top' = full width, pinned to top. */
  mode?: 'fit' | 'top';
  className?: string;
}

/** Renders a concept panel at its exact aspect ratio; the rest of the screen is the temple wall. */
export function ArtStage({ panel, children, below, mode = 'fit', className = '' }: Props) {
  return (
    <main className={`screen art-screen art-screen--${mode} ${className}`}>
      <div className="art-backdrop" aria-hidden />
      <div className="art-column">
        <div className="art-stage" style={{ aspectRatio: `${panel.w} / ${panel.h}`, ['--ar' as string]: panel.w / panel.h }}>
          <img className="art-stage__img" src={panel.src} alt="" draggable={false} />
          {children}
        </div>
        {below && <div className="art-below">{below}</div>}
      </div>
    </main>
  );
}

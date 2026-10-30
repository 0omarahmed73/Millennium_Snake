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

/** Renders a concept panel at its exact aspect ratio; blurred mirrored art (fit) or temple wall (top) fills the rest. */
export function ArtStage({ panel, children, below, mode = 'fit', className = '' }: Props) {
  return (
    <main className={`screen art-screen art-screen--${mode} ${className}`}>
      <div className="art-backdrop" style={mode === 'fit' ? { backgroundImage: `url(${panel.src})` } : undefined} aria-hidden />
      <div className="art-column">
        <div className="art-stage" style={{ aspectRatio: `${panel.w} / ${panel.h}`, ['--ar' as string]: panel.w / panel.h }}>
          {mode === 'fit' && (
            // Phones are a bit wider than the art: continue it outward as blurred mirror images,
            // so colours and torchlight reach the screen edges without readable reversed details.
            <>
              <img className="art-mirror art-mirror--left" src={panel.src} alt="" aria-hidden draggable={false} />
              <img className="art-mirror art-mirror--right" src={panel.src} alt="" aria-hidden draggable={false} />
            </>
          )}
          <img className="art-stage__img" src={panel.src} alt="" draggable={false} />
          {children}
        </div>
        {below && <div className="art-below">{below}</div>}
      </div>
    </main>
  );
}

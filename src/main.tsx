import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';
import './styles/global.css';
import { App } from './App';
import { audio } from './services/audio';
import { loadSave } from './services/storage';
import { preloadImages } from './game/rendering/art';
import { ALL_ART } from './ui/panels';

async function boot() {
  const [save] = await Promise.all([loadSave(), preloadImages(ALL_ART), document.fonts?.ready]);
  document.getElementById('splash')?.remove();
  // First touch/click/key anywhere unlocks WebAudio (mobile requirement) and starts the soundtrack.
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });
  document.addEventListener('visibilitychange', () => audio.setBackgrounded(document.hidden));
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App initial={save} />
    </StrictMode>,
  );
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('SW registration failed', e));
    });
  }
}
void boot();

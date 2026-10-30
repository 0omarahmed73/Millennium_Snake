import { useState } from 'react';
import { ArtStage } from '../../components/ArtStage';
import { GoldButton } from '../../components/GoldButton';
import { useApp } from '../../services/AppContext';
import { audio } from '../../services/audio';
import { haptic } from '../../services/haptics';
import { PANELS, SETTINGS as L, at, px, slice } from '../../ui/panels';

const P = PANELS.settings;

function Slider({ value, onChange, rect, label, onRelease }: { value: number; onChange(v: number): void; rect: readonly number[]; label: string; onRelease?(): void }) {
  return (
    <input className="art-slider" type="range" min={0} max={1} step={0.05} value={value} aria-label={label}
      style={{ ...at(P, rect), ['--v' as string]: `${value * 100}%` }}
      onChange={(e) => { audio.unlock(); onChange(+e.target.value); }} onPointerUp={onRelease} />
  );
}

function Toggle({ on, rect, label, onChange }: { on: boolean; rect: readonly number[]; label: string; onChange(v: boolean): void }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className="art-toggle" style={at(P, rect)}
      onClick={() => { audio.unlock(); audio.play('click'); onChange(!on); }}>
      <img src={on ? '/art/toggle-on.webp' : '/art/toggle-off.webp'} alt="" draggable={false} />
    </button>
  );
}

export function Settings() {
  const { save, updateSettings, resetProgress, navigate } = useApp();
  const s = save.settings;
  const [confirm, setConfirm] = useState(false);
  const below = (
    <div className="below-actions">
      <GoldButton onClick={() => navigate('howto')}>How to Play</GoldButton>
      <GoldButton onClick={() => setConfirm(true)}>Reset Progress</GoldButton>
    </div>
  );
  return (
    <ArtStage panel={P} mode="top" below={below} className="settings">
      <button className="art-btn art-btn--hot hit-pad" style={slice(P, L.back)} aria-label="Back" onClick={() => { audio.play('click'); navigate('menu'); }} />
      <Slider label="Music volume" rect={L.music} value={s.music} onChange={(v) => updateSettings({ music: v })} />
      <Slider label="Sound effects volume" rect={L.sfx} value={s.sfx} onChange={(v) => updateSettings({ sfx: v })} onRelease={() => audio.play('eat')} />
      <Toggle label="Haptic feedback" rect={L.toggles[0]} on={s.haptics} onChange={(v) => { updateSettings({ haptics: v }); if (v) setTimeout(() => haptic('medium'), 30); }} />
      <Toggle label="Show FPS" rect={L.toggles[1]} on={s.showFps} onChange={(v) => updateSettings({ showFps: v })} />
      <img className="row-icon" src="/art/icon-dpad.webp" alt="" style={at(P, L.dragIcon)} />
      <span className="row-label" style={{ ...at(P, L.dragLabel), fontSize: px(P, 10.6) }}>Drag to steer</span>
      <Toggle label="Drag to steer" rect={L.toggles[2]} on={s.controls !== 'dpad'} onChange={(v) => updateSettings({ controls: v ? 'both' : 'dpad' })} />
      {confirm && (
        <div className="overlay">
          <div className="art-panel" role="alertdialog" aria-label="Confirm reset">
            <h2>Reset progress?</h2>
            <p>Your best score, stats and unlocked cards will be erased. This cannot be undone.</p>
            <GoldButton variant="primary" onClick={() => { resetProgress(); setConfirm(false); }}>Erase</GoldButton>
            <GoldButton onClick={() => setConfirm(false)}>Cancel</GoldButton>
          </div>
        </div>
      )}
    </ArtStage>
  );
}

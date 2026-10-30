import { ArtStage } from '../../components/ArtStage';
import { GoldButton } from '../../components/GoldButton';
import { MagicBackdrop } from '../../components/MagicBackdrop';
import { audio } from '../../services/audio';
import { useApp } from '../../services/AppContext';
import { MENU, PANELS, at, slice } from '../../ui/panels';

const P = PANELS.menu;

export function MainMenu() {
  const { navigate, save } = useApp();
  const start = () => { audio.unlock(); navigate(save.seenHowTo ? 'game' : 'howto'); };
  return (
    <ArtStage panel={P} className="menu">
      <MagicBackdrop />
      <span className="eye-glow" style={at(P, MENU.dragonEye)} aria-hidden />
      {MENU.torches.map((r, i) => <span key={i} className="torch-glow" style={{ ...at(P, r), animationDelay: `${i * -0.37}s` }} aria-hidden />)}
      <GoldButton variant="hot" className="hot--primary" style={slice(P, MENU.start)} onClick={start} aria-label="Start Duel" />
      <GoldButton variant="hot" style={slice(P, MENU.collection)} onClick={() => navigate('collection')} aria-label="Collection" />
      {save.newCards.length > 0 && (
        <span className="hot-badge" style={{ ...at(P, [250, 630, 274, 650]) }}>{save.newCards.length}</span>
      )}
      <GoldButton variant="hot" style={slice(P, MENU.settings)} onClick={() => navigate('settings')} aria-label="Settings" />
      <GoldButton variant="hot" style={slice(P, MENU.credits)} onClick={() => navigate('credits')} aria-label="Credits" />
    </ArtStage>
  );
}

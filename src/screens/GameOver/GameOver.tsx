import { useEffect, useState } from 'react';
import { ArtStage } from '../../components/ArtStage';
import { GoldButton } from '../../components/GoldButton';
import { cardById, cardImage } from '../../services/cards';
import { useApp } from '../../services/AppContext';
import { audio } from '../../services/audio';
import { OVER, PANELS, at, px, slice } from '../../ui/panels';

const P = PANELS.over;
const KEYS = ['puzzle', 'monsterCard', 'godCard', 'millenniumEye'] as const;

export function GameOver() {
  const { lastRun, save, navigate } = useApp();
  const [toast, setToast] = useState(true);
  useEffect(() => {
    if (lastRun?.unlockedNow.length) audio.play('unlock');
    const t = window.setTimeout(() => setToast(false), 6000);
    return () => clearTimeout(t);
  }, [lastRun]);
  const run = lastRun ?? { score: 0, collected: { puzzle: 0, monsterCard: 0, godCard: 0, millenniumEye: 0, seal: 0 }, newBest: false, unlockedNow: [] as string[], cards: [] as string[] };
  // Every card picked up this duel (owned ones included), newest unlocks marked.
  const fresh = new Set(run.unlockedNow);
  const drawn = [...new Set([...run.unlockedNow, ...run.cards])].map(cardById).filter((c) => !!c);
  return (
    <ArtStage panel={P} className="gameover">
      <span className="eye-glow" style={at(P, OVER.dragonEye)} aria-hidden />
      <div className="parch-num" style={{ ...at(P, OVER.score), fontSize: px(P, 34) }}>{run.score.toLocaleString()}</div>
      <div className="parch-num" style={{ ...at(P, OVER.best), fontSize: px(P, 29) }}>{save.bestScore.toLocaleString()}</div>
      {run.newBest && run.score > 0 && <img className="new-best" src="/art/new-best.webp" alt="New best!" style={at(P, OVER.newBest)} />}
      {KEYS.map((k, i) => (
        <div key={k} className="count-num" style={{ ...at(P, OVER.counts[i]), fontSize: px(P, 15) }}>{run.collected[k]}</div>
      ))}
      <GoldButton variant="hot" className="hot--primary" style={slice(P, OVER.playAgain)} onClick={() => navigate('game')} aria-label="Play Again" />
      <GoldButton variant="hot" style={slice(P, OVER.mainMenu)} onClick={() => navigate('menu')} aria-label="Main Menu" />
      {toast && drawn.length > 0 && (
        <button className="unlock-toast" onClick={() => navigate('collection')} style={{ fontSize: px(P, 12) }}>
          <span className="unlock-toast__cards">
            {drawn.slice(0, 4).map((c) => c && (
              <span key={c.id} className={`unlock-toast__card ${fresh.has(c.id) ? 'is-new' : ''}`}>
                <img src={cardImage(c, true)} alt="" />{fresh.has(c.id) && <i>New</i>}
              </span>
            ))}
          </span>
          <span>
            <small>{fresh.size ? `${fresh.size} new card${fresh.size > 1 ? 's' : ''} unlocked` : 'Cards collected'}</small>
            {drawn.slice(0, 3).map((c) => c?.name).join(', ')}{drawn.length > 3 ? ` +${drawn.length - 3}` : ''}
          </span>
        </button>
      )}
    </ArtStage>
  );
}

import { useEffect, useState } from 'react';
import { ArtStage } from '../../components/ArtStage';
import { GoldButton } from '../../components/GoldButton';
import { CARDS, RARITY_COLOR, cardImage, type CardDef, type CardKind } from '../../services/cards';
import { useApp } from '../../services/AppContext';
import { audio } from '../../services/audio';
import { COLLECTION as L, PANELS, at, px, slice } from '../../ui/panels';

const P = PANELS.collection;
const PER_PAGE = 12;
const TABS: { id: 'all' | CardKind; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'monsters', label: 'Monsters' }, { id: 'spells', label: 'Spells' }, { id: 'traps', label: 'Traps' },
];

export function Collection() {
  const { save, clearNewCards, navigate } = useApp();
  const [tab, setTab] = useState<'all' | CardKind>('all');
  const [open, setOpen] = useState<CardDef | null>(null);
  const [page, setPage] = useState(0);
  const [newOnEntry] = useState(() => new Set(save.newCards));
  useEffect(() => { if (save.newCards.length) clearNewCards(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = CARDS.filter((c) => tab === 'all' || c.kind === tab);
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const cards = filtered.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const turn = (d: number) => { audio.play('click'); setPage((p) => (p + d + pages) % pages); };
  const isOpen = (c: CardDef) => save.unlockedCards.includes(c.id);
  const have = CARDS.filter(isOpen).length;

  const below = (
    <div className="progress-box">
      <div className="progress-box__row"><span>Collection progress</span><b>{have} / {CARDS.length}</b></div>
      <div className="progress-box__bar"><i style={{ width: `${(have / CARDS.length) * 100}%` }} /></div>
      <p>Monster Cards you collect in the temple draw new cards for your deck.</p>
      <div className="pager">
        <GoldButton onClick={() => turn(-1)} aria-label="Previous page" disabled={pages < 2}>‹</GoldButton>
        <span className="pager__label">Page <b>{page + 1}</b> / {pages}</span>
        <GoldButton onClick={() => turn(1)} aria-label="Next page" disabled={pages < 2}>›</GoldButton>
      </div>
    </div>
  );

  return (
    <ArtStage panel={P} mode="top" below={below} className="collection">
      <button className="art-btn art-btn--hot hit-pad" style={slice(P, L.back)} aria-label="Back" onClick={() => { audio.play('click'); navigate('menu'); }} />
      {TABS.map((t, i) => (
        <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'is-on' : ''}`}
          style={{ ...at(P, L.tabs[i]), fontSize: px(P, t.label.length > 8 ? 9.6 : 10.5) }}
          onClick={() => { audio.play('click'); setTab(t.id); setPage(0); }}>
          {t.label}
        </button>
      ))}
      {Array.from({ length: 12 }, (_, i) => {
        const r = L.rows[Math.floor(i / 4)], c = L.cols[i % 4];
        const rect = [c[0], r[0], c[1], r[1]];
        const card = cards[i];
        if (!card) return <span key={`empty-${i}`} className="card-slot" style={at(P, rect)} aria-hidden />;
        return (
          <button key={card.id} className={`card-cell ${newOnEntry.has(card.id) ? 'is-new' : ''}`} style={at(P, rect)}
            aria-label={isOpen(card) ? card.name : 'Locked card'} onClick={() => { audio.play('click'); setOpen(card); }}>
            <img src={cardImage(card, isOpen(card))} alt="" draggable={false} />
          </button>
        );
      })}
      {open && (
        <div className="overlay" onClick={() => setOpen(null)}>
          <div className="art-panel detail" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={isOpen(open) ? open.name : 'Locked card'}>
            <img className="detail__card" src={cardImage(open, isOpen(open))} alt="" />
            <h3>{isOpen(open) ? open.name : 'Sealed Card'}</h3>
            <span className="rarity" style={{ color: RARITY_COLOR[open.rarity] }}>{open.rarity} · {open.typeLabel}</span>
            {!isOpen(open) && <p>This card is still sealed inside the temple.</p>}
            <p className="req">{isOpen(open) ? 'Unlocked' : `Unlock: ${open.requirement}`}</p>
            <GoldButton onClick={() => setOpen(null)}>Close</GoldButton>
          </div>
        </div>
      )}
    </ArtStage>
  );
}

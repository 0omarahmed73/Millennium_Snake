import { ArtStage } from '../components/ArtStage';
import { GoldButton } from '../components/GoldButton';
import { useApp } from '../services/AppContext';
import { audio } from '../services/audio';
import { HOWTO as L, PANELS, at, px, slice } from '../ui/panels';

const P = PANELS.howto;
const AUTHOR_LINKS = [
  { label: 'GitHub', text: 'github.com/0omarahmed73', href: 'https://github.com/0omarahmed73' },
  { label: 'LinkedIn', text: 'in/0omarahmed73', href: 'https://linkedin.com/in/0omarahmed73' },
  { label: 'Website', text: 'omarasaeed.dev', href: 'https://www.omarasaeed.dev/' },
];

const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export function HowToPlay() {
  const { navigate, markHowToSeen, save } = useApp();
  const done = () => { markHowToSeen(); navigate(save.seenHowTo ? 'menu' : 'game'); };
  return (
    <ArtStage panel={P} mode="top" className="howto">
      <button className="art-btn art-btn--hot hit-pad" style={slice(P, L.back)} aria-label="Back" onClick={() => { audio.play('click'); navigate('menu'); }} />
      <p className="body-text" style={{ ...at(P, L.controlText), fontSize: px(P, 10.2) }}>
        {touch ? 'Drag anywhere on the screen, or tap the arrow pad, to steer the dragon.' : 'Use the arrow keys or WASD to steer the dragon. Space pauses.'}
      </p>
      <p className="body-text" style={{ ...at(P, L.avoidText), fontSize: px(P, 10.2) }}>
        Don&apos;t hit pillars or your own body.
      </p>
      <GoldButton variant="hot" className="hot--primary" style={slice(P, L.gotIt)} onClick={done} aria-label="Got it" />
    </ArtStage>
  );
}

export function Credits() {
  const { navigate } = useApp();
  const back = { ...slice(PANELS.settings, [18, 10, 49, 41]), position: 'relative' as const, left: 'auto', top: 'auto', width: 44, height: 44, flex: 'none' };
  return (
    <main className="screen art-screen art-screen--top credits">
      <div className="art-backdrop" aria-hidden />
      <div className="credits-frame">
        <header className="credits-head">
          <button className="art-btn art-btn--hot" style={back} aria-label="Back" onClick={() => { audio.play('click'); navigate('menu'); }} />
          <h2>Credits</h2>
          <span style={{ width: 44 }} />
        </header>
        <div className="credits-body">
          <section className="author">
            <small>Created by</small>
            <h3>Omar A. Saeed</h3>
            <p className="author__role">Full Stack Web Developer</p>
            <nav className="author__links" aria-label="Omar A. Saeed online">
              {AUTHOR_LINKS.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" onClick={() => audio.play('click')}>
                  <span>{l.label}</span><em>{l.text}</em>
                </a>
              ))}
            </nav>
          </section>
          <img className="credits-puzzle" src="/art/puzzle.webp" alt="" />
          <p>A fan-made gift inspired by the Duel Monsters anime and Ancient Egyptian mythology. Not affiliated with or endorsed by any rights holder.</p>
          <p className="muted">Typefaces: Cinzel and Source Sans 3 (SIL Open Font License). Sound and music are procedurally generated.</p>
          <p className="muted">Millennium Snake · Version 1.0.0</p>
        </div>
      </div>
    </main>
  );
}

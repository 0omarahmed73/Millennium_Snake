import { useCallback, useEffect, useRef, useState } from 'react';
import { GameSession } from '../../game/GameSession';
import { loadGameArt } from '../../game/rendering/art';
import { ArtStage } from '../../components/ArtStage';
import { GoldButton } from '../../components/GoldButton';
import { useApp } from '../../services/AppContext';
import { audio } from '../../services/audio';
import type { Direction } from '../../game/engine/types';
import { DEFAULT_CONFIG } from '../../game/engine/config';
import { GAME, PANELS, at, px, slice } from '../../ui/panels';
import { CARD_POOLS, cardById } from '../../services/cards';

const P = PANELS.game;
/** Dev only (?demo): poses a long dragon and every collectible, like the concept shot, for visual QA. */
function stageDemo(session: GameSession): void {
  const e = session.engine;
  const path: [number, number][] = [[5, 8], [5, 9], [5, 10], [5, 11], [6, 11], [6, 12], [6, 13], [6, 14], [5, 14], [5, 15], [5, 16], [5, 17], [4, 17], [4, 18]];
  e.segments = path.map(([x, y]) => ({ x, y }));
  e.prevSegments = e.segments.map((s) => ({ ...s }));
  e.obstacles = [{ x: 1, y: 4 }, { x: 7, y: 3 }, { x: 2, y: 13 }];
  e.items = [
    { id: 901, type: 'puzzle', pos: { x: 4, y: 6 }, ttl: null, ttlMax: null },
    { id: 902, type: 'monsterCard', pos: { x: 2, y: 8 }, ttl: 50, ttlMax: 60 },
    { id: 903, type: 'godCard', pos: { x: 7, y: 16 }, ttl: 30, ttlMax: 40 },
    { id: 904, type: 'millenniumEye', pos: { x: 2, y: 2 }, ttl: 60, ttlMax: 70 },
  ];
}

const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export function GameScreen() {
  const { save, recordRun, navigate } = useApp();
  const stageRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const [score, setScore] = useState(0);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const [ability, setAbility] = useState({ charges: 0, active: 0 });
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const touch = isTouch();
  const dragOn = save.settings.controls !== 'dpad';
  const recordRef = useRef(recordRun); recordRef.current = recordRun;
  const ownedRef = useRef(save.unlockedCards); ownedRef.current = save.unlockedCards;
  const navRef = useRef(navigate); navRef.current = navigate;

  useEffect(() => {
    let cancelled = false;
    let session: GameSession | null = null;
    let ro: ResizeObserver | null = null;
    const floor = floorRef.current as HTMLDivElement;
    const canvas = canvasRef.current as HTMLCanvasElement;
    // Drag-to-steer listens on the whole screen; D-pad only = buttons only.
    const gestureTarget = (dragOn ? stageRef.current?.closest('.screen') : floor) as HTMLElement;
    (async () => {
      try {
        const art = await loadGameArt();
        if (cancelled) return;
        session = new GameSession(canvas, gestureTarget, art, {
          onScore: setScore,
          onAbility: (charges, active) => setAbility({ charges, active }),
          onPauseChange: setPaused,
          onFirstMove: () => setStarted(true),
          onFps: setFps,
          onDeath: (stats) => { recordRef.current(stats); navRef.current('gameover'); },
        }, {
          pools: CARD_POOLS,
          owns: (id) => ownedRef.current.includes(id),
          name: (id) => cardById(id)?.name ?? id,
        });
        sessionRef.current = session;
        if (import.meta.env.DEV) {
          (window as unknown as { __ms?: GameSession }).__ms = session;
          if (location.search.includes('demo')) stageDemo(session);
        }
        const fit = () => session?.resize(floor.clientWidth, floor.clientHeight);
        fit();
        session.start();
        ro = new ResizeObserver(fit);
        ro.observe(floor);
      } catch (e) {
        console.error(e);
        setError('Could not load the temple. Check your connection and try again.');
      }
    })();
    return () => { cancelled = true; ro?.disconnect(); session?.destroy(); sessionRef.current = null; };
  }, [dragOn]);

  const dir = useCallback((d: Direction) => { audio.unlock(); sessionRef.current?.turn(d); }, []);
  const activePct = ability.active > 0 ? (ability.active / DEFAULT_CONFIG.abilityTicks) * 100 : 0;
  const [dx0, dy0, dx1, dy1] = GAME.dpad;
  const mx = (dx0 + dx1) / 2, my = (dy0 + dy1) / 2, q = (dx1 - dx0) / 3;
  const pads: [Direction, number[]][] = [
    ['up', [mx - q / 2, dy0, mx + q / 2, my - q / 2]],
    ['down', [mx - q / 2, my + q / 2, mx + q / 2, dy1]],
    ['left', [dx0, my - q / 2, mx - q / 2, my + q / 2]],
    ['right', [mx + q / 2, my - q / 2, dx1, my + q / 2]],
  ];

  return (
    <ArtStage panel={P} className="game">
      <div ref={stageRef} className="stage-fill">
        <div className="hud-num hud-num--score" style={{ ...at(P, GAME.scoreText), fontSize: px(P, 29) }}>{score.toLocaleString()}</div>
        <div className="hud-num hud-num--best" style={{ ...at(P, GAME.bestText), fontSize: px(P, score > 9999 || save.bestScore > 9999 ? 22 : 26) }}>
          {Math.max(save.bestScore, score).toLocaleString()}
        </div>
        {save.settings.showFps && fps > 0 && <div className="fps" style={{ ...at(P, [120, 52, 230, 66]), fontSize: px(P, 10) }}>{fps} FPS</div>}
        <button className="art-btn art-btn--hot" style={slice(P, GAME.pause)} aria-label="Pause" onClick={() => sessionRef.current?.togglePause()} />

        <div className="floor" ref={floorRef} style={at(P, GAME.floor)}>
          <canvas ref={canvasRef} className="board" />
          {!started && !error && (
            <div className="hint" style={{ fontSize: px(P, 13) }} aria-live="polite">
              <div className="hint__swipe" aria-hidden />
              <p>{touch ? (dragOn ? 'Drag anywhere to steer' : 'Tap the arrows to steer') : 'Press an arrow key'}</p>
              <small>{touch ? 'The duel begins with your first move' : 'WASD works too · Space pauses · E uses Spirit Form'}</small>
            </div>
          )}
          {error && <div className="hint" style={{ fontSize: px(P, 13) }}><p>{error}</p></div>}
        </div>

        {pads.map(([d, r]) => (
          <button key={d} className="art-btn art-btn--hot dpad-zone" style={at(P, r)} aria-label={`Move ${d}`}
            onPointerDown={(e) => { e.preventDefault(); dir(d); }} />
        ))}
        <button
          className={`art-btn art-btn--hot ability-zone ${ability.charges > 0 ? 'is-ready' : ''} ${ability.active > 0 ? 'is-active' : ''}`}
          style={{ ...slice(P, GAME.ability), ['--pct' as string]: `${activePct}%` }}
          aria-label={`Spirit form, ${ability.charges} charges`}
          onPointerDown={(e) => { e.preventDefault(); sessionRef.current?.useAbility(); }}
        />
        <span className={`ability-ring ${ability.active > 0 ? 'is-active' : ''}`} style={{ ...at(P, GAME.abilityRing), ['--pct' as string]: `${activePct}%` }} aria-hidden />
        <span className="ability-count" style={{ ...at(P, GAME.abilityCount), fontSize: px(P, 19) }} aria-hidden>{ability.charges}</span>
      </div>

      {paused && (
        <div className="overlay" role="dialog" aria-label="Paused">
          <div className="art-panel">
            <h2>Paused</h2>
            <GoldButton variant="primary" onClick={() => sessionRef.current?.setPaused(false)}>Resume</GoldButton>
            <GoldButton onClick={() => { sessionRef.current?.restart(); setStarted(false); }}>Restart</GoldButton>
            <GoldButton onClick={() => navigate('menu')}>Main Menu</GoldButton>
          </div>
        </div>
      )}
    </ArtStage>
  );
}

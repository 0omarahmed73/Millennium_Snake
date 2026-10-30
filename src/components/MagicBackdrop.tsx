import { useEffect, useRef } from 'react';

/** Animated menu background: drifting blue/gold embers + occasional lightning arcs. Cheap, one canvas. */
export function MagicBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    let w = 0, h = 0, raf = 0, last = performance.now(), bolt = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const embers = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 1.6, v: 0.01 + Math.random() * 0.04, gold: Math.random() > 0.45, ph: Math.random() * 6 }));
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    let boltPts: [number, number][] = [];
    const newBolt = () => {
      let x = Math.random() * w, y = 0;
      boltPts = [[x, y]];
      while (y < h * 0.55) { x += (Math.random() - 0.5) * 50; y += 20 + Math.random() * 30; boltPts.push([x, y]); }
      bolt = 1;
    };
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const e of embers) {
        e.y -= e.v * dt * 3; if (e.y < -0.05) { e.y = 1.05; e.x = Math.random(); }
        const a = 0.35 + 0.35 * Math.sin(now / 700 + e.ph);
        ctx.fillStyle = e.gold ? `rgba(243,210,122,${a})` : `rgba(127,196,255,${a})`;
        ctx.beginPath(); ctx.arc(e.x * w + Math.sin(now / 1500 + e.ph) * 8, e.y * h, e.s * 1.6, 0, 6.3); ctx.fill();
      }
      if (bolt > 0) {
        ctx.strokeStyle = `rgba(150,210,255,${bolt})`; ctx.lineWidth = 2; ctx.beginPath();
        boltPts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        bolt -= dt * 2.5;
      } else if (Math.random() < dt * 0.25) newBolt();
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="magic-backdrop" aria-hidden />;
}

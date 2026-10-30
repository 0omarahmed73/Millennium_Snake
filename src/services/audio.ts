/**
 * WebAudio service. Sound effects are synthesised; background music is the
 * looping track in public/audio/music.mp3 (decoded once, gain-controlled).
 */
const MUSIC_URL = '/audio/music.mp3';
export type Sfx = 'click' | 'eat' | 'bonus' | 'god' | 'eye' | 'ability' | 'levelUp' | 'die' | 'pause' | 'unlock';

class AudioService {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private musicVol = 0.5;
  private sfxVol = 0.8;
  private musicOn = false;
  private musicBuffer: Promise<AudioBuffer | null> | null = null;
  private musicSource: AudioBufferSourceNode | null = null;

  setVolumes(music: number, sfx: number): void {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (this.ctx) {
      this.musicGain.gain.value = music * 0.6;
      this.sfxGain.gain.value = sfx;
    }
  }

  /** Must be called from a user gesture (iOS Safari requirement). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.connect(this.master);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.connect(this.master);
        this.setVolumes(this.musicVol, this.sfxVol);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      this.startMusic();
    } catch { /* audio unsupported */ }
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, slideTo?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  play(name: Sfx): void {
    if (!this.ctx || this.sfxVol <= 0) return;
    const t = this.ctx.currentTime;
    const d = this.sfxGain;
    switch (name) {
      case 'click': this.tone(520, t, 0.07, 'triangle', 0.25, d); break;
      case 'pause': this.tone(330, t, 0.1, 'triangle', 0.25, d, 220); break;
      case 'eat':
        this.tone(660, t, 0.09, 'triangle', 0.3, d);
        this.tone(990, t + 0.06, 0.12, 'sine', 0.25, d);
        break;
      case 'bonus':
        [660, 830, 990, 1320].forEach((f, i) => this.tone(f, t + i * 0.06, 0.14, 'triangle', 0.28, d));
        break;
      case 'god':
        [330, 440, 660, 880, 1320].forEach((f, i) => this.tone(f, t + i * 0.07, 0.35, 'sawtooth', 0.14, d));
        break;
      case 'eye': this.tone(440, t, 0.4, 'sine', 0.3, d, 1320); break;
      case 'ability': this.tone(220, t, 0.6, 'sawtooth', 0.2, d, 880); this.tone(330, t, 0.6, 'sine', 0.25, d, 1320); break;
      case 'levelUp': [523, 659, 784].forEach((f, i) => this.tone(f, t + i * 0.08, 0.16, 'square', 0.12, d)); break;
      case 'unlock': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, t + i * 0.09, 0.3, 'triangle', 0.25, d)); break;
      case 'die':
        this.tone(300, t, 0.6, 'sawtooth', 0.28, d, 50);
        this.tone(150, t, 0.7, 'square', 0.18, d, 40);
        break;
    }
  }

  private loadMusic(): Promise<AudioBuffer | null> {
    if (!this.musicBuffer) {
      const ctx = this.ctx as AudioContext;
      this.musicBuffer = fetch(MUSIC_URL)
        .then((r) => { if (!r.ok) throw new Error(`music ${r.status}`); return r.arrayBuffer(); })
        .then((data) => new Promise<AudioBuffer>((resolve, reject) => ctx.decodeAudioData(data, resolve, reject)))
        .catch((err) => { console.warn('Music unavailable', err); this.musicBuffer = null; return null; });
    }
    return this.musicBuffer;
  }

  /** Starts the looping soundtrack (idempotent). Needs unlock() from a user gesture first. */
  startMusic(): void {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    void this.loadMusic().then((buf) => {
      const ctx = this.ctx;
      if (!buf || !ctx || !this.musicOn || this.musicSource) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(this.musicGain);
      // short fade-in so the loop never starts with a click
      const now = ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(0.0001, now);
      this.musicGain.gain.linearRampToValueAtTime(this.musicVol * 0.6, now + 1.2);
      src.start();
      this.musicSource = src;
    });
  }

  stopMusic(): void {
    this.musicOn = false;
    try { this.musicSource?.stop(); } catch { /* already stopped */ }
    this.musicSource?.disconnect();
    this.musicSource = null;
  }

  /** Suspend everything while the app is in the background (phone lock, app switch). */
  setBackgrounded(hidden: boolean): void {
    if (!this.ctx) return;
    void (hidden ? this.ctx.suspend() : this.ctx.resume());
  }
}

export const audio = new AudioService();

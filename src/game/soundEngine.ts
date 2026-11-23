import type { FighterId } from '../shared/gameData.ts';
import { AWAKENING_CONFIG } from '../shared/awakeningConfig.ts';

export type SoundKind =
  | 'hit'
  | 'heavy'
  | 'parry'
  | 'evade'
  | 'trap'
  | 'trapTrigger'
  | 'block'
  | 'grab'
  | 'whiff'
  | 'stun'
  | 'clash'
  | 'overdrive'
  | 'comboLink'
  | 'hazard'
  | 'dash'
  | 'jump'
  | 'pickup'
  | 'gunshot'
  | 'whoosh'
  | 'shockwave'
  | 'beam'
  | 'ko'
  | 'tick'
  | 'victory'
  | 'uiClick'
  | 'uiSelect'
  | 'transitionWhoosh'
  | 'fightHorn'
  | 'chatPop'
  | 'grabMash'
  | 'loginSuccess'
  | 'lockedError'
  | 'orbSpawnRumble'
  | 'orbPickupChime'
  | 'awakeningTransform'
  | 'clashBoom'
  | 'mashTick'
  | 'knockbackImpact'
  | 'thunderStrike'
  | 'railgunShot'
  | 'silence'
  | 'domainExpand'
  | 'domainClash'
  | 'jackpot';

export type BgmMode = 'none' | 'lobby' | 'combat';

class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;
  public bgmMuted = false;
  private sfxDuckMult = 1.0;

  // Background music synthesizer state
  private bgmMode: BgmMode = 'none';
  private bgmActiveMode: BgmMode = 'none';
  private bgmMasterGain: GainNode | null = null;
  private bgmTimer: ReturnType<typeof setInterval> | null = null;
  private bgmNextNoteTime = 0;
  private bgmStep = 0;
  private bgmListeners = new Set<() => void>();
  private bgmVisibilityHooked = false;

  constructor() {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        this.bgmMuted = localStorage.getItem('koopal_bgm_muted_v1') === '1';
      }
    } catch {
      // ignore storage errors
    }
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public setDucking(ducked: boolean): void {
    this.sfxDuckMult = ducked ? 0.34 : 1.0;
    this.syncBgmGain();
  }

  public subscribeBgm(listener: () => void): () => void {
    this.bgmListeners.add(listener);
    return () => {
      this.bgmListeners.delete(listener);
    };
  }

  private notifyBgmListeners(): void {
    for (const fn of this.bgmListeners) fn();
  }

  public getBgmMode(): BgmMode {
    return this.bgmMode;
  }

  private isBgmAudible(): boolean {
    if (this.muted || this.bgmMuted || this.bgmMode === 'none') return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    return true;
  }

  private syncBgmGain(): void {
    if (!this.ctx || !this.bgmMasterGain) return;
    const now = this.ctx.currentTime;
    const baseVol = this.bgmMode === 'combat' ? 0.19 : 0.22;
    const ducked = this.sfxDuckMult < 0.9 ? 0.14 : 1.0;
    const target = this.isBgmAudible() ? baseVol * ducked : 0;
    this.bgmMasterGain.gain.cancelScheduledValues(now);
    this.bgmMasterGain.gain.setTargetAtTime(target, now, 0.08);
  }

  public unlock(): void {
    try {
      if (typeof window === 'undefined') return;
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume().then(() => {
          this.ensureBgmRunning();
        });
      }
      if (!this.bgmVisibilityHooked && typeof document !== 'undefined') {
        this.bgmVisibilityHooked = true;
        document.addEventListener('visibilitychange', () => {
          this.syncBgmGain();
          if (!document.hidden && this.ctx && this.ctx.state === 'running') {
            this.bgmNextNoteTime = Math.max(this.bgmNextNoteTime, this.ctx.currentTime + 0.05);
          }
        });
      }
      this.ensureBgmRunning();
    } catch {
      // AudioContext unavailable
    }
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    janeCutsceneAudio.setMuted(this.muted);
    this.syncBgmGain();
    this.notifyBgmListeners();
    return this.muted;
  }

  public toggleBgmMute(): boolean {
    this.bgmMuted = !this.bgmMuted;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('koopal_bgm_muted_v1', this.bgmMuted ? '1' : '0');
      }
    } catch {
      // ignore storage errors
    }
    if (!this.bgmMuted) {
      this.unlock();
    }
    this.syncBgmGain();
    this.notifyBgmListeners();
    return this.bgmMuted;
  }

  public startBgm(mode: 'lobby' | 'combat'): void {
    const modeChanged = this.bgmMode !== mode;
    this.bgmMode = mode;
    if (modeChanged) {
      this.bgmStep = 0;
      if (this.ctx) {
        this.bgmNextNoteTime = this.ctx.currentTime + 0.06;
      }
    }
    this.ensureBgmRunning();
    this.syncBgmGain();
  }

  public stopBgm(): void {
    this.bgmMode = 'none';
    this.bgmActiveMode = 'none';
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.syncBgmGain();
  }

  private ensureBgmRunning(): void {
    const ctx = this.ctx;
    if (!ctx || this.bgmMode === 'none') return;
    if (!this.bgmMasterGain) {
      const master = ctx.createGain();
      const warmth = ctx.createBiquadFilter();
      warmth.type = 'lowpass';
      warmth.frequency.value = 5200;
      warmth.Q.value = 0.65;
      master.gain.value = 0;
      master.connect(warmth);
      warmth.connect(ctx.destination);
      this.bgmMasterGain = master;
    }
    if (this.bgmActiveMode !== this.bgmMode) {
      this.bgmActiveMode = this.bgmMode;
      this.bgmStep = 0;
      this.bgmNextNoteTime = ctx.currentTime + 0.06;
    }
    if (this.bgmTimer === null) {
      this.bgmNextNoteTime = Math.max(this.bgmNextNoteTime, ctx.currentTime + 0.05);
      this.bgmTimer = setInterval(() => {
        this.scheduleBgmTick();
      }, 28);
    }
    this.syncBgmGain();
  }

  private scheduleBgmTick(): void {
    const ctx = this.ctx;
    if (!ctx || !this.bgmMasterGain || this.bgmMode === 'none') return;
    if (ctx.state !== 'running' || !this.isBgmAudible()) {
      this.bgmNextNoteTime = ctx.currentTime + 0.06;
      return;
    }

    const bpm = this.bgmMode === 'combat' ? 132 : 116;
    const stepDur = 60 / bpm / 4; // 16th note

    // Prevent runaway catch-up if tab was backgrounded
    if (this.bgmNextNoteTime < ctx.currentTime - 0.25) {
      this.bgmNextNoteTime = ctx.currentTime + 0.04;
    }

    while (this.bgmNextNoteTime < ctx.currentTime + 0.14) {
      if (this.bgmMode === 'combat') {
        this.scheduleCombatStep(this.bgmStep, this.bgmNextNoteTime, stepDur);
      } else {
        this.scheduleLobbyStep(this.bgmStep, this.bgmNextNoteTime, stepDur);
      }
      this.bgmNextNoteTime += stepDur;
      this.bgmStep = (this.bgmStep + 1) % 128; // 8-bar loop
    }
  }

  private bgmKick(t: number, punch = 0.52): void {
    const ctx = this.ctx;
    const out = this.bgmMasterGain;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(132, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.09);
    g.gain.setValueAtTime(punch, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  private bgmSnare(t: number, level = 0.22): void {
    const ctx = this.ctx;
    const out = this.bgmMasterGain;
    if (!ctx || !out) return;
    // Crisp body tone
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(215, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.06);
    og.gain.setValueAtTime(level * 0.65, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(og);
    og.connect(out);
    osc.start(t);
    osc.stop(t + 0.09);

    // Filtered noise snap
    const len = Math.max(1, Math.floor(ctx.sampleRate * 0.075));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.42));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1600;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(level * 0.75, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    src.connect(hp);
    hp.connect(ng);
    ng.connect(out);
    src.start(t);
    src.stop(t + 0.08);
  }

  private bgmHat(t: number, open = false, level = 0.1): void {
    const ctx = this.ctx;
    const out = this.bgmMasterGain;
    if (!ctx || !out) return;
    const dur = open ? 0.09 : 0.032;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.35));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(hp);
    hp.connect(g);
    g.connect(out);
    src.start(t);
    src.stop(t + dur + 0.01);
  }

  private bgmTone(
    freq: number,
    t: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    cutoff = 3200
  ): void {
    const ctx = this.ctx;
    const out = this.bgmMasterGain;
    if (!ctx || !out || freq <= 0) return;
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(500, cutoff * 0.45), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private scheduleLobbyStep(step: number, t: number, stepDur: number): void {
    // Catchy 8-bar (128 16th-steps) arcade groove in F Major / D Minor (116 BPM)
    const bar = Math.floor(step / 16); // 0..7
    const s = step % 16;

    // Warm 4-chord progression looped across 8 bars: Fmaj7 -> G6 -> Em7 -> Am9
    const chordProgression: Array<{ bass: number; rootBassHi: number; chord: number[] }> = [
      { bass: 87.31, rootBassHi: 174.61, chord: [261.63, 329.63, 440.0] }, // Fmaj7
      { bass: 98.0, rootBassHi: 196.0, chord: [293.66, 392.0, 493.88] },   // G6
      { bass: 82.41, rootBassHi: 164.81, chord: [246.94, 329.63, 392.0] }, // Em7
      { bass: 110.0, rootBassHi: 220.0, chord: [261.63, 329.63, 493.88] }, // Am9
    ];
    const harmonic = chordProgression[bar % 4];

    // Drums: crisp groove
    if (s === 0 || s === 6 || s === 10 || (bar % 2 === 1 && s === 14)) {
      this.bgmKick(t, 0.48);
    }
    if (s === 4 || s === 12) {
      this.bgmSnare(t, 0.2);
    }
    if (s % 2 === 0) {
      this.bgmHat(t, s === 14 && bar % 2 === 0, s % 4 === 2 ? 0.11 : 0.055);
    }

    // Syncopated warm octave bass
    if (s === 0 || s === 6 || s === 10) {
      this.bgmTone(harmonic.bass, t, stepDur * 2.4, 'triangle', 0.34, 900);
    } else if (s === 3 || s === 8 || s === 14) {
      this.bgmTone(harmonic.rootBassHi, t, stepDur * 1.4, 'triangle', 0.22, 1200);
    }

    // Electric piano warm stabs on downbeat + upbeat bounce
    if (s === 0 || s === 6 || s === 11) {
      const stabDur = s === 0 ? stepDur * 3.8 : stepDur * 2.1;
      const stabVol = s === 0 ? 0.11 : 0.075;
      for (const freq of harmonic.chord) {
        this.bgmTone(freq, t, stabDur, 'sine', stabVol, 2400);
      }
    }

    // Catchy bright bell/pluck hook (16 eighth-note slots across 2-bar phrases)
    // A = 440, C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880
    const hookA: Record<number, number> = {
      0: 659.25, 2: 783.99, 4: 880.0, 7: 783.99, 10: 659.25, 12: 587.33, 14: 523.25,
    };
    const hookB: Record<number, number> = {
      0: 587.33, 3: 659.25, 6: 783.99, 10: 880.0, 12: 1046.5, 14: 880.0,
    };
    const hookC: Record<number, number> = {
      0: 783.99, 2: 659.25, 4: 587.33, 6: 523.25, 8: 587.33, 11: 659.25, 14: 523.25,
    };
    const hookD: Record<number, number> = {
      0: 440.0, 2: 523.25, 4: 659.25, 8: 587.33, 12: 523.25, 14: 440.0,
    };
    const phrase = bar % 4 === 0 ? hookA : bar % 4 === 1 ? hookB : bar % 4 === 2 ? hookC : hookD;
    const note = phrase[s];
    if (note) {
      // Vary upper sparkle slightly on bars 4..7
      const freq = bar >= 4 && s === 12 ? note * 1.12246 : note;
      this.bgmTone(freq, t, stepDur * 2.2, 'triangle', 0.145, 3600);
      this.bgmTone(freq * 2, t, stepDur * 1.1, 'sine', 0.045, 4200);
    }
  }

  private scheduleCombatStep(step: number, t: number, stepDur: number): void {
    // High-energy anime action groove in E Minor (132 BPM)
    const bar = Math.floor(step / 16);
    const s = step % 16;

    const prog = [
      { bass: 82.41, chord: [329.63, 392.0, 493.88] },  // Em7
      { bass: 65.41, chord: [261.63, 329.63, 493.88] }, // Cmaj7
      { bass: 73.42, chord: [293.66, 369.99, 440.0] },  // D
      { bass: 61.74, chord: [246.94, 329.63, 440.0] },  // Bm7/sus
    ];
    const h = prog[bar % 4];

    // Driving 4-on-floor / breakbeat punch
    if (s === 0 || s === 6 || s === 8 || (bar % 2 === 1 && s === 14)) {
      this.bgmKick(t, 0.52);
    }
    if (s === 4 || s === 12) {
      this.bgmSnare(t, 0.24);
    }
    if (s % 2 === 0 || (bar >= 4 && s % 2 === 1)) {
      this.bgmHat(t, s === 10 && bar % 2 === 0, s % 4 === 2 ? 0.11 : 0.05);
    }

    // Driving 8th-note synth bass
    if (s % 2 === 0) {
      const oct = s % 4 === 2 ? h.bass * 2 : h.bass;
      this.bgmTone(oct, t, stepDur * 1.5, 'sawtooth', 0.19, 1050);
    }

    // Power pad rhythm
    if (s === 0 || s === 6 || s === 12) {
      for (const c of h.chord) {
        this.bgmTone(c, t, stepDur * 2.2, 'triangle', 0.08, 2200);
      }
    }

    // Energetic lead riff
    const combatLeadA: Record<number, number> = {
      0: 659.25, 2: 783.99, 4: 987.77, 6: 880.0, 8: 783.99, 10: 659.25, 12: 739.99, 14: 783.99,
    };
    const combatLeadB: Record<number, number> = {
      0: 987.77, 3: 880.0, 6: 783.99, 8: 659.25, 10: 587.33, 12: 659.25,
    };
    const riff = bar % 2 === 0 ? combatLeadA : combatLeadB;
    const leadFreq = riff[s];
    if (leadFreq) {
      this.bgmTone(leadFreq, t, stepDur * 1.9, 'sawtooth', 0.085, 2900);
      this.bgmTone(leadFreq, t, stepDur * 2.0, 'triangle', 0.085, 3400);
    }
  }

  private jitter(freq: number): number {
    return freq * (0.92 + Math.random() * 0.16);
  }

  public playCountdownTick(step: number): void {
    if (this.muted) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    const pitches: Record<number, number> = {
      5: 440,
      4: 493.88,
      3: 554.37,
      2: 622.25,
      1: 739.99,
    };
    const freq = pitches[step] ?? 520;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    sub.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.06, now + 0.12);
    sub.frequency.setValueAtTime(freq * 0.5, now);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    sub.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    sub.start(now);
    osc.stop(now + 0.2);
    sub.stop(now + 0.2);
  }

  public playFighterHit(fighterId: FighterId | undefined, isCrit: boolean): void {
    if (this.muted) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (fighterId === 'damen') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(this.jitter(isCrit ? 880 : 680), now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.11);
      gain.gain.setValueAtTime(isCrit ? 0.24 : 0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.13);
      return;
    }

    if (fighterId === 'marjohn') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(this.jitter(isCrit ? 620 : 480), now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.16);
      gain.gain.setValueAtTime(isCrit ? 0.22 : 0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.18);
      return;
    }

    if (fighterId === 'prime') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(this.jitter(isCrit ? 150 : 190), now);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.22);
      gain.gain.setValueAtTime(isCrit ? 0.32 : 0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.25);
      return;
    }

    if (fighterId === 'khen') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(this.jitter(isCrit ? 1120 : 860), now);
      osc.frequency.exponentialRampToValueAtTime(190, now + 0.1);
      gain.gain.setValueAtTime(isCrit ? 0.21 : 0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.12);
      return;
    }

    // JM / default crisp martial strike
    this.play(isCrit ? 'heavy' : 'hit');
  }

  public play(kind: SoundKind): void {
    if (this.muted) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const masterDuck = ctx.createGain();
    masterDuck.gain.setValueAtTime(this.sfxDuckMult, now);
    gain.connect(masterDuck);
    masterDuck.connect(ctx.destination);

    if (kind === 'uiClick') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(760, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.045);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.06);
      return;
    }

    if (kind === 'uiSelect') {
      [587.33, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.035);
        g.gain.setValueAtTime(0.11, now + idx * 0.035);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.11);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + idx * 0.035);
        osc.stop(now + idx * 0.035 + 0.12);
      });
      return;
    }

    if (kind === 'transitionWhoosh') {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'sine';
      o2.type = 'triangle';
      o1.frequency.setValueAtTime(190, now);
      o1.frequency.exponentialRampToValueAtTime(620, now + 0.16);
      o1.frequency.exponentialRampToValueAtTime(240, now + 0.34);
      o2.frequency.setValueAtTime(340, now);
      o2.frequency.exponentialRampToValueAtTime(840, now + 0.18);
      gain.gain.setValueAtTime(0.005, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      o1.connect(gain);
      o2.connect(gain);
      o1.start(now);
      o2.start(now);
      o1.stop(now + 0.37);
      o2.stop(now + 0.37);
      return;
    }

    if (kind === 'fightHorn') {
      [261.63, 392.0, 523.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = idx < 2 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.03, now + 0.25);
        g.gain.setValueAtTime(idx === 0 ? 0.18 : 0.11, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      });
      return;
    }

    if (kind === 'chatPop') {
      [740, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.045);
        g.gain.setValueAtTime(0.08, now + idx * 0.045);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.08);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + idx * 0.045);
        osc.stop(now + idx * 0.045 + 0.09);
      });
      return;
    }

    if (kind === 'grabMash') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(this.jitter(360), now);
      osc.frequency.exponentialRampToValueAtTime(590, now + 0.065);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.085);
      return;
    }

    if (kind === 'loginSuccess') {
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        g.gain.setValueAtTime(0.13, now + idx * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.2);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.22);
      });
      return;
    }

    if (kind === 'lockedError') {
      [210, 165].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        g.gain.setValueAtTime(0.11, now + idx * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.09);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.1);
      });
      return;
    }

    if (kind === 'hit' || kind === 'heavy') {
      const osc = ctx.createOscillator();
      osc.type = kind === 'heavy' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(this.jitter(kind === 'heavy' ? 210 : 300), now);
      osc.frequency.exponentialRampToValueAtTime(48, now + (kind === 'heavy' ? 0.22 : 0.13));
      gain.gain.setValueAtTime(kind === 'heavy' ? 0.28 : 0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === 'heavy' ? 0.24 : 0.14));
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.25);
      return;
    }

    if (kind === 'parry' || kind === 'clash') {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'sine';
      o2.type = 'triangle';
      o1.frequency.setValueAtTime(kind === 'clash' ? 760 : 980, now);
      o1.frequency.exponentialRampToValueAtTime(kind === 'clash' ? 1920 : 1640, now + 0.18);
      o2.frequency.setValueAtTime(1480, now);
      o2.frequency.exponentialRampToValueAtTime(2400, now + 0.2);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      o1.connect(gain);
      o2.connect(gain);
      o1.start(now);
      o2.start(now);
      o1.stop(now + 0.29);
      o2.stop(now + 0.29);
      return;
    }

    if (kind === 'evade') {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'sine';
      o2.type = 'triangle';
      o1.frequency.setValueAtTime(640, now);
      o1.frequency.exponentialRampToValueAtTime(1480, now + 0.15);
      o2.frequency.setValueAtTime(1120, now);
      o2.frequency.exponentialRampToValueAtTime(1880, now + 0.14);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      o1.connect(gain);
      o2.connect(gain);
      o1.start(now);
      o2.start(now);
      o1.stop(now + 0.21);
      o2.stop(now + 0.21);
      return;
    }

    if (kind === 'trap' || kind === 'trapTrigger') {
      const osc = ctx.createOscillator();
      osc.type = kind === 'trap' ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(kind === 'trap' ? 280 : 720, now);
      osc.frequency.exponentialRampToValueAtTime(kind === 'trap' ? 460 : 140, now + 0.16);
      gain.gain.setValueAtTime(kind === 'trap' ? 0.14 : 0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.19);
      return;
    }

    if (kind === 'grab') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(this.jitter(240), now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.15);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.17);
      return;
    }

    if (kind === 'whiff') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(this.jitter(340), now);
      osc.frequency.exponentialRampToValueAtTime(130, now + 0.14);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.16);
      return;
    }

    if (kind === 'stun' || kind === 'overdrive' || kind === 'comboLink') {
      const freqs = kind === 'overdrive' ? [330, 495, 660, 990] : kind === 'comboLink' ? [520, 780] : [440, 310];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + idx * 0.05);
        g.gain.setValueAtTime(0.16, now + idx * 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.22);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.24);
      });
      return;
    }

    if (kind === 'block') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(this.jitter(520), now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.09);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.11);
      return;
    }

    if (kind === 'jump') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(this.jitter(220), now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.12);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.15);
      return;
    }

    if (kind === 'pickup') {
      [587.33, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        g.gain.setValueAtTime(0.14, now + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.18);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.19);
      });
      return;
    }

    if (kind === 'dash' || kind === 'whoosh') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(this.jitter(420), now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.16);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.18);
      return;
    }

    if (kind === 'gunshot') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(this.jitter(640), now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.09);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.11);
      return;
    }

    if (kind === 'shockwave' || kind === 'beam' || kind === 'hazard') {
      const osc = ctx.createOscillator();
      osc.type = kind === 'beam' || kind === 'hazard' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(kind === 'beam' ? 320 : kind === 'hazard' ? 240 : 140, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + (kind === 'beam' ? 0.55 : 0.34));
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === 'beam' ? 0.56 : 0.35));
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.58);
      return;
    }

    if (kind === 'ko') {
      [220, 165, 110].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        osc.frequency.exponentialRampToValueAtTime(45, now + idx * 0.07 + 0.35);
        g.gain.setValueAtTime(0.18, now + idx * 0.07);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.36);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.38);
      });
      return;
    }

    if (kind === 'tick') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.1);
      return;
    }

    if (kind === 'victory') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.09);
        g.gain.setValueAtTime(0.16, now + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.45);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.48);
      });
      return;
    }

    if (kind === 'orbSpawnRumble') {
      const sub = ctx.createOscillator();
      const harm = ctx.createOscillator();
      sub.type = 'sawtooth';
      harm.type = 'triangle';
      sub.frequency.setValueAtTime(88, now);
      sub.frequency.exponentialRampToValueAtTime(34, now + 0.95);
      harm.frequency.setValueAtTime(176, now);
      harm.frequency.exponentialRampToValueAtTime(64, now + 0.85);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.32, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      sub.connect(gain);
      harm.connect(gain);
      sub.start(now);
      harm.start(now);
      sub.stop(now + 1.02);
      harm.stop(now + 1.02);
      return;
    }

    if (kind === 'orbPickupChime' || kind === 'awakeningTransform') {
      if (kind === 'awakeningTransform') {
        // Deep sub-bass drop + rising resonant surge + celestial octave chord
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(165, now);
        sub.frequency.exponentialRampToValueAtTime(34, now + 0.58);
        subGain.gain.setValueAtTime(0.42, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        sub.connect(subGain);
        subGain.connect(masterDuck);
        sub.start(now);
        sub.stop(now + 0.68);

        const sweep = ctx.createOscillator();
        const sweepFilter = ctx.createBiquadFilter();
        const sweepGain = ctx.createGain();
        sweep.type = 'sawtooth';
        sweep.frequency.setValueAtTime(145, now);
        sweep.frequency.exponentialRampToValueAtTime(740, now + 0.34);
        sweepFilter.type = 'bandpass';
        sweepFilter.frequency.setValueAtTime(420, now);
        sweepFilter.frequency.exponentialRampToValueAtTime(2400, now + 0.34);
        sweepFilter.Q.value = 2.4;
        sweepGain.gain.setValueAtTime(0.24, now);
        sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        sweep.connect(sweepFilter);
        sweepFilter.connect(sweepGain);
        sweepGain.connect(masterDuck);
        sweep.start(now);
        sweep.stop(now + 0.44);
      }
      const notes =
        kind === 'awakeningTransform' ? [392, 523.25, 659.25, 783.99, 1046.5, 1318.5] : [587.33, 880, 1174.66];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = i % 2 === 0 ? 'triangle' : 'sine';
        const offset = kind === 'awakeningTransform' ? i * 0.048 : i * 0.055;
        osc.frequency.setValueAtTime(freq, now + offset);
        g.gain.setValueAtTime(kind === 'awakeningTransform' ? 0.19 : 0.16, now + offset);
        g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.42);
        osc.connect(g);
        g.connect(masterDuck);
        osc.start(now + offset);
        osc.stop(now + offset + 0.44);
      });
      return;
    }

    if (kind === 'clashBoom' || kind === 'knockbackImpact') {
      const sub = ctx.createOscillator();
      const crack = ctx.createOscillator();
      sub.type = 'sine';
      crack.type = 'sawtooth';
      sub.frequency.setValueAtTime(140, now);
      sub.frequency.exponentialRampToValueAtTime(30, now + 0.52);
      crack.frequency.setValueAtTime(480, now);
      crack.frequency.exponentialRampToValueAtTime(75, now + 0.25);
      gain.gain.setValueAtTime(0.38, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.56);
      sub.connect(gain);
      crack.connect(gain);
      sub.start(now);
      crack.start(now);
      sub.stop(now + 0.58);
      crack.stop(now + 0.58);
      return;
    }

    if (kind === 'mashTick') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(this.jitter(620), now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.04);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.06);
      return;
    }

    if (kind === 'thunderStrike' || kind === 'railgunShot' || kind === 'silence') {
      const osc = ctx.createOscillator();
      osc.type = kind === 'silence' ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(kind === 'railgunShot' ? 1240 : kind === 'silence' ? 760 : 520, now);
      osc.frequency.exponentialRampToValueAtTime(kind === 'silence' ? 180 : 62, now + 0.24);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.28);
      return;
    }

    if (kind === 'domainExpand' || kind === 'domainClash') {
      const sub = ctx.createOscillator();
      const chime = ctx.createOscillator();
      const sweep = ctx.createOscillator();
      sub.type = 'sine';
      chime.type = 'triangle';
      sweep.type = 'sawtooth';
      sub.frequency.setValueAtTime(kind === 'domainExpand' ? 140 : 180, now);
      sub.frequency.exponentialRampToValueAtTime(32, now + 0.72);
      chime.frequency.setValueAtTime(kind === 'domainExpand' ? 440 : 587, now);
      chime.frequency.exponentialRampToValueAtTime(kind === 'domainExpand' ? 1320 : 1760, now + 0.45);
      sweep.frequency.setValueAtTime(110, now);
      sweep.frequency.exponentialRampToValueAtTime(660, now + 0.55);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.76);
      sub.connect(gain);
      chime.connect(gain);
      sweep.connect(gain);
      sub.start(now);
      chime.start(now);
      sweep.start(now);
      sub.stop(now + 0.78);
      chime.stop(now + 0.5);
      sweep.stop(now + 0.6);
      return;
    }

    if (kind === 'jackpot') {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        const t = now + i * 0.045;
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.26);
      });
    }
  }
}

class JaneCutsceneAudio {
  private audio: HTMLAudioElement | null = null;
  private gainNode: GainNode | null = null;
  private sourceConnected = false;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private targetVolume = 0.88;
  private fadingOut = false;

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
    if (!this.audio) {
      const el = new Audio(AWAKENING_CONFIG.AUDIO_PATH);
      el.preload = 'auto';
      el.loop = false;
      this.audio = el;
      try {
        soundEngine.unlock();
        const ctx = soundEngine.getContext();
        if (ctx && !this.sourceConnected) {
          const src = ctx.createMediaElementSource(el);
          const gain = ctx.createGain();
          gain.gain.value = soundEngine.muted ? 0 : this.targetVolume;
          src.connect(gain);
          gain.connect(ctx.destination);
          this.gainNode = gain;
          this.sourceConnected = true;
        }
      } catch {
        // Fallback to native HTMLAudioElement volume
      }
    }
    return this.audio;
  }

  public async start(): Promise<boolean> {
    this.clearFadeTimer();
    this.fadingOut = false;
    const el = this.ensureAudio();
    if (!el) return false;
    try {
      soundEngine.unlock();
      el.pause();
      el.currentTime = 0;
      const vol = soundEngine.muted ? 0 : this.targetVolume;
      if (this.gainNode) {
        this.gainNode.gain.value = vol;
      } else {
        el.volume = vol;
      }
      await el.play();
      return true;
    } catch {
      return false;
    }
  }

  public isPlaying(): boolean {
    return Boolean(this.audio && !this.audio.paused && !this.audio.ended);
  }

  public seekTo(clockSec: number): void {
    const el = this.ensureAudio();
    if (!el) return;
    try {
      soundEngine.unlock();
      el.currentTime = Math.max(0, clockSec);
      const vol = soundEngine.muted ? 0 : this.targetVolume;
      if (this.gainNode) {
        this.gainNode.gain.value = vol;
      } else {
        el.volume = vol;
      }
      if (el.paused) {
        void el.play().catch(() => {
          // Autoplay blocked
        });
      }
    } catch {
      // Ignore seek errors
    }
  }

  public getCurrentTime(): number | null {
    if (!this.audio || this.audio.paused || this.audio.ended) return null;
    return this.audio.currentTime;
  }

  public setMuted(muted: boolean): void {
    if (!this.audio || this.fadingOut) return;
    const vol = muted ? 0 : this.targetVolume;
    if (this.gainNode) {
      this.gainNode.gain.value = vol;
    } else {
      this.audio.volume = vol;
    }
  }

  public rampFadeOut(durationSec = 3.0): void {
    const el = this.audio;
    if (!el || el.paused) return;
    if (this.fadingOut) return;
    this.fadingOut = true;
    this.clearFadeTimer();

    const startVol = this.gainNode ? this.gainNode.gain.value : el.volume;
    if (startVol <= 0.005 || durationSec <= 0.05) {
      this.stop();
      return;
    }
    const startMs = Date.now();
    const durMs = durationSec * 1000;
    this.fadeTimer = setInterval(() => {
      const p = Math.min(1, (Date.now() - startMs) / durMs);
      const nextVol = startVol * (1 - p);
      if (this.gainNode) {
        this.gainNode.gain.value = Math.max(0, nextVol);
      } else {
        el.volume = Math.max(0, nextVol);
      }
      if (p >= 1) {
        this.stop();
      }
    }, 45);
  }

  public stop(): void {
    this.clearFadeTimer();
    this.fadingOut = false;
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
      } catch {
        // Ignore pause error
      }
    }
  }

  private clearFadeTimer(): void {
    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }
}

export const soundEngine = new SoundEngine();
export const janeCutsceneAudio = new JaneCutsceneAudio();


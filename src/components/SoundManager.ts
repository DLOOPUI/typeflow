// src/components/SoundManager.ts
// Sonidos de teclado generados con Web Audio API.
// - keyCorrect: click "tecla mecanica" (ruido filtrado + tono transitorio)
// - keyError:   tono bajo y suave con decaimiento (no agresivo)
//
// El sonido se prepara en el primer gesto del usuario (politica autoplay).
// Se puede activar/desactivar y ajustar volumen. Persistencia en localStorage.

export class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.6;
  private storageKey = 'typeflow:sound';

  constructor() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const cfg = JSON.parse(saved);
        this.enabled = cfg.enabled ?? true;
        this.volume = cfg.volume ?? 0.6;
      }
    } catch {
      /* ignore */
    }
  }

  // Llamar desde una interaccion del usuario (click) para satisfacer
  // la politica de autoplay de los navegadores.
  ensureContext(): void {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    } catch {
      this.ctx = null;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    this.persist();
    if (v) this.ensureContext();
  }

  getVolume(): number {
    return this.volume;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({ enabled: this.enabled, volume: this.volume }));
    } catch {
      /* ignore */
    }
  }

keyCorrect(): void {
    if (!this.enabled) return;
    this.ensureContext();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    // Duración más larga para el "thock" cremoso
    const dur = 0.08;

    // === CAPA 1: Thock profundo (cuerpo principal) ===
    // Ruido rosa/bajo filtrado para el "thock" grave
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / ctx.sampleRate;
      // Envelope con ataque rápido y decay largo y suave
      const attack = Math.min(1, t / 0.003);
      const decay = Math.exp(-t * 35);
      const env = attack * decay;
      // Ruido con sesgo hacia frecuencias bajas (rosa-ish)
      const pink = (Math.random() * 2 - 1) * 0.7 + (Math.random() * 2 - 1) * 0.3;
      data[i] = pink * env * 0.6;
    }
    const thockNoise = ctx.createBufferSource();
    thockNoise.buffer = buffer;

    // Filtro paso-bajo para el carácter "cremoso" (quita agudos duros)
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    lp.Q.value = 1.2;

    // Resonancia de cámara para dar cuerpo
    const resonance = ctx.createBiquadFilter();
    resonance.type = 'peaking';
    resonance.frequency.value = 180;
    resonance.Q.value = 2.5;
    resonance.gain.value = 6;

    const thockGain = ctx.createGain();
    thockGain.gain.value = 0.45 * this.volume;

    thockNoise.connect(lp).connect(resonance).connect(thockGain).connect(ctx.destination);
    thockNoise.start(now);
    thockNoise.stop(now + dur);

    // === CAPA 2: Click sutil de stem (alta frecuencia, muy breve) ===
    const clickDur = 0.012;
    const clickSize = Math.floor(ctx.sampleRate * clickDur);
    const clickBuf = ctx.createBuffer(1, clickSize, ctx.sampleRate);
    const clickData = clickBuf.getChannelData(0);
    for (let i = 0; i < clickSize; i++) {
      const t = i / ctx.sampleRate;
      const env = Math.exp(-t * 400);
      clickData[i] = (Math.random() * 2 - 1) * env * 0.3;
    }
    const clickSrc = ctx.createBufferSource();
    clickSrc.buffer = clickBuf;
    const clickHP = ctx.createBiquadFilter();
    clickHP.type = 'highpass';
    clickHP.frequency.value = 3000;
    const clickGain = ctx.createGain();
    clickGain.gain.value = 0.15 * this.volume;
    clickSrc.connect(clickHP).connect(clickGain).connect(ctx.destination);
    clickSrc.start(now);
    clickSrc.stop(now + clickDur);

    // === CAPA 3: Tono de resonancia de muelle (muy sutil, grave) ===
    const spring = ctx.createOscillator();
    spring.type = 'sine';
    spring.frequency.setValueAtTime(120, now);
    spring.frequency.exponentialRampToValueAtTime(80, now + dur);
    const springGain = ctx.createGain();
    springGain.gain.setValueAtTime(0, now);
    springGain.gain.linearRampToValueAtTime(0.08 * this.volume, now + 0.005);
    springGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    spring.connect(springGain).connect(ctx.destination);
    spring.start(now);
    spring.stop(now + dur + 0.03);
  }

  keyError(): void {
    if (!this.enabled) return;
    this.ensureContext();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const dur = 0.20;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.20 * this.volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }
}

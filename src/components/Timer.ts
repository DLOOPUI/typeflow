// src/components/Timer.ts
// Temporizador con dos modos:
// - null  (free):     cuenta ascendente (sin limite)
// - minutos (number): cuenta regresiva desde N minutos y dispara onComplete
//
// Se autoinicia llamando a start(). Se puede pausar/reanudar.

export type TimerMode = number | null; // null = libre, else minutos

export interface TimerCallbacks {
  onTick?: (elapsedMs: number, remainingMs: number | null) => void;
  onComplete?: () => void;
}

export class Timer {
  private mode: TimerMode = null;
  private cb: TimerCallbacks;
  private startedAt: number | null = null;
  private accumulatedMs = 0;
  private raf: number | null = null;
  private running = false;
  private completed = false;

  constructor(cb: TimerCallbacks = {}) {
    this.cb = cb;
  }

  setMode(mode: TimerMode): void {
    if (this.running) this.pause();
    this.mode = mode;
  }

  getMode(): TimerMode {
    return this.mode;
  }

  start(): void {
    if (this.running || this.completed) return;
    this.startedAt = performance.now();
    this.running = true;
    this.tick();
  }

  pause(): void {
    if (!this.running) return;
    this.running = false;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    if (this.startedAt !== null) {
      this.accumulatedMs += performance.now() - this.startedAt;
      this.startedAt = null;
    }
  }

  resume(): void {
    if (this.running || this.completed) return;
    this.startedAt = performance.now();
    this.running = true;
    this.tick();
  }

  isRunning(): boolean {
    return this.running;
  }

  isCompleted(): boolean {
    return this.completed;
  }

  reset(): void {
    this.pause();
    this.accumulatedMs = 0;
    this.startedAt = null;
    this.completed = false;
  }

  getElapsedMs(): number {
    let total = this.accumulatedMs;
    if (this.running && this.startedAt !== null) {
      total += performance.now() - this.startedAt;
    }
    return total;
  }

  private getRemainingMs(): number | null {
    if (this.mode === null) return null;
    const total = this.mode * 60 * 1000;
    return total - this.getElapsedMs();
  }

  private tick = (): void => {
    if (!this.running) return;
    const elapsed = this.getElapsedMs();
    const remaining = this.getRemainingMs();
    this.cb.onTick?.(elapsed, remaining);
    if (remaining !== null && remaining <= 0) {
      const m = this.mode!;
      this.accumulatedMs = m * 60 * 1000;
      this.pause();
      this.completed = true;
      this.cb.onComplete?.();
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };
}

export function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

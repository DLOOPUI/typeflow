// src/main.ts
// Orquestador principal de TypeFlow.

import './styles/main.css';
import { fetchBookFragments, searchBooks, type GutendexBook } from './api/gutendex';
import { SoundManager } from './components/SoundManager';
import { TextDisplay } from './components/TextDisplay';
import { Timer, formatMs, type TimerMode } from './components/Timer';
import { BookPicker } from './components/BookPicker';
import { loadJSON, saveJSON } from './utils/storage';

interface RecentEntry {
  book: GutendexBook;
  fragmentIndex: number;
  visitedAt: number;
}

const RECENT_KEY = 'typeflow:recent';

class TypeFlowApp {
  private sound = new SoundManager();
  private timer = new Timer({
    onTick: (elapsed, remaining) => {
      const display = document.getElementById('timer-display');
      if (!display) return;
      display.textContent = remaining !== null ? formatMs(remaining) : formatMs(elapsed);
    },
    onComplete: () => {
      const display = document.getElementById('timer-display');
      if (display) display.textContent = 'Terminado';
      const pauseBtn = document.getElementById('btn-timer-pause') as HTMLButtonElement | null;
      if (pauseBtn) pauseBtn.textContent = 'Reiniciar';
      const stats = document.getElementById('stats-mini');
      if (stats) stats.textContent = 'Sesion completada, buen trabajo.';
    },
  });
  private textDisplay: TextDisplay;
  private fragments: string[] = [];
  private fragmentIndex = 0;
  private currentBook: GutendexBook | null = null;

  private $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

  constructor() {
    // TextDisplay unico, creado una sola vez; los callbacks despachan
    // contra el estado actual de TypeFlowApp.
    this.textDisplay = new TextDisplay(this.$<HTMLElement>('text-area'), {
      onFirstInput: () => this.startTimerOnce(),
      onProgress: (pos, total, errors) => this.onProgress(pos, total, errors),
      onComplete: (errors, total) => this.onComplete(errors, total),
    });
    this.bindHeader();
    this.bindHome();
    this.bindRead();
    this.bindGlobalKeyboard();
    this.applyStoredTheme();
    this.renderRecent();
  }

  // ----- Configuracion global (sonido / tema) -----
  private applyStoredTheme(): void {
    const dark = loadJSON<boolean>('typeflow:dark', true);
    document.body.classList.toggle('theme-dark', dark);
    document.body.classList.toggle('theme-light', !dark);
    const btn = this.$('btn-theme');
    btn.querySelector('.ico')!.textContent = dark ? 'DARK' : 'LIGHT';
    btn.setAttribute('aria-pressed', String(!dark));
  }

  private bindHeader(): void {
    const btnSound = this.$('btn-sound');
    const syncSound = () => {
      btnSound.querySelector('.ico')!.textContent = this.sound.isEnabled() ? 'SND' : 'MUTE';
      btnSound.setAttribute('aria-pressed', String(this.sound.isEnabled()));
    };
    syncSound();
    btnSound.addEventListener('click', () => {
      this.sound.setEnabled(!this.sound.isEnabled());
      syncSound();
    });

    const btnTheme = this.$('btn-theme');
    btnTheme.addEventListener('click', () => {
      const isDark = document.body.classList.contains('theme-dark');
      const next = !isDark;
      document.body.classList.toggle('theme-dark', next);
      document.body.classList.toggle('theme-light', !next);
      btnTheme.querySelector('.ico')!.textContent = next ? 'DARK' : 'LIGHT';
      btnTheme.setAttribute('aria-pressed', String(!next));
      saveJSON('typeflow:dark', next);
    });
  }

// ----- Vista HOME: buscador -----
  private bindHome(): void {
    const input = this.$<HTMLInputElement>('search-input');
    const btn = this.$('search-btn');

    const doSearch = async () => {
      const q = input.value.trim();
      const results = this.$('search-results');
      const picker = new BookPicker(results, { onPick: (b) => this.openBook(b, 0) });
      if (!q) {
        picker.showEmpty('Escribe algo para buscar.');
        return;
      }
      picker.showLoading();
      try {
        const res = await searchBooks(q);
        picker.render(res.results.slice(0, 24));
      } catch (e) {
        picker.showError((e as Error).message);
      }
    };

    btn.addEventListener('click', doSearch);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSearch();
      }
    });
    document.querySelectorAll('.quick-suggest button').forEach((b) => {
      b.addEventListener('click', () => {
        input.value = (b as HTMLElement).dataset.q ?? '';
        doSearch();
      });
    });

    // Cargar libros populares por defecto
    this.loadPopularBooks();
  }

  private async loadPopularBooks(): Promise<void> {
    const results = this.$('search-results');
    const picker = new BookPicker(results, { onPick: (b) => this.openBook(b, 0) });
    picker.showLoading();
    try {
      // Buscar libros populares (vacío = los más descargados)
      const res = await searchBooks('');
      // Mostrar los 30 más descargados
      const popular = res.results
        .sort((a, b) => (b.download_count ?? 0) - (a.download_count ?? 0))
        .slice(0, 30);
      picker.render(popular);
    } catch (e) {
      picker.showError('No se pudieron cargar los libros: ' + (e as Error).message);
    }
  }

  private renderRecent(): void {
    const recent = loadJSON<RecentEntry[]>(RECENT_KEY, []);
    const container = this.$('recent-books');
    const picker = new BookPicker(container, { onPick: (b) => this.openBook(b, 0) });
    if (!recent.length) {
      picker.showEmpty('Aun no has empezado ningun libro.');
      return;
    }
    picker.render(recent.map((r) => r.book));
  }

  // ----- Vista READ -----
  private bindRead(): void {
    const timerModeSel = this.$<HTMLSelectElement>('timer-mode');
    timerModeSel.value = loadJSON<string>('typeflow:timerMode', 'free');
    timerModeSel.addEventListener('change', () => {
      saveJSON('typeflow:timerMode', timerModeSel.value);
      const mode = parseTimerMode(timerModeSel.value);
      this.timer.setMode(mode);
      this.$('timer-display').textContent = mode === null ? '00:00' : formatMs(mode * 60 * 1000);
    });

    const pauseBtn = this.$<HTMLButtonElement>('btn-timer-pause');
    pauseBtn.addEventListener('click', () => {
      if (this.timer.isCompleted()) {
        this.timer.reset();
        this.$('timer-display').textContent = '00:00';
        pauseBtn.textContent = 'Pausa';
        return;
      }
      if (this.timer.isRunning()) {
        this.timer.pause();
        pauseBtn.textContent = 'Reanudar';
      } else {
        this.timer.resume();
        pauseBtn.textContent = 'Pausa';
      }
    });

    this.$('btn-back').addEventListener('click', () => this.showHome());
    this.$('btn-prev-fragment').addEventListener('click', () => this.goFragment(-1));
    this.$('btn-next-fragment').addEventListener('click', () => this.goFragment(1));
  }

  // Listener unico para sonido (capture phase), atado una sola vez.
  private bindGlobalKeyboard(): void {
    this.$('text-area').addEventListener(
      'keydown',
      (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key !== 'Backspace' && e.key !== 'Enter' && e.key.length !== 1) return;
        const prev = this.textDisplay.getPos();
        const prevErrors = this.textDisplay.getErrors();
        // TextDisplay procesara el evento en su listener bubble; leemos el
        // estado resultante en el siguiente tick.
        window.setTimeout(() => {
          if (e.key === 'Backspace') return;
          const now = this.textDisplay.getPos();
          if (now === prev) return;
          const newErrors = this.textDisplay.getErrors();
          if (newErrors > prevErrors) this.sound.keyError();
          else this.sound.keyCorrect();
        }, 0);
      },
      true,
    );
  }

  private showHome(): void {
    this.$('view-home').classList.add('active');
    this.$('view-read').classList.remove('active');
    this.timer.pause();
  }

  private showRead(): void {
    this.$('view-home').classList.remove('active');
    this.$('view-read').classList.add('active');
  }

  private async openBook(book: GutendexBook, fragmentIndex: number): Promise<void> {
    this.showRead();
    const info = this.$('book-info');
    info.innerHTML = '';
    const titleEl = document.createElement('span');
    titleEl.className = 'book-info-title';
    titleEl.textContent = book.title;
    const authorEl = document.createElement('span');
    authorEl.className = 'book-info-author';
    authorEl.textContent = book.authors[0]?.name ?? '';
    info.append(titleEl, authorEl);

    const stats = this.$('stats-mini');
    stats.textContent = 'Cargando libro...';
    try {
      if (!this.currentBook || this.currentBook.id !== book.id) {
        this.fragments = await fetchBookFragments(book);
        this.currentBook = book;
        this.fragmentIndex = 0;
      }
      this.loadFragment(fragmentIndex);
      this.persistRecent(book, this.fragmentIndex);
    } catch (e) {
      stats.textContent = 'No se pudo cargar el libro: ' + (e as Error).message;
    }
  }

  private loadFragment(idx: number): void {
    if (!this.fragments.length) return;
    this.fragmentIndex = Math.max(0, Math.min(idx, this.fragments.length - 1));
    const frag = this.fragments[this.fragmentIndex];
    const area = this.$<HTMLElement>('text-area');

    // Reutilizamos el mismo TextDisplay; solo cambiamos el texto.
    this.textDisplay.setText(frag);

    // reiniciamos el timer y su UI
    this.timer.reset();
    const sel = this.$<HTMLSelectElement>('timer-mode').value;
    const timerMode = parseTimerMode(sel);
    this.timer.setMode(timerMode);
    this.$('timer-display').textContent = timerMode === null ? '00:00' : formatMs(timerMode * 60 * 1000);
    const pauseBtn = this.$<HTMLButtonElement>('btn-timer-pause');
    pauseBtn.textContent = 'Pausa';
    pauseBtn.disabled = true;

    this.$('stats-mini').textContent = `Fragmento ${this.fragmentIndex + 1} / ${this.fragments.length} - empieza a escribir`;
    area.focus();
    this.persistRecent(this.currentBook!, this.fragmentIndex);
  }

  private startTimerOnce(): void {
    if (this.timer.isRunning()) return;
    if (this.timer.isCompleted()) this.timer.reset();
    this.timer.start();
    const pauseBtn = this.$<HTMLButtonElement>('btn-timer-pause');
    pauseBtn.disabled = false;
    pauseBtn.textContent = 'Pausa';
  }

  private onProgress(pos: number, total: number, errors: number): void {
    const elapsed = this.timer.getElapsedMs();
    const minutes = elapsed / 60000;
    const wpm = minutes > 0 ? Math.round(pos / 5 / minutes) : 0;
    const acc = total > 0 ? Math.round(((pos - errors) / total) * 100) : 100;
    this.$('stats-mini').textContent = `Fragmento ${this.fragmentIndex + 1}/${this.fragments.length} - ${wpm} WPM - ${acc}% precision`;
  }

  private onComplete(errors: number, total: number): void {
    const acc = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;
    this.$('stats-mini').textContent = `Fragmento completado - ${acc}% precision. Siguiente listo cuando quieras.`;
  }

  private goFragment(dir: number): void {
    if (!this.fragments.length) return;
    const next = this.fragmentIndex + dir;
    if (next < 0 || next >= this.fragments.length) return;
    this.loadFragment(next);
  }

  private persistRecent(book: GutendexBook, fragmentIndex: number): void {
    const recent = loadJSON<RecentEntry[]>(RECENT_KEY, []);
    const filtered = recent.filter((r) => r.book.id !== book.id);
    filtered.unshift({ book, fragmentIndex, visitedAt: Date.now() });
    saveJSON(RECENT_KEY, filtered.slice(0, 12));
  }
}

new TypeFlowApp();

// 'free' -> libre (null), otros -> minutos (number)
function parseTimerMode(value: string): TimerMode {
  if (value === 'free') return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

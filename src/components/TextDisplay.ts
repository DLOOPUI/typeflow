// src/components/TextDisplay.ts
// Render del texto a escribir. Cada caracter es un span.
// - .ok  -> letra correcta (fondo verde pastel)
// - .bad -> letra incorrecta (fondo rojo pastel)
// - .cur -> cursor de bloque parpadeante en la posicion actual
//
// Escucha keydown del host. Soporta:
// - letras/digitos/signos
// - Backspace (retrocede + borra estado)
// - Enter (debe escribir \n o avanzar al siguiente parrafo)
// - Space
// - Tab (escribe \t si el texto lo requiere; raro en Gutenberg)

export interface TextDisplayCallbacks {
  onProgress?: (pos: number, total: number, errors: number) => void;
  onComplete?: (errors: number, total: number) => void;
  onFirstInput?: () => void;
}

export class TextDisplay {
  private host: HTMLElement;
  private text = '';
  private pos = 0;
  private spans: HTMLSpanElement[] = [];
  private errors = 0;
  private cb: TextDisplayCallbacks;
  private started = false;

  constructor(host: HTMLElement, cb: TextDisplayCallbacks = {}) {
    this.host = host;
    this.cb = cb;
    this.bind();
  }

  setText(text: string): void {
    this.text = text;
    this.pos = 0;
    this.errors = 0;
    this.started = false;
    this.render();
  }

  getText(): string {
    return this.text;
  }

  getPos(): number {
    return this.pos;
  }

  getLength(): number {
    return this.text.length;
  }

  getErrors(): number {
    return this.errors;
  }

  reset(): void {
    this.pos = 0;
    this.errors = 0;
    this.started = false;
    this.render();
  }

  focus(): void {
    this.host.focus();
  }

  private bind(): void {
    this.host.addEventListener('keydown', (e) => this.onKey(e));
  }

private render(): void {
    this.host.innerHTML = '';
    this.spans = [];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < this.text.length; i++) {
      const ch = this.text[i];
      const span = document.createElement('span');
      span.classList.add('char');
      // Tratar salto de línea como espacio (el texto ya viene sin saltos)
      if (ch === '\n' || ch === '\r') {
        span.textContent = ' ';
      } else if (ch === ' ') {
        span.textContent = '\u00A0';
      } else {
        span.textContent = ch;
      }
      if (i < this.pos) {
        span.classList.add('ok');
      } else if (i === this.pos) {
        span.classList.add('cur');
      }
      frag.appendChild(span);
      this.spans.push(span);
    }
    this.host.appendChild(frag);
  }

private onKey(e: KeyboardEvent): void {
    // Ignora combos con Ctrl/Cmd/Alt (accesos del navegador)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (this.pos > 0) {
        this.pos--;
        const s = this.spans[this.pos];
        if (s.classList.contains('bad')) {
          this.errors = Math.max(0, this.errors - 1);
        }
        s.classList.remove('ok', 'bad');
        const cur = this.spans[this.pos];
        cur.classList.add('cur');
        if (this.pos + 1 < this.spans.length) {
          this.spans[this.pos + 1].classList.remove('cur');
        }
        this.scrollCursorIntoView();
        this.emitProgress();
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      this.typeChar('\t');
      return;
    }

    // Solo aceptamos caracteres imprimibles de longitud 1.
    if (e.key.length !== 1) return;
    e.preventDefault();
    this.typeChar(e.key);
  }

  private typeChar(ch: string): void {
    if (!this.started) {
      this.started = true;
      this.cb.onFirstInput?.();
    }
    if (this.pos >= this.text.length) return;

    const expected = this.text[this.pos];
    const span = this.spans[this.pos];
    span.classList.remove('cur');

    // Comparación case-insensitive: 'A' === 'a' para validar
    const isCorrect = ch.toLowerCase() === expected.toLowerCase();

    if (isCorrect) {
      span.classList.add('ok');
    } else {
      span.classList.add('bad');
      this.errors++;
    }

    this.pos++;
    if (this.pos < this.spans.length) {
      this.spans[this.pos].classList.add('cur');
      this.scrollCursorIntoView();
    } else {
      this.cb.onComplete?.(this.errors, this.text.length);
    }
    this.emitProgress();
  }

  private scrollCursorIntoView(): void {
    const curSpan = this.spans.find(s => s.classList.contains('cur'));
    if (curSpan) {
      curSpan.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }

  private emitProgress(): void {
    this.cb.onProgress?.(this.pos, this.text.length, this.errors);
  }
}

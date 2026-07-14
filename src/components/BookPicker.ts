// src/components/BookPicker.ts
// Renderiza la lista de libros resultado de una busqueda y los favoritos / recientes.

import type { GutendexBook } from '../api/gutendex';

export interface BookPickerCallbacks {
  onPick: (book: GutendexBook) => void;
}

export class BookPicker {
  constructor(
    private container: HTMLElement,
    private cb: BookPickerCallbacks,
  ) {}

  showLoading(): void {
    this.container.innerHTML = '<p class="hint">Buscando...</p>';
  }

  showError(msg: string): void {
    this.container.innerHTML = '<p class="hint error">' + escapeHtml(msg) + '</p>';
  }

  showEmpty(msg: string): void {
    this.container.innerHTML = '<p class="hint">' + escapeHtml(msg) + '</p>';
  }

  render(books: GutendexBook[]): void {
    if (!books.length) {
      this.showEmpty('No se encontraron libros.');
      return;
    }
    this.container.innerHTML = '';
    const grid = document.createDocumentFragment();
    for (const b of books) {
      const card = document.createElement('button');
      card.className = 'book-card';
      card.type = 'button';

      const title = document.createElement('span');
      title.className = 'book-title';
      title.textContent = b.title;

      const author = document.createElement('span');
      author.className = 'book-author';
      const a0 = b.authors[0];
      author.textContent = a0 ? a0.name : 'Autor desconocido';

      const meta = document.createElement('span');
      meta.className = 'book-meta';
      meta.textContent =
        b.languages.join(', ') + (b.subjects.length ? ' - ' + b.subjects.slice(0, 2).join(' / ') : '');

      card.append(title, author, meta);
      card.addEventListener('click', () => this.cb.onPick(b));
      grid.appendChild(card);
    }
    this.container.appendChild(grid);
  }
}

// Construye la entidad amp; lt; gt; quot; #39; a partir del codigo ASCII
// para evitar que el tooling de escritura del fuente interprete entidades HTML.
const AMP = String.fromCharCode(38) + 'amp;'; // &
const LT = String.fromCharCode(38) + 'lt;'; // <
const GT = String.fromCharCode(38) + 'gt;'; // >
const QUOT = String.fromCharCode(38) + 'quot;'; // "
const APOS = String.fromCharCode(38) + '#39;'; // '
const ENT_MAP: Record<string, string> = {
  '&': AMP,
  '<': LT,
  '>': GT,
  '"': QUOT,
  "'": APOS,
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ENT_MAP[c] ?? c);
}

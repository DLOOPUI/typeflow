// src/api/gutendex.ts
// Cliente de la API publica de Gutendex (https://gutendex.com)
// Gutendex ofrece libros de Project Gutenberg en dominio publico.
//
// IMPORTANTE: gutenberg.org NO envia cabecera Access-Control-Allow-Origin,
// por lo que el navegador bloquea cualquier fetch directo desde otra app.
// Usamos proxies:
//   - Desarrollo: Vite proxy /__gx -> gutendex.com, /__gb -> gutenberg.org
//   - Produccion (Vercel): Serverless Functions /api/gutendex y /api/gutenberg

const IS_DEV = import.meta.env.DEV;

// En desarrollo usamos /__gx, en produccion usamos /api/gutendex
function gutendexSearchUrl(query: string, languages: string): string {
  const params = new URLSearchParams();
  if (query) params.append('search', query);
  if (languages) params.append('languages', languages);
  const qs = params.toString();
  if (IS_DEV) return `/__gx/books/${qs ? '?' + qs : ''}`;
  return `/api/gutendex${qs ? '?' + qs : ''}`;
}

// Para Gutenberg, en desarrollo /__gb + path, en produccion pasamos el path como ?url=
function rewriteGutenbergUrl(url: string): string {
  if (!url.startsWith('https://www.gutenberg.org')) return url;
  const path = url.slice('https://www.gutenberg.org'.length);
  if (IS_DEV) return '/__gb' + path;
  return '/api/gutenberg?url=' + encodeURIComponent(path);
}

export interface GutendexBook {
  id: number;
  title: string;
  authors: { name: string; birth_year: number | null; death_year: number | null }[];
  subjects: string[];
  languages: string[];
  download_count: number;
  formats: { [mime: string]: string };
}

export interface SearchResult {
  count: number;
  next: string | null;
  previous: string | null;
  results: GutendexBook[];
}

export async function searchBooks(query: string, languages: string = ''): Promise<SearchResult> {
  const url = gutendexSearchUrl(query, languages);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gutendex error ${res.status}`);
  return (await res.json()) as SearchResult;
}

export async function getBook(id: number): Promise<GutendexBook> {
  const url = IS_DEV ? `/__gx/books/${id}` : `/api/gutendex?id=${id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gutendex error ${res.status}`);
  return (await res.json()) as GutendexBook;
}

// Selecciona el mejor formato de texto plano/html disponible
export function pickTextUrl(book: GutendexBook): { url: string; mime: string } | null {
  const order = [
    'text/plain; charset=utf-8',
    'text/plain; charset=us-ascii',
    'text/plain',
    'text/html; charset=utf-8',
    'text/html; charset=iso-8859-1',
    'text/html',
    'application/epub+zip',
  ];
  for (const m of order) {
    if (book.formats[m]) {
      const raw = book.formats[m];
      const url = raw.startsWith('http') ? rewriteGutenbergUrl(raw) : raw;
      return { url, mime: m };
    }
  }
  // fallback: cualquier text/* o primitivo
  for (const mime of Object.keys(book.formats)) {
    if (mime.startsWith('text/')) {
      const raw = book.formats[mime];
      const url = raw.startsWith('http') ? rewriteGutenbergUrl(raw) : raw;
      return { url, mime };
    }
  }
  return null;
}

// Normaliza caracteres para la comparacion: pasa a NFC y estandariza
// comillas y dashes tipograficos a sus equivalentes ASCII.
export function normalizeChar(c: string): string {
  const map: Record<string, string> = {
    '\u2018': "'", // left single quote
    '\u2019': "'", // right single quote / apostrophe
    '\u201C': '"', // left double quote
    '\u201D': '"', // right double quote
    '\u2013': '-', // en dash
    '\u2014': '--', // em dash (lo dejamos doble-guion)
    '\u00A0': ' ', // non-breaking space
    '\u2026': '...', // ellipsis
  };
  return map[c] ?? c;
}

export function normalizeText(text: string): string {
  return Array.from(text).map(normalizeChar).join('');
}

// Extrae el cuerpo del texto a partir del contenido crudo de Gutenberg.
// Quita cabeceras y licencias estandar (*** START OF ... *** / *** END OF ... ***)
export function extractBody(raw: string): string {
  const startRe = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG[^*]*\*\*\*/i;
  const endRe = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG[^*]*\*\*\*/i;
  let body = raw;
  const sIdx = body.search(startRe);
  if (sIdx >= 0) body = body.slice(sIdx).replace(startRe, '');
  const eIdx = body.search(endRe);
  if (eIdx >= 0) body = body.slice(0, eIdx);
  return body.trim();
}

// Divide el cuerpo en fragmentos aptos para escribir.
// Cada fragmento ~300-500 chars (fragmento manejable para DOM).
// SOLO se conservan letras del abecedario y espacios; todo caracter
// especial (comas, puntos, comillas, numeros, guiones, etc.) se elimina.
export function splitIntoFragments(body: string, minLen = 300, maxLen = 500): string[] {
  // Filtrar: solo letras (a-z, A-Z) y espacios. Acentos se conservan.
  // Cualquier otra cosa -> espacio, despues colapsamos espacios.
  const onlyAlpha = body.replace(/[^a-zA-Z\u00C0-\u017F\s]/g, ' ');

  // Normalizar: colapsar espacios múltiples y saltos de línea
  const normalized = onlyAlpha
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Dividir por palabras para fragmentos naturales
  const words = normalized.split(' ').filter(w => w.length > 0);

  const fragments: string[] = [];
  let current = '';

  for (const w of words) {
    const cand = current ? `${current} ${w}` : w;
    if (cand.length > maxLen && current) {
      fragments.push(current.trim());
      current = w;
    } else {
      current = cand;
    }
  }

  if (current.trim()) fragments.push(current.trim());

  // Filtrar fragmentos demasiado cortos
  return fragments.filter(f => f.length >= minLen);
}

export async function fetchBookFragments(book: GutendexBook): Promise<string[]> {
  const pick = pickTextUrl(book);
  if (!pick) throw new Error('No hay formato de texto plano disponible');
  const res = await fetch(pick.url);
  if (!res.ok) throw new Error(`No se pudo descargar el libro (${res.status})`);
  const raw = await res.text();
  const body = extractBody(raw);
  const normalized = normalizeText(body);
  return splitIntoFragments(normalized);
}

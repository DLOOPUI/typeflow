import { defineConfig } from 'vite';

// En desarrollo montamos dos proxies para evitar problemas de CORS:
//   /__gb/*  -> https://www.gutenberg.org/*   (descarga de textos)
//   /__gx/*  -> https://gutendex.com/*         (busqueda y metadatos)
// En produccion deberas montar un proxy equivalente en tu servidor
// (nginx, Cloudflare Worker, Vercel rewrite, etc.) o desplegar TypeFlow
// en el mismo origen que tu proxy.
//
// Nota: Gutendex redirige /books?search=  ->  /books/?search= (con barra).
// Usamos rewrite para añadir la barra y evitar el 301 que rompe el proxy.

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/__gb': {
        target: 'https://www.gutenberg.org',
        changeOrigin: true,
        secure: true,
        followRedirects: true,
        rewrite: (p) => p.replace(/^\/__gb/, ''),
      },
      '/__gx': {
        target: 'https://gutendex.com',
        changeOrigin: true,
        secure: true,
        followRedirects: true,
        rewrite: (p) => {
          // /__gx/books?search=...  ->  /books/?search=...
          const withoutPrefix = p.replace(/^\/__gx/, '');
          // Si es /books o /books/ seguido de query, aseguramos /books/
          return withoutPrefix.replace(/^\/books(?=[?/]|$)/, '/books/');
        },
      },
    },
  },
});
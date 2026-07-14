# TypeFlow

App web para practicar mecanografia sin estres: escribes fragmentos de libros clasicos a tu ritmo, sin cronometros agresivos ni mensajes de error. Hecha con TypeScript + Vite, sin framework.

## Caracteristicas

- **Libros reales de dominio publico** via la API [Gutendex](https://gutendex.com) (Project Gutenberg): Dickens, Shakespeare, Doyle, Poe, Cervantes, Verne, Austen y mas.
  - Busqueda por autor o titulo.
  - Descarga del texto del libro y separacion automatica en fragmentos manejables (~200-600 caracteres).
  - Se guarda tu ultimo avance por libro en `localStorage` (seccion Continuar).
- **No es un test**: no compites contra nadie, no hay cuenta regresiva por defecto. Solo escribes.
- **Feedback visual letra a letra**:
  - Letra correcta  -> fondo verde pastel.
  - Letra incorrecta -> fondo rojo pastel (noUses tonos fluorescentes para no fatigar la vista).
- **Cursor de bloque** parpadeante que avanza con cada tecla (estilo retro).
- **Sonidos** generados con Web Audio API (no dependen de archivos externos):
  - Acierto  -> click de tecla mecanica (ruido filtrado + tono transitorio).
  - Error    -> tono bajo y suave con decaimiento (no agresivo).
  - Toggle on/off + persistencia de preferencias.
  - Si despues prefieres tus propios mp3, se pueden enganchar en `SoundManager`.
- **Temporizador opcional**:
  - Modo libre por defecto (cuenta ascendente, sin fin).
  - Modo regresivo: 1, 5, 10, 15 o 30 minutos. Al terminar, mensaje suave.
  - Pausa / Reanudar / Reiniciar.
- **Temas**: oscuro (por defecto) y claro. Tu preferencia se guarda.
- **Estadisticas suaves**: WPM y precision, solo visibles (no en pantallazos), sin reproches.
- **Responsive**: funciona en cualquier navegador moderno de escritorio; util tambien en mobil (con teclado fisico / bluetooth).
- **Offline-ready al build**: el bundle final es solo HTML/CSS/JS (la API de libros requiere conexion solo al elegir/guardar un libro).

## Stack

- **Vanilla TypeScript** (sin React, sin Vue).
- **Vite** como bundler y dev server.
- **Web Audio API** para los sonidos.
- **Gutendex** para los libros.
- **localStorage** para persistencia (preferencias + libros recientes).

## Estructura

```
.
├── index.html              # entry point (contiene las dos vistas: home / read)
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.ts             # Orquestador (conecta todo)
    ├── vite-env.d.ts
    ├── api/
    │   └── gutendex.ts     # Cliente API + parseo/normalizacion/fragmentacion
    ├── components/
    │   ├── BookPicker.ts   # Render de la lista de libros
    │   ├── SoundManager.ts# Sonidos (Web Audio API)
    │   ├── TextDisplay.ts # Motor de escritura + cursor de bloque
    │   └── Timer.ts       # Temporizador libre / regresivo
    ├── utils/
    │   └── storage.ts     # Helpers de localStorage
    └── styles/
        └── main.css       # Estilos (tema oscuro/claro, cursor bloque)
```

## Como ejecutar

Requisitos: Node 18+ y npm.

```bash
npm install      # instala dependencias (vite + typescript)
npm run dev      # arranca el dev server en http://localhost:5173
npm run build    # build de produccion en dist/
npm run preview  # sirve el build localmente para probarlo
npm run typecheck # revisa tipos sin emitir
```

## Como usar

1. Abre la app en tu navegador (http://localhost:5173).
2. En la pantalla de inicio, busca un autor o titulo (o pulsa uno de los sugeridos: Dickens, Shakespeare, Doyle, Poe, Cervantes, Verne, Austen).
3. Haz clic en una tarjeta de libro para abrirlo.
4. Se cargan los fragmentos del libro en orden. Empieza a escribir: el cursor de bloque estara al inicio del primer fragmento.
5. Las letras correctas se vuelven verdes, las incorrectas rojas.
6. El temporizador empieza solo con la primera tecla. Por defecto modo libre (cuenta ascendente). Puedes cambiar a regresivo (1/5/10/15/30 min) con el selector de arriba.
7. Botones de la parte inferior para ir al fragmento anterior/siguiente.
8. Button "Libros" (arriba a la izquierda) para volver al buscador; los libros abiertos aparecen en "Continuar".

## Proxy CORS (importante)

`www.gutenberg.org` **no** envia la cabecera `Access-Control-Allow-Origin`, por lo que un navegador bloquea cualquier `fetch` directo desde otra app (como `http://localhost:5173`). Siemas:

- En **desarrollo** Vite configura dos proxies en `vite.config.ts`:
  - `/__gx/*` -> `https://gutendex.com/*` (metadatos/busqueda)
  - `/__gb/*` -> `https://www.gutenberg.org/*` (texto de los libros)
  El codigo en `src/api/gutendex.ts` detecta `import.meta.env.DEV` y reescribe las URLs para usar el proxy. No necesitas hacer nada manualmente.
- En **produccion** tendras que montar tu propio proxy en tu servidor. Por ejemplo con nginx:

```
location /__gx/ { proxy_pass https://gutendex.com/; proxy_set_header Host gutendex.com; }
location /__gb/ { proxy_pass https://www.gutenberg.org/; proxy_set_header Host www.gutenberg.org; }
```

  O con un Cloudflare Worker, Vercel `rewrites` en `vercel.json`, etc. Sin proxy, Gutenberg bloqueara las descargas de libros por CORS.

## Notas

- Gutendex ofrece unicamente libros de **dominio publico**. Autores como Stephen King, Tolkien, Rowling, etc. **no estan disponibles** por estar bajo copyright. En su lugar encontraras clasicos de la literatura universal con los que practicar igualmente.
- La primera vez que abres un libro se descarga su texto completo desde Project Gutenberg (~1-3 MB). Despues queda disponible durante la sesion; para persistencia total entre sesiones se puede anadir cache en localStorage (queda como mejora futura).
- Los sonidos se sintetizan al vuelo con Web Audio API; en algunos navegadores hay que interactuar primero (un click en la pagina) antes de que se oigan, por la politica de autoplay. TypeFlow ya maneja esto creando el AudioContext en el primer evento de teclado.

## Mejoras futuras (ideas)

- Cache completa de libros descargados en IndexedDB.
- Modos de practica: solo texto en espanol, solo dialogos, etc.
- Exportar/importar perfil (progreso) y temas personalizados.
- Soporte para `audio/epub+zip` con normalizacion de capitulos.
- Atajos configurables.

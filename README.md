# Smart Reader

A calm, beautiful, **offline-first PDF reading workspace** built with React, Vite, PDF.js, and IndexedDB. Smart Reader keeps your documents and reading data on your own device—no account, cloud database, or paid storage required.

## Features

### Reading and annotation

- **Real PDF reading** — import a PDF or explore three included sample books.
- **Text highlights** — select PDF text and save yellow, green, pink, or blue marks.
- **Stable highlight geometry** — marks remain aligned after zooming, resizing, rotating, or reloading.
- **Reading collections** — dedicated library, highlight, bookmark, and note views.
- **Full-text search** — search extracted PDF text and jump directly to matching pages.
- **Read aloud** — browser speech synthesis with an adjustable narration pace.
- **Reading companion** — per-page notes, document outline, progress ring, and a 25-minute focus timer.
- **Reading atmospheres** — Paper, Sepia, and Night themes plus distraction-free focus mode.

### Offline storage and backup

- **IndexedDB persistence** — uploaded PDFs, highlights, notes, bookmarks, settings, and reading progress survive reloads.
- **LocalStorage fallback** — small reading-data records also have a synchronous browser fallback.
- **Offline PWA** — the app shell, fonts, PDF engine, and sample books are precached for offline reading.
- **Persistent-storage request** — supporting browsers are asked to protect offline data from automatic eviction.
- **ZIP backup export** — one portable file containing uploaded PDF binaries and all reading data.
- **Merged backup import** — restore a backup without deleting unrelated documents or annotations already on the device.
- **No server upload** — documents and annotations stay in the browser unless you explicitly export them.

## Run locally

```bash
npm install
npm run dev
```

The Vite server listens on `0.0.0.0` for local and preview-environment access.

## Production build

```bash
npm run build
npm run preview
```

The production build generates a service worker and web app manifest. Service-worker offline support is available in the production build, not the development server.

## Backup and restore

1. Open **Reading preferences** from the sidebar or reading companion.
2. Find **Offline backup**.
3. Choose **Export backup** to download a dated Smart Reader ZIP.
4. Keep the ZIP somewhere safe, such as an external drive or your preferred cloud storage.
5. Choose **Import backup** on the same or another device to merge the saved PDFs and reading data back into your library.

The backup contains uploaded PDFs, highlights, notes, bookmarks, settings, and reading progress. Built-in sample books are already included with the app and are not duplicated in the ZIP.

## Regenerate sample books

The sample PDFs are generated locally with `pdf-lib`:

```bash
npm run generate:books
```

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `←` / `→` | Previous / next page |
| `B` | Bookmark the current page |
| `F` | Toggle focus mode |
| `Ctrl` / `Cmd` + `K` | Search the current PDF |
| `Ctrl` / `Cmd` + `O` | Import a PDF |
| `Esc` | Close panels or exit focus mode |

## Project structure

```text
public/books/                  Included sample PDFs
public/icons/                  Installable app icons
public/images/                 Editorial cover artwork
scripts/                       Sample-book generator
src/components/                PDF canvas, text layer, and book covers
src/data/                      Book metadata and starter content
src/hooks/                     IndexedDB-backed persistent state
src/lib/pdf.js                 PDF.js setup and text extraction
src/lib/offlineDb.js           IndexedDB document and app-state stores
src/lib/backup.js              ZIP backup creation and restoration
src/lib/highlightGeometry.js   Rotation-safe normalized highlight coordinates
src/App.jsx                    Application state and views
src/styles.css                 Responsive visual system and themes
```

## Browser notes

- PDF rendering and text extraction run locally; documents are never sent to an application server.
- Read aloud requires a browser with the Web Speech API.
- Highlighting works with PDFs containing selectable text. Image-only scans require OCR before text can be selected.
- Browser storage is not unlimited. The settings panel shows the current storage estimate; keep periodic ZIP backups for additional safety.

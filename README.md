# Smart Reader

A calm, beautiful PDF reading workspace built with React, Vite, and PDF.js. Smart Reader turns ordinary documents into a focused reading experience with a personal library, reading progress, notes, bookmarks, and read-aloud support.

## Features

- **Real PDF reading** — upload a PDF or explore three included sample books.
- **Responsive reader** — automatic page fitting, 60–180% zoom, rotation, and page navigation.
- **Full-text search** — search extracted PDF text and jump directly to matching pages.
- **Reading companion** — per-page notes, document outline, progress ring, and a 25-minute focus timer.
- **Read aloud** — browser speech synthesis with an adjustable narration pace.
- **Personal collections** — dedicated library, bookmark, and note views.
- **Reading atmospheres** — Paper, Sepia, and Night themes.
- **Focus mode** — hide the navigation and companion panels for distraction-free reading.
- **Local progress** — reading positions, notes, bookmarks, and preferences are saved in local storage.
- **Drag and drop** — drop a PDF anywhere in the app to begin reading.

Uploaded PDF files remain available for the current browser session. Sample-book progress, notes, bookmarks, and preferences persist across reloads.

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
public/books/          Included sample PDFs
public/images/         Editorial cover artwork
scripts/               Sample-book generator
src/components/        PDF canvas and book-cover components
src/data/              Book metadata and starter content
src/hooks/             Local-storage state hook
src/lib/               PDF.js setup and text extraction
src/App.jsx            Application state and views
src/styles.css         Responsive visual system and themes
```

## Notes

- PDF rendering runs locally in the browser; documents are not sent to a server.
- Read aloud requires a browser with the Web Speech API.
- Notes and bookmarks are stored only in the current browser.

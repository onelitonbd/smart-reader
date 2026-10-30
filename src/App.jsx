import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Feather,
  FileText,
  FileUp,
  Headphones,
  LibraryBig,
  Lightbulb,
  List,
  LoaderCircle,
  Maximize2,
  Menu,
  Minimize2,
  Minus,
  NotebookPen,
  PanelRight,
  Pause,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import BookCover from './components/BookCover';
import PdfViewer from './components/PdfViewer';
import { initialBooks, starterNotes } from './data/books';
import usePersistentState from './hooks/usePersistentState';
import { getPageText, pdfjs } from './lib/pdf';

const defaultBookmarks = [
  { id: 'starter-bookmark', docId: 'noticing', page: 6, createdAt: new Date().toISOString() },
];

function Logo({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`}>
      <span className="brand__mark" aria-hidden="true">
        <span className="brand__page brand__page--left" />
        <span className="brand__page brand__page--right" />
        <Sparkles size={12} strokeWidth={2.2} />
      </span>
      {!compact && <span className="brand__name">smart<span>reader</span></span>}
    </div>
  );
}

function IconButton({ label, className = '', children, ...props }) {
  return (
    <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}

function formatNoteDate(value) {
  if (!value || value === 'Just now') return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
}

function formatTimer(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export default function App() {
  const [books, setBooks] = useState(() => {
    try {
      const progress = JSON.parse(window.localStorage.getItem('smart-reader-progress') || '{}');
      return initialBooks.map((book) => ({ ...book, currentPage: progress[book.id] || book.currentPage }));
    } catch {
      return initialBooks;
    }
  });
  const [activeBookId, setActiveBookId] = useState('noticing');
  const [view, setView] = useState('reader');
  const [pdf, setPdf] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState('');
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [pageInput, setPageInput] = useState('4');
  const [focusMode, setFocusMode] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [companionOpen, setCompanionOpen] = useState(false);
  const [companionTab, setCompanionTab] = useState('notes');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchComplete, setSearchComplete] = useState(false);
  const [speechState, setSpeechState] = useState('idle');
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState('all');

  const [bookmarks, setBookmarks] = usePersistentState('smart-reader-bookmarks', defaultBookmarks);
  const [notes, setNotes] = usePersistentState('smart-reader-notes', starterNotes);
  const [settings, setSettings] = usePersistentState('smart-reader-settings', { theme: 'paper', speechRate: 1 });

  const uploadRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchRequestRef = useRef(0);
  const toastTimerRef = useRef(null);
  const speechRef = useRef(null);

  const activeBook = books.find((book) => book.id === activeBookId) || books[0];
  const currentPage = activeBook.currentPage;
  const totalPages = activeBook.totalPages || pdf?.numPages || 1;
  const progress = Math.min(100, Math.round((currentPage / totalPages) * 100));
  const currentBookmark = bookmarks.find((item) => item.docId === activeBook.id && item.page === currentPage);
  const currentNote = notes.find((item) => item.docId === activeBook.id && item.page === currentPage);
  const activeChapter = useMemo(() => {
    if (!activeBook.outline?.length) return { title: 'Your document', page: 1 };
    return [...activeBook.outline].reverse().find((item) => item.page <= currentPage) || { title: 'Opening pages', page: 1 };
  }, [activeBook, currentPage]);
  const chapterNumber = Math.max(1, activeBook.outline?.findIndex((item) => item.title === activeChapter.title) + 1 || 1);
  const activeNotes = notes.filter((note) => note.docId === activeBook.id);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2800);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme || 'paper';
  }, [settings.theme]);

  useEffect(() => {
    const savedProgress = Object.fromEntries(initialBooks.map((book) => {
      const current = books.find((item) => item.id === book.id);
      return [book.id, current?.currentPage || book.currentPage];
    }));
    try {
      window.localStorage.setItem('smart-reader-progress', JSON.stringify(savedProgress));
    } catch {
      // Progress persistence is optional when browser storage is blocked.
    }
  }, [books]);

  useEffect(() => {
    let cancelled = false;
    setPdf(null);
    setPdfLoading(true);
    setPdfError('');
    searchRequestRef.current += 1;
    setSearchResults([]);
    setSearchQuery('');
    setSearchComplete(false);
    setSearching(false);
    setZoom(100);
    setRotation(0);

    const loadingTask = pdfjs.getDocument(activeBook.url);
    loadingTask.promise.then((document) => {
      if (cancelled) return;
      setPdf(document);
      setPdfLoading(false);
      setBooks((previous) => previous.map((book) => book.id === activeBook.id
        ? { ...book, totalPages: document.numPages, currentPage: Math.min(book.currentPage, document.numPages) }
        : book));
    }).catch((error) => {
      if (cancelled || error?.name === 'AbortException') return;
      console.error('Could not load PDF:', error);
      setPdfError('The file may be damaged or in an unsupported format. Please choose another PDF.');
      setPdfLoading(false);
    });

    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
  }, [activeBook.id, activeBook.url]);

  useEffect(() => {
    setPageInput(String(currentPage));
    setNoteDraft(currentNote?.text || '');
  }, [currentPage, activeBook.id, currentNote?.text]);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const interval = window.setInterval(() => {
      setTimerSeconds((seconds) => {
        if (seconds <= 1) {
          setTimerRunning(false);
          showToast('Focus session complete. Time for a gentle break.');
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning, showToast]);

  useEffect(() => () => {
    window.clearTimeout(toastTimerRef.current);
    window.speechSynthesis?.cancel();
  }, []);

  const goToPage = useCallback((page) => {
    const destination = Math.min(Math.max(Number(page) || 1, 1), totalPages);
    setBooks((previous) => previous.map((book) => book.id === activeBook.id ? { ...book, currentPage: destination } : book));
    setPageInput(String(destination));
    if (view !== 'reader') setView('reader');
  }, [activeBook.id, totalPages, view]);

  const openBook = useCallback((bookId) => {
    setActiveBookId(bookId);
    setView('reader');
    setMobileNavOpen(false);
    setCompanionOpen(false);
    setSearchOpen(false);
  }, []);

  const changeView = (nextView) => {
    setView(nextView);
    setMobileNavOpen(false);
    setSearchOpen(false);
  };

  const toggleBookmark = useCallback(() => {
    if (currentBookmark) {
      setBookmarks((previous) => previous.filter((item) => item.id !== currentBookmark.id));
      showToast(`Bookmark removed from page ${currentPage}`);
    } else {
      setBookmarks((previous) => [...previous, {
        id: `bookmark-${Date.now()}`,
        docId: activeBook.id,
        page: currentPage,
        createdAt: new Date().toISOString(),
      }]);
      showToast(`Page ${currentPage} saved to bookmarks`);
    }
  }, [activeBook.id, currentBookmark, currentPage, setBookmarks, showToast]);

  const stopSpeech = useCallback(() => {
    window.speechSynthesis?.cancel();
    speechRef.current = null;
    setSpeechState('idle');
  }, []);

  useEffect(() => {
    stopSpeech();
  }, [activeBook.id, currentPage, stopSpeech]);

  const toggleSpeech = async () => {
    if (!('speechSynthesis' in window)) {
      showToast('Read aloud is not supported in this browser.');
      return;
    }
    if (speechState === 'playing') {
      window.speechSynthesis.pause();
      setSpeechState('paused');
      return;
    }
    if (speechState === 'paused') {
      window.speechSynthesis.resume();
      setSpeechState('playing');
      return;
    }
    try {
      const text = await getPageText(pdf, currentPage);
      if (!text) {
        showToast('This page has no readable text. Try another page.');
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Number(settings.speechRate) || 1;
      utterance.pitch = 1;
      utterance.onend = () => setSpeechState('idle');
      utterance.onerror = () => setSpeechState('idle');
      speechRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setSpeechState('playing');
    } catch {
      showToast('This page could not be read aloud.');
    }
  };

  const runSearch = async (event) => {
    event?.preventDefault();
    const query = searchQuery.trim();
    if (!query || !pdf) return;
    const requestId = ++searchRequestRef.current;
    setSearching(true);
    setSearchComplete(false);
    setSearchResults([]);
    const matches = [];
    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const text = await getPageText(pdf, pageNumber);
        if (requestId !== searchRequestRef.current) return;
        const index = text.toLowerCase().indexOf(query.toLowerCase());
        if (index !== -1) {
          const start = Math.max(0, index - 42);
          const end = Math.min(text.length, index + query.length + 80);
          matches.push({
            page: pageNumber,
            snippet: `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`,
          });
        }
        if (matches.length >= 20) break;
      }
      setSearchResults(matches);
      setSearchComplete(true);
    } catch {
      showToast('Search could not finish. Please try again.');
    } finally {
      if (requestId === searchRequestRef.current) setSearching(false);
    }
  };

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (view === 'reader') openSearch();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        uploadRef.current?.click();
        return;
      }
      if (event.key === 'Escape') {
        setSettingsOpen(false);
        setSearchOpen(false);
        setMobileNavOpen(false);
        setCompanionOpen(false);
        setFocusMode(false);
        return;
      }
      if (isTyping || view !== 'reader' || settingsOpen) return;
      if (event.key === 'ArrowRight') goToPage(currentPage + 1);
      if (event.key === 'ArrowLeft') goToPage(currentPage - 1);
      if (event.key.toLowerCase() === 'b') toggleBookmark();
      if (event.key.toLowerCase() === 'f') setFocusMode((value) => !value);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentPage, goToPage, openSearch, settingsOpen, toggleBookmark, view]);

  const handleUpload = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Please choose a PDF file.');
      return;
    }
    if (file.size > 75 * 1024 * 1024) {
      showToast('Please choose a PDF smaller than 75 MB.');
      return;
    }
    const id = `upload-${Date.now()}`;
    const title = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
    const importedBook = {
      id,
      title: title || 'Untitled document',
      author: 'Imported PDF',
      category: 'My uploads',
      url: URL.createObjectURL(file),
      totalPages: 1,
      currentPage: 1,
      coverClass: 'cover-upload',
      accent: '#657c8f',
      readTime: 'Your document',
      description: 'Imported from your device. Add notes and bookmarks as you read.',
      outline: [],
      isUpload: true,
    };
    setBooks((previous) => [...previous, importedBook]);
    setActiveBookId(id);
    setView('reader');
    setDragging(false);
    showToast(`“${importedBook.title}” is ready to read`);
    if (uploadRef.current) uploadRef.current.value = '';
  };

  const saveNote = () => {
    const text = noteDraft.trim();
    if (!text) {
      showToast('Write a thought before saving your note.');
      return;
    }
    if (currentNote) {
      setNotes((previous) => previous.map((note) => note.id === currentNote.id ? { ...note, text, createdAt: new Date().toISOString() } : note));
      showToast('Your note has been updated');
    } else {
      setNotes((previous) => [{
        id: `note-${Date.now()}`,
        docId: activeBook.id,
        page: currentPage,
        text,
        createdAt: new Date().toISOString(),
      }, ...previous]);
      showToast(`Note saved to page ${currentPage}`);
    }
  };

  const deleteNote = (noteId) => {
    setNotes((previous) => previous.filter((note) => note.id !== noteId));
    showToast('Note deleted');
  };

  const openLocation = (docId, page, showNotes = false) => {
    const destinationBook = books.find((book) => book.id === docId);
    if (!destinationBook) return;
    const destination = Math.min(Math.max(Number(page) || 1, 1), destinationBook.totalPages || 1);
    setActiveBookId(docId);
    setBooks((previous) => previous.map((book) => book.id === docId ? { ...book, currentPage: destination } : book));
    setPageInput(String(destination));
    setView('reader');
    setMobileNavOpen(false);
    setSearchOpen(false);
    setCompanionOpen(showNotes);
    if (showNotes) setCompanionTab('notes');
  };

  const openNote = (note) => openLocation(note.docId, note.page, true);
  const openBookmark = (bookmark) => openLocation(bookmark.docId, bookmark.page);

  const commitPageInput = () => {
    goToPage(pageInput);
  };

  const filteredBooks = books.filter((book) => {
    const bookProgress = Math.round((book.currentPage / (book.totalPages || 1)) * 100);
    if (libraryFilter === 'reading') return bookProgress < 100;
    if (libraryFilter === 'finished') return bookProgress >= 100;
    return true;
  });

  const viewTitle = view === 'library' ? 'My library' : view === 'bookmarks' ? 'Bookmarks' : view === 'notes' ? 'Notes' : activeBook.title;

  return (
    <div
      className={`app ${focusMode ? 'app--focus' : ''}`}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleUpload(event.dataTransfer.files?.[0]);
      }}
    >
      <input
        ref={uploadRef}
        type="file"
        accept="application/pdf,.pdf"
        className="visually-hidden"
        onChange={(event) => handleUpload(event.target.files?.[0])}
      />

      {mobileNavOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? 'is-open' : ''}`}>
        <div className="sidebar__top">
          <Logo />
          <IconButton label="Close navigation" className="sidebar__close" onClick={() => setMobileNavOpen(false)}><X size={19} /></IconButton>
        </div>

        <button className="import-button" onClick={() => uploadRef.current?.click()}>
          <Plus size={17} />
          <span>Add a new PDF</span>
          <span className="import-button__hint">⌘ O</span>
        </button>

        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === 'reader' ? 'active' : ''} onClick={() => changeView('reader')}>
            <BookOpen size={18} /><span>Continue reading</span>
          </button>
          <button className={view === 'library' ? 'active' : ''} onClick={() => changeView('library')}>
            <LibraryBig size={18} /><span>My library</span><small>{books.length}</small>
          </button>
          <button className={view === 'bookmarks' ? 'active' : ''} onClick={() => changeView('bookmarks')}>
            <Bookmark size={18} /><span>Bookmarks</span><small>{bookmarks.length}</small>
          </button>
          <button className={view === 'notes' ? 'active' : ''} onClick={() => changeView('notes')}>
            <NotebookPen size={18} /><span>My notes</span><small>{notes.length}</small>
          </button>
        </nav>

        <div className="sidebar__section-heading">
          <span>Your library</span>
          <button aria-label="Add PDF" onClick={() => uploadRef.current?.click()}><Plus size={15} /></button>
        </div>
        <div className="sidebar-books">
          {books.slice(0, 4).map((book) => {
            const bookProgress = Math.min(100, Math.round((book.currentPage / (book.totalPages || 1)) * 100));
            return (
              <button key={book.id} className={`sidebar-book ${activeBook.id === book.id && view === 'reader' ? 'active' : ''}`} onClick={() => openBook(book.id)}>
                <BookCover book={book} size="tiny" />
                <span className="sidebar-book__info">
                  <strong>{book.title}</strong>
                  <span>{bookProgress}% read</span>
                  <span className="mini-progress"><i style={{ width: `${bookProgress}%` }} /></span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="sidebar__spacer" />
        <div className="sidebar-quote">
          <Feather size={18} />
          <p>“A little reading,<br />a little more wonder.”</p>
          <span>Make room for a good book.</span>
        </div>
        <div className="sidebar-profile">
          <span className="profile-avatar">S<span /></span>
          <span><strong>My reading space</strong><small>Saved on this device</small></span>
          <IconButton label="Reading preferences" onClick={() => setSettingsOpen(true)}><Settings2 size={17} /></IconButton>
        </div>
      </aside>

      <main className="main-workspace">
        <header className="main-header">
          <div className="main-header__left">
            <IconButton label="Open navigation" className="mobile-menu" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></IconButton>
            <div className="mobile-logo"><Logo compact /></div>
            <div className="header-breadcrumb">
              <span>{view === 'reader' ? 'My library' : 'Workspace'}</span>
              <ChevronRight size={13} />
              <strong>{viewTitle}</strong>
            </div>
          </div>
          <div className="main-header__actions">
            {view === 'reader' && (
              <>
                <IconButton label="Search in this PDF (Ctrl K)" className={searchOpen ? 'is-active' : ''} onClick={() => searchOpen ? setSearchOpen(false) : openSearch()}><Search size={18} /></IconButton>
                <IconButton
                  label={speechState === 'playing' ? 'Pause read aloud' : speechState === 'paused' ? 'Resume read aloud' : 'Read this page aloud'}
                  className={speechState !== 'idle' ? 'is-active' : ''}
                  onClick={toggleSpeech}
                >
                  {speechState === 'playing' ? <Pause size={18} /> : <Headphones size={18} />}
                </IconButton>
                <a className="icon-button header-download" href={activeBook.url} download={`${activeBook.title}.pdf`} aria-label="Download PDF" title="Download PDF"><Download size={18} /></a>
                <button className={`focus-button ${focusMode ? 'is-active' : ''}`} onClick={() => setFocusMode((value) => !value)}>
                  {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  <span>{focusMode ? 'Exit focus' : 'Focus mode'}</span>
                  {!focusMode && <kbd>F</kbd>}
                </button>
                <IconButton label="Toggle reading companion" className={`companion-toggle ${companionOpen ? 'is-active' : ''}`} onClick={() => setCompanionOpen((value) => !value)}><PanelRight size={19} /></IconButton>
              </>
            )}
            {view !== 'reader' && <button className="button button--primary header-import" onClick={() => uploadRef.current?.click()}><Plus size={16} /> Add PDF</button>}
          </div>

          {searchOpen && view === 'reader' && (
            <div className="search-panel">
              <form onSubmit={runSearch} className="search-form">
                <Search size={18} />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => { setSearchQuery(event.target.value); setSearchResults([]); setSearchComplete(false); }}
                  placeholder="Search words or phrases in this book…"
                  aria-label="Search in PDF"
                />
                {searchQuery && <button type="button" aria-label="Clear search" onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchComplete(false); searchInputRef.current?.focus(); }}><X size={16} /></button>}
                <button type="submit" className="search-submit" disabled={searching || !searchQuery.trim()}>{searching ? <LoaderCircle size={16} className="spin" /> : 'Search'}</button>
              </form>
              {(searching || searchResults.length > 0 || (searchQuery && !searching)) && (
                <div className="search-results">
                  {searching && <div className="search-empty"><LoaderCircle size={20} className="spin" /><span>Looking through {totalPages} pages…</span></div>}
                  {!searching && searchComplete && searchResults.length === 0 && <div className="search-empty"><Search size={20} /><span>No matches for “{searchQuery}”. Try another word or phrase.</span></div>}
                  {!searching && !searchComplete && searchResults.length === 0 && searchQuery && <div className="search-empty"><Search size={20} /><span>Press Enter to search this book.</span></div>}
                  {!searching && searchResults.map((result) => (
                    <button key={result.page} onClick={() => { goToPage(result.page); setSearchOpen(false); }}>
                      <span>Page {result.page}</span>
                      <p>{result.snippet}</p>
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </header>

        {view === 'reader' && (
          <section className="reader-view">
            <div className="reader-context">
              <div>
                <span className="reader-context__eyebrow">Chapter {String(chapterNumber).padStart(2, '0')}</span>
                <span className="reader-context__divider" />
                <strong>{activeChapter.title}</strong>
              </div>
              <span className="progress-saved"><CheckCircle2 size={14} /> Progress saved</span>
            </div>

            <PdfViewer
              pdf={pdf}
              pageNumber={currentPage}
              zoom={zoom}
              rotation={rotation}
              loading={pdfLoading}
              error={pdfError}
              onRetry={() => uploadRef.current?.click()}
            />

            <div className="reader-bottom">
              <div className="reader-controls">
                <IconButton label="Previous page" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}><ChevronLeft size={19} /></IconButton>
                <div className="page-control">
                  <input
                    value={pageInput}
                    onChange={(event) => setPageInput(event.target.value.replace(/\D/g, ''))}
                    onBlur={commitPageInput}
                    onKeyDown={(event) => { if (event.key === 'Enter') { commitPageInput(); event.target.blur(); } }}
                    aria-label="Current page"
                    inputMode="numeric"
                  />
                  <span>of {totalPages}</span>
                </div>
                <IconButton label="Next page" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}><ChevronRight size={19} /></IconButton>
                <span className="control-divider" />
                <IconButton label="Zoom out" className="zoom-control" onClick={() => setZoom((value) => Math.max(60, value - 10))} disabled={zoom <= 60}><ZoomOut size={18} /></IconButton>
                <button className="zoom-value" onClick={() => setZoom(100)} title="Reset zoom">{zoom}%</button>
                <IconButton label="Zoom in" className="zoom-control" onClick={() => setZoom((value) => Math.min(180, value + 10))} disabled={zoom >= 180}><ZoomIn size={18} /></IconButton>
                <span className="control-divider control-divider--second" />
                <IconButton label="Rotate page" className="rotate-control" onClick={() => setRotation((value) => (value + 90) % 360)}><RotateCw size={17} /></IconButton>
                <IconButton label={currentBookmark ? 'Remove bookmark (B)' : 'Bookmark this page (B)'} className={currentBookmark ? 'is-bookmarked' : ''} onClick={toggleBookmark}>
                  <Bookmark size={18} fill={currentBookmark ? 'currentColor' : 'none'} />
                </IconButton>
              </div>
              <div className="reader-progress" aria-label={`${progress}% read`}><span style={{ width: `${progress}%` }} /></div>
            </div>
          </section>
        )}

        {view === 'library' && (
          <section className="collection-view">
            <div className="collection-heading">
              <div>
                <span className="eyebrow"><LibraryBig size={14} /> Your personal collection</span>
                <h1>My library<span>.</span></h1>
                <p>A quiet home for every document, idea, and story.</p>
              </div>
              <button className="button button--primary button--large" onClick={() => uploadRef.current?.click()}><Upload size={17} /> Import a PDF</button>
            </div>
            <div className="library-summary">
              <div><strong>{books.length}</strong><span>Books in your library</span></div>
              <div><strong>{bookmarks.length}</strong><span>Pages bookmarked</span></div>
              <div><strong>{notes.length}</strong><span>Thoughts collected</span></div>
              <div className="library-summary__quote"><Sparkles size={18} /><span>Your next favorite idea<br />could be on the next page.</span></div>
            </div>
            <div className="filter-row">
              <div className="filter-pills">
                {[['all', 'All books'], ['reading', 'In progress'], ['finished', 'Finished']].map(([id, label]) => (
                  <button key={id} className={libraryFilter === id ? 'active' : ''} onClick={() => setLibraryFilter(id)}>{label}</button>
                ))}
              </div>
              <span>{filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}</span>
            </div>
            <div className="library-grid">
              {filteredBooks.map((book) => {
                const bookProgress = Math.min(100, Math.round((book.currentPage / (book.totalPages || 1)) * 100));
                return (
                  <article className="library-card" key={book.id}>
                    <button className="library-card__cover" onClick={() => openBook(book.id)} aria-label={`Open ${book.title}`}>
                      <BookCover book={book} />
                      <span className="library-card__open"><BookOpen size={18} /> Open book</span>
                    </button>
                    <div className="library-card__meta"><span>{book.category}</span><span>{book.readTime}</span></div>
                    <h3>{book.title}</h3>
                    <p>{book.author}</p>
                    <div className="library-card__progress"><span><i style={{ width: `${bookProgress}%` }} /></span><small>{bookProgress}%</small></div>
                  </article>
                );
              })}
              <button className="upload-card" onClick={() => uploadRef.current?.click()}>
                <span><FileUp size={25} /></span>
                <strong>Bring your own PDF</strong>
                <p>Upload a document and make it beautifully yours.</p>
                <small>Browse files <ArrowUpRight size={13} /></small>
              </button>
            </div>
            {filteredBooks.length === 0 && <div className="inline-empty"><CheckCircle2 size={24} /><p>No finished books yet. Your next reading milestone is waiting.</p></div>}
          </section>
        )}

        {view === 'bookmarks' && (
          <section className="collection-view">
            <div className="collection-heading">
              <div><span className="eyebrow"><Bookmark size={14} /> Your saved places</span><h1>Bookmarks<span>.</span></h1><p>Pick up exactly where an idea caught your attention.</p></div>
              <button className="button button--secondary" onClick={() => changeView('reader')}><BookOpen size={16} /> Back to reading</button>
            </div>
            {bookmarks.length ? (
              <div className="bookmark-list">
                {bookmarks.map((bookmark) => {
                  const book = books.find((item) => item.id === bookmark.docId);
                  if (!book) return null;
                  const chapter = [...(book.outline || [])].reverse().find((item) => item.page <= bookmark.page);
                  return (
                    <article className="bookmark-row" key={bookmark.id}>
                      <BookCover book={book} size="small" />
                      <div className="bookmark-row__content">
                        <span>{book.title}</span>
                        <h3>{chapter?.title || `Saved on page ${bookmark.page}`}</h3>
                        <p>Page {bookmark.page} of {book.totalPages} · {formatNoteDate(bookmark.createdAt)}</p>
                      </div>
                      <span className="bookmark-row__page">{String(bookmark.page).padStart(2, '0')}</span>
                      <div className="bookmark-row__actions">
                        <IconButton label="Remove bookmark" onClick={() => setBookmarks((previous) => previous.filter((item) => item.id !== bookmark.id))}><Trash2 size={16} /></IconButton>
                        <button className="round-arrow" onClick={() => openBookmark(bookmark)} aria-label="Open bookmark"><ArrowRight size={18} /></button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state"><span><Bookmark size={28} /></span><h2>Keep the pages that matter</h2><p>Tap the bookmark icon beneath any page. It will be waiting for you here.</p><button className="button button--primary" onClick={() => changeView('reader')}>Continue reading</button></div>
            )}
          </section>
        )}

        {view === 'notes' && (
          <section className="collection-view">
            <div className="collection-heading">
              <div><span className="eyebrow"><NotebookPen size={14} /> Your common place book</span><h1>My notes<span>.</span></h1><p>Small thoughts worth returning to, all in one place.</p></div>
              <button className="button button--primary" onClick={() => { changeView('reader'); setCompanionOpen(true); setCompanionTab('notes'); }}><Plus size={16} /> New note</button>
            </div>
            {notes.length ? (
              <div className="notes-grid">
                {notes.map((note, index) => {
                  const book = books.find((item) => item.id === note.docId);
                  if (!book) return null;
                  return (
                    <article className={`note-card note-card--${index % 3}`} key={note.id}>
                      <div className="note-card__top"><span><Lightbulb size={14} /> Page {note.page}</span><IconButton label="Delete note" onClick={() => deleteNote(note.id)}><Trash2 size={15} /></IconButton></div>
                      <p>“{note.text}”</p>
                      <div className="note-card__book"><span style={{ background: book.accent }} />{book.title}</div>
                      <div className="note-card__footer"><span>{formatNoteDate(note.createdAt)}</span><button onClick={() => openNote(note)}>Open in book <ArrowUpRight size={14} /></button></div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state"><span><NotebookPen size={28} /></span><h2>Your ideas have a home</h2><p>Capture a thought from any page and it will appear in this collection.</p><button className="button button--primary" onClick={() => { changeView('reader'); setCompanionOpen(true); }}>Write your first note</button></div>
            )}
          </section>
        )}
      </main>

      {view === 'reader' && !focusMode && (
        <>
          {companionOpen && <button className="companion-scrim" aria-label="Close reading companion" onClick={() => setCompanionOpen(false)} />}
          <aside className={`companion ${companionOpen ? 'is-open' : ''}`}>
            <div className="companion__header">
              <div><Sparkles size={17} /><h2>Reading companion</h2></div>
              <IconButton label="Reading preferences" onClick={() => setSettingsOpen(true)}><Settings2 size={17} /></IconButton>
              <IconButton label="Close companion" className="companion__close" onClick={() => setCompanionOpen(false)}><X size={18} /></IconButton>
            </div>
            <div className="companion__scroll">
              <section className="journey-card">
                <div className="journey-card__top"><span>Your reading journey</span><span className="journey-card__badge">In progress</span></div>
                <div className="journey-card__body">
                  <div className="progress-ring">
                    <svg viewBox="0 0 76 76" aria-hidden="true">
                      <circle cx="38" cy="38" r="32" className="progress-ring__track" />
                      <circle cx="38" cy="38" r="32" className="progress-ring__value" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress} />
                    </svg>
                    <strong>{progress}<small>%</small></strong>
                  </div>
                  <div><strong>A little every day.</strong><p>{currentPage} of {totalPages} pages read<br />{Math.max(0, totalPages - currentPage)} pages to go</p></div>
                </div>
                <div className="journey-card__footer"><Clock3 size={14} /><span>{activeBook.readTime}</span><i /><span>{activeBook.category}</span></div>
              </section>

              <div className="companion-tabs" role="tablist">
                <button role="tab" aria-selected={companionTab === 'notes'} className={companionTab === 'notes' ? 'active' : ''} onClick={() => setCompanionTab('notes')}><NotebookPen size={15} /> Notes <span>{activeNotes.length}</span></button>
                <button role="tab" aria-selected={companionTab === 'outline'} className={companionTab === 'outline' ? 'active' : ''} onClick={() => setCompanionTab('outline')}><List size={15} /> Outline</button>
              </div>

              {companionTab === 'notes' ? (
                <div className="notes-panel">
                  <section className="note-editor">
                    <div className="note-editor__label"><span>Page {currentPage}</span><Lightbulb size={15} /></div>
                    <textarea
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      placeholder="Capture a thought, question, or idea…"
                      aria-label={`Note for page ${currentPage}`}
                      maxLength={700}
                    />
                    <div className="note-editor__footer"><span>{noteDraft.length}/700</span><button onClick={saveNote}>{currentNote ? 'Update note' : 'Save note'}<ArrowUpRight size={13} /></button></div>
                  </section>
                  <div className="note-tip"><Sparkles size={15} /><p><strong>A small reading ritual</strong>Write down one idea you want to remember from this page.</p></div>
                  {activeNotes.filter((note) => note.page !== currentPage).slice(0, 2).map((note) => (
                    <button className="recent-note" key={note.id} onClick={() => goToPage(note.page)}>
                      <span>Page {note.page}</span><p>{note.text}</p><ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="outline-panel">
                  <span className="outline-panel__label">In this book</span>
                  {activeBook.outline?.length ? activeBook.outline.map((item, index) => (
                    <button key={`${item.page}-${item.title}`} className={activeChapter.title === item.title ? 'active' : ''} onClick={() => goToPage(item.page)}>
                      <span>{String(index + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><small>Page {item.page}</small></div>{activeChapter.title === item.title ? <span className="outline-dot" /> : <ChevronRight size={14} />}
                    </button>
                  )) : <div className="outline-empty"><FileText size={24} /><p>This PDF has no custom outline.<br />Use page controls to explore it.</p></div>}
                </div>
              )}
            </div>

            <section className="focus-timer">
              <div className={`focus-timer__icon ${timerRunning ? 'is-running' : ''}`}><Clock3 size={19} /></div>
              <div className="focus-timer__info"><span>{timerRunning ? 'Focus session in progress' : 'A moment of quiet focus'}</span><strong>{formatTimer(timerSeconds)}</strong></div>
              <IconButton label={timerRunning ? 'Pause focus timer' : 'Start focus timer'} className="timer-play" onClick={() => {
                if (timerSeconds === 0) setTimerSeconds(25 * 60);
                setTimerRunning((value) => !value);
              }}>{timerRunning ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}</IconButton>
              <IconButton label="Reset focus timer" className="timer-reset" onClick={() => { setTimerRunning(false); setTimerSeconds(25 * 60); }}><RotateCcw size={15} /></IconButton>
            </section>
          </aside>
        </>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="settings-modal__header"><div><span className="eyebrow"><Settings2 size={14} /> Make it yours</span><h2 id="settings-title">Reading preferences</h2></div><IconButton label="Close settings" onClick={() => setSettingsOpen(false)}><X size={20} /></IconButton></div>
            <div className="settings-group">
              <label>Reading atmosphere</label>
              <p>Choose a surrounding that feels easy on your eyes.</p>
              <div className="theme-options">
                {[['paper', 'Paper'], ['sepia', 'Sepia'], ['night', 'Night']].map(([id, label]) => (
                  <button key={id} className={`theme-option theme-option--${id} ${settings.theme === id ? 'active' : ''}`} onClick={() => setSettings((previous) => ({ ...previous, theme: id }))}>
                    <span className="theme-preview"><i /><i /><i /></span><span>{label}{settings.theme === id && <Check size={14} />}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-group speech-setting">
              <div><label htmlFor="speech-rate">Read aloud pace</label><p>Set a comfortable speed for page narration.</p></div>
              <span>{Number(settings.speechRate || 1).toFixed(1)}×</span>
              <input id="speech-rate" type="range" min="0.7" max="1.4" step="0.1" value={settings.speechRate || 1} onChange={(event) => setSettings((previous) => ({ ...previous, speechRate: Number(event.target.value) }))} />
            </div>
            <div className="settings-group shortcuts">
              <label>Keyboard shortcuts</label>
              <div><span>Next / previous page</span><span><kbd>←</kbd><kbd>→</kbd></span></div>
              <div><span>Bookmark this page</span><kbd>B</kbd></div>
              <div><span>Toggle focus mode</span><kbd>F</kbd></div>
              <div><span>Search this book</span><span><kbd>Ctrl</kbd><kbd>K</kbd></span></div>
            </div>
            <button className="button button--primary settings-done" onClick={() => setSettingsOpen(false)}>Done — keep reading</button>
          </section>
        </div>
      )}

      {dragging && (
        <div className="drop-overlay">
          <div><span><Upload size={30} /></span><h2>Make yourself at home.</h2><p>Drop your PDF here to start reading beautifully.</p><small>PDF files up to 75 MB</small></div>
        </div>
      )}

      {toast && <div className="toast" role="status"><span><Check size={15} /></span>{toast}</div>}
    </div>
  );
}

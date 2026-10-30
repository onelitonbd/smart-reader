import { useEffect, useRef, useState } from 'react';
import { FileWarning, Highlighter, LoaderCircle, X } from 'lucide-react';
import { pdfjs } from '../lib/pdf';
import { toCanonicalRect, toDisplayRect } from '../lib/highlightGeometry';

const highlightColors = [
  { id: 'yellow', label: 'Yellow', value: '#f2cf56' },
  { id: 'green', label: 'Green', value: '#83b79b' },
  { id: 'pink', label: 'Pink', value: '#e5a0ae' },
  { id: 'blue', label: 'Blue', value: '#8aaed1' },
];

const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);

export default function PdfViewer({
  pdf,
  pageNumber,
  zoom,
  rotation,
  loading,
  error,
  onRetry,
  highlights = [],
  onAddHighlight,
}) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const pageWrapRef = useRef(null);
  const textLayerRef = useRef(null);
  const renderTaskRef = useRef(null);
  const textLayerTaskRef = useRef(null);
  const [rendering, setRendering] = useState(true);
  const [renderError, setRenderError] = useState('');
  const [selection, setSelection] = useState(null);

  useEffect(() => {
    setSelection(null);
  }, [pdf, pageNumber, rotation]);

  useEffect(() => {
    if (!pdf || !canvasRef.current || !stageRef.current) return undefined;
    let cancelled = false;
    let resizeObserver;
    let currentPage;
    let currentTextLayer;

    const renderPage = async () => {
      try {
        setRendering(true);
        setRenderError('');
        currentPage = await pdf.getPage(pageNumber);
        if (cancelled || !stageRef.current || !canvasRef.current) return;

        const baseViewport = currentPage.getViewport({ scale: 1, rotation });
        const stage = stageRef.current.getBoundingClientRect();
        const horizontalPadding = stage.width < 600 ? 24 : 80;
        const verticalPadding = stage.height < 500 ? 24 : 54;
        const horizontalRoom = Math.max(stage.width - horizontalPadding, 240);
        const verticalRoom = Math.max(stage.height - verticalPadding, 320);
        const fitScale = Math.min(horizontalRoom / baseViewport.width, verticalRoom / baseViewport.height);
        const viewport = currentPage.getViewport({ scale: fitScale * (zoom / 100), rotation });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d', { alpha: false });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.floor(viewport.width);
        const height = Math.floor(viewport.height);

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        if (renderTaskRef.current) renderTaskRef.current.cancel();
        if (textLayerTaskRef.current) textLayerTaskRef.current.cancel();
        const renderTask = currentPage.render({
          canvasContext: context,
          viewport,
          transform: pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : null,
          background: '#ffffff',
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        if (cancelled) return;

        if (textLayerRef.current) {
          const container = textLayerRef.current;
          container.replaceChildren();
          container.style.width = `${width}px`;
          container.style.height = `${height}px`;
          container.style.setProperty('--scale-factor', viewport.scale);
          const textContent = await currentPage.getTextContent();
          if (cancelled) return;
          const textLayer = new pdfjs.TextLayer({
            textContentSource: textContent,
            container,
            viewport,
          });
          currentTextLayer = textLayer;
          textLayerTaskRef.current = textLayer;
          await textLayer.render();
        }
        if (!cancelled) setRendering(false);
      } catch (err) {
        if (!cancelled && err?.name !== 'RenderingCancelledException') {
          console.error('Could not render PDF page:', err);
          setRenderError('This page could not be displayed. Try another page or reopen the document.');
          setRendering(false);
        }
      }
    };

    renderPage();
    resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(resizeObserver._timer);
      resizeObserver._timer = window.setTimeout(renderPage, 100);
    });
    resizeObserver.observe(stageRef.current);

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      window.clearTimeout(resizeObserver?._timer);
      if (renderTaskRef.current) renderTaskRef.current.cancel();
      if (textLayerTaskRef.current) textLayerTaskRef.current.cancel();
      currentTextLayer?.cancel();
      currentPage?.cleanup();
    };
  }, [pdf, pageNumber, zoom, rotation]);

  const captureSelection = () => {
    window.setTimeout(() => {
      const browserSelection = window.getSelection();
      const textLayer = textLayerRef.current;
      const pageWrap = pageWrapRef.current;
      if (!browserSelection || browserSelection.isCollapsed || !textLayer || !pageWrap) return;
      const text = browserSelection.toString().replace(/\s+/g, ' ').trim();
      if (!text || browserSelection.rangeCount === 0) return;
      const range = browserSelection.getRangeAt(0);
      if (!textLayer.contains(range.commonAncestorContainer)) return;

      const pageBounds = pageWrap.getBoundingClientRect();
      if (!pageBounds.width || !pageBounds.height) return;
      const displayRects = Array.from(range.getClientRects())
        .filter((rect) => rect.width > 1 && rect.height > 1)
        .slice(0, 50)
        .map((rect) => {
          const x = clamp((rect.left - pageBounds.left) / pageBounds.width);
          const y = clamp((rect.top - pageBounds.top) / pageBounds.height);
          const right = clamp((rect.right - pageBounds.left) / pageBounds.width);
          const bottom = clamp((rect.bottom - pageBounds.top) / pageBounds.height);
          return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
        })
        .filter((rect) => rect.width > 0.001 && rect.height > 0.001);
      if (!displayRects.length) return;

      const first = displayRects[0];
      setSelection({
        text,
        rects: displayRects.map((rect) => toCanonicalRect(rect, rotation)),
        menu: {
          x: clamp(first.x + first.width / 2, 0.2, 0.8),
          y: first.y,
          below: first.y < 0.12,
        },
      });
    }, 0);
  };

  const saveHighlight = (color) => {
    if (!selection || !onAddHighlight) return;
    onAddHighlight({ text: selection.text, rects: selection.rects, color });
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  };

  if (error || renderError) {
    return (
      <div className="pdf-message" role="alert">
        <span className="pdf-message__icon"><FileWarning size={26} /></span>
        <h3>We couldn’t open this PDF</h3>
        <p>{error || renderError}</p>
        <button className="button button--primary" onClick={onRetry}>Choose another PDF</button>
      </div>
    );
  }

  return (
    <div className="pdf-stage" ref={stageRef}>
      <div
        ref={pageWrapRef}
        className={`pdf-page-wrap ${rendering || loading ? 'is-rendering' : ''}`}
        onMouseUp={captureSelection}
        onTouchEnd={captureSelection}
        onMouseDown={(event) => {
          if (!event.target.closest('.highlight-menu')) setSelection(null);
        }}
      >
        <canvas ref={canvasRef} className="pdf-canvas" aria-label={`PDF page ${pageNumber}`} />
        <div className="pdf-highlights" aria-hidden="true">
          {highlights.flatMap((highlight) => highlight.rects.map((rect, index) => {
            const display = toDisplayRect(rect, rotation);
            return (
              <span
                key={`${highlight.id}-${index}`}
                className={`pdf-highlight pdf-highlight--${highlight.color || 'yellow'}`}
                style={{
                  left: `${display.x * 100}%`,
                  top: `${display.y * 100}%`,
                  width: `${display.width * 100}%`,
                  height: `${display.height * 100}%`,
                }}
              />
            );
          }))}
        </div>
        <div ref={textLayerRef} className="textLayer pdf-text-layer" aria-label={`Selectable text on page ${pageNumber}`} />

        {selection && (
          <div
            className={`highlight-menu ${selection.menu.below ? 'highlight-menu--below' : ''}`}
            style={{ left: `${selection.menu.x * 100}%`, top: `${selection.menu.y * 100}%` }}
            role="toolbar"
            aria-label="Save text highlight"
            onMouseDown={(event) => event.preventDefault()}
          >
            <Highlighter size={15} />
            <span>Mark as</span>
            <div className="highlight-menu__colors">
              {highlightColors.map((color) => (
                <button
                  key={color.id}
                  className={`highlight-swatch highlight-swatch--${color.id}`}
                  style={{ '--swatch': color.value }}
                  aria-label={`Save ${color.label.toLowerCase()} highlight`}
                  title={`${color.label} highlight`}
                  onClick={() => saveHighlight(color.id)}
                />
              ))}
            </div>
            <button className="highlight-menu__close" aria-label="Cancel highlight" onClick={() => {
              window.getSelection()?.removeAllRanges();
              setSelection(null);
            }}><X size={14} /></button>
          </div>
        )}

        {(rendering || loading) && (
          <div className="pdf-loading">
            <LoaderCircle size={24} className="spin" />
            <span>Preparing your page…</span>
          </div>
        )}
      </div>
    </div>
  );
}

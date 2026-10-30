import { useEffect, useRef, useState } from 'react';
import { FileWarning, LoaderCircle } from 'lucide-react';

export default function PdfViewer({ pdf, pageNumber, zoom, rotation, loading, error, onRetry }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [rendering, setRendering] = useState(true);
  const [renderError, setRenderError] = useState('');

  useEffect(() => {
    if (!pdf || !canvasRef.current || !stageRef.current) return undefined;
    let cancelled = false;
    let resizeObserver;
    let currentPage;

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

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        if (renderTaskRef.current) renderTaskRef.current.cancel();
        const renderTask = currentPage.render({
          canvasContext: context,
          viewport,
          transform: pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : null,
          background: '#ffffff',
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
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
      currentPage?.cleanup();
    };
  }, [pdf, pageNumber, zoom, rotation]);

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
      <div className={`pdf-page-wrap ${rendering || loading ? 'is-rendering' : ''}`}>
        <canvas ref={canvasRef} className="pdf-canvas" aria-label={`PDF page ${pageNumber}`} />
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

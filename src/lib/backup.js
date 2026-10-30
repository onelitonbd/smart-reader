import { getStoredDocument } from './offlineDb';

const BACKUP_FORMAT = 'smart-reader-backup';
const BACKUP_VERSION = 1;
const DATA_FILE = 'smart-reader-data.json';

function bookMetadata(book, filePath) {
  const metadata = { ...book, filePath };
  delete metadata.url;
  delete metadata.file;
  return metadata;
}

export async function createBackup({ books, notes, bookmarks, highlights, settings, progress }) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const uploadedBooks = books.filter((book) => book.isUpload);
  const documents = [];

  for (const book of uploadedBooks) {
    const stored = book.file ? book : await getStoredDocument(book.id);
    if (!stored?.file) continue;
    const filePath = `documents/${book.id}.pdf`;
    documents.push(bookMetadata(book, filePath));
    zip.file(filePath, stored.file, { binary: true, compression: 'STORE' });
  }

  const payload = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    documents,
    notes,
    bookmarks,
    highlights,
    settings,
    progress,
  };
  zip.file(DATA_FILE, JSON.stringify(payload, null, 2));
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export async function readBackup(file) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(file);
  const dataEntry = zip.file(DATA_FILE);
  if (!dataEntry) throw new Error('This is not a Smart Reader backup.');
  const payload = JSON.parse(await dataEntry.async('string'));
  if (payload.format !== BACKUP_FORMAT || payload.version !== BACKUP_VERSION) {
    throw new Error('This backup version is not supported.');
  }

  const documents = [];
  for (const metadata of payload.documents || []) {
    const fileEntry = zip.file(metadata.filePath);
    if (!fileEntry) continue;
    const bytes = await fileEntry.async('arraybuffer');
    const { filePath, ...book } = metadata;
    documents.push({
      book: { ...book, isUpload: true },
      file: new Blob([bytes], { type: 'application/pdf' }),
    });
  }

  return {
    documents,
    notes: Array.isArray(payload.notes) ? payload.notes : [],
    bookmarks: Array.isArray(payload.bookmarks) ? payload.bookmarks : [],
    highlights: Array.isArray(payload.highlights) ? payload.highlights : [],
    settings: payload.settings || {},
    progress: payload.progress || {},
    exportedAt: payload.exportedAt,
  };
}

export function mergeById(current, imported) {
  const merged = new Map(current.map((item) => [item.id, item]));
  imported.forEach((item) => {
    if (item?.id) merged.set(item.id, item);
  });
  return [...merged.values()];
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

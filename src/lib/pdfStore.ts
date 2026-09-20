const DB = 'yks_files_v1';
const STORE = 'files';
const PDF_KEY = 'school_schedule_pdf';
export const MAX_PDF_BYTES = 12 * 1024 * 1024;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB açılamadı.'));
  });
}

export async function saveSchedulePdf(file: File) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(file, PDF_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('PDF kaydedilemedi.'));
  });
  db.close();
}

export async function loadSchedulePdf(): Promise<File | null> {
  const db = await openDb();
  const file = await new Promise<File | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(PDF_KEY);
    req.onsuccess = () => resolve((req.result as File) || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return file;
}

export async function clearSchedulePdf() {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(PDF_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function assertPdfFile(file: File) {
  const okType = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!okType) throw new Error('Yalnızca PDF yükleyebilirsin.');
  if (file.size > MAX_PDF_BYTES) throw new Error('PDF 12 MB sınırını aşmamalı.');
}

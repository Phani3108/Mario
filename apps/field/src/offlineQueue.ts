/**
 * Tiny IndexedDB-backed queue for proof uploads when the network is down.
 * One store: `proofs` keyed by autoincrement id. Value = {taskId, blob, meta}.
 */
const DB_NAME = 'mickey-field';
const DB_VER = 1;
const STORE = 'proofs';

type Meta = { lat: number; lng: number; capturedAt: string };
export type QueuedProof = {
  id?: number;
  taskId: string;
  blob: Blob;
  meta: Meta;
  enqueuedAt: string;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function enqueue(p: Omit<QueuedProof, 'id' | 'enqueuedAt'>) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add({ ...p, enqueuedAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function list(): Promise<QueuedProof[]> {
  const db = await open();
  const all = await new Promise<QueuedProof[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueuedProof[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return all;
}

export async function remove(id: number) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function count(): Promise<number> {
  const db = await open();
  const n = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return n;
}

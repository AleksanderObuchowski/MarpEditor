/**
 * IndexedDB-backed image storage for unlimited capacity.
 * localStorage is limited to ~5-10MB and blocks the main thread.
 * IndexedDB gives us 50MB+ and async I/O.
 */

const DB_NAME = 'marp-editor-db'
const STORE_NAME = 'images'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

export async function dbSaveImage(id: string, base64: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).put(base64, id)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function dbGetImage(id: string): Promise<string | undefined> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const req = tx.objectStore(STORE_NAME).get(id)
  return new Promise((resolve, reject) => {
    req.onsuccess = () => { db.close(); resolve(req.result) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function dbDeleteImage(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).delete(id)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function dbGetAllImageIds(): Promise<string[]> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const req = tx.objectStore(STORE_NAME).getAllKeys()
  return new Promise((resolve, reject) => {
    req.onsuccess = () => { db.close(); resolve(req.result as string[]) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function dbGetAllImages(): Promise<Record<string, string>> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const result: Record<string, string> = {}
  return new Promise((resolve, reject) => {
    const cursorReq = store.openCursor()
    cursorReq.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result
      if (cursor) {
        result[cursor.key as string] = cursor.value as string
        cursor.continue()
      } else {
        db.close()
        resolve(result)
      }
    }
    cursorReq.onerror = () => { db.close(); reject(cursorReq.error) }
  })
}

/** Migrate images from localStorage JSON blob to IndexedDB (one-time) */
export async function migrateImagesFromLocalStorage(): Promise<void> {
  const legacy = localStorage.getItem('marp-editor-images')
  if (!legacy) return
  try {
    const images: Record<string, string> = JSON.parse(legacy)
    const entries = Object.entries(images)
    if (entries.length === 0) return
    const db = await openDb()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const [id, base64] of entries) {
      store.put(base64, id)
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
    localStorage.removeItem('marp-editor-images')
  } catch {
    // ignore parse errors
  }
}

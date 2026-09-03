const DB_NAME = "mainboard"
const DB_VERSION = 1
const STORE_NAME = "assets"

/**
 * Blob storage for anything too big for `localStorage`an uploaded wallpaper
 * blows past its ~5 MB quota on the first photo. Settings keep a reference
 * (the asset id) and the bytes live here.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode)
      const request = run(transaction.objectStore(STORE_NAME))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

export async function putAsset(blob: Blob): Promise<string> {
  const id = crypto.randomUUID()
  await withStore("readwrite", (store) => store.put(blob, id))
  return id
}

export function getAsset(id: string): Promise<Blob | undefined> {
  return withStore("readonly", (store) => store.get(id) as IDBRequest<Blob | undefined>)
}

export function deleteAsset(id: string): Promise<undefined> {
  return withStore("readwrite", (store) => store.delete(id))
}

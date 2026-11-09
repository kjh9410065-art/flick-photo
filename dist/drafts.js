const database = 'flick-photo-local';
const store = 'workspace';

// Resolve writes only after commit so quota failures leave the previous draft intact.
export function draftOperation(mode, action) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(store);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error('다른 탭에서 저장소를 사용 중입니다.'));
    request.onsuccess = () => {
      const db = request.result;
      try {
        const tx = db.transaction(store, mode);
        const result = action(tx.objectStore(store));
        tx.oncomplete = () => { db.close(); resolve(result.result); };
        tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || result.error); };
      } catch (error) {
        db.close();
        reject(error);
      }
    };
  });
}

export const readDraft = () => draftOperation('readonly', records => records.get('draft'));
export const saveDraft = draft => draftOperation('readwrite', records => records.put(draft, 'draft'));
export const deleteDraft = () => draftOperation('readwrite', records => records.delete('draft'));

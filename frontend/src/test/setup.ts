import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';

// 각 테스트 후 IndexedDB 초기화
afterEach(async () => {
  const databases = await indexedDB.databases();
  await Promise.all(
    databases.map((db) => {
      if (db.name) {
        return new Promise((resolve) => {
          const request = indexedDB.deleteDatabase(db.name!);
          request.onsuccess = () => resolve(undefined);
          request.onerror = () => resolve(undefined);
        });
      }
      return Promise.resolve();
    })
  );
});

import { useEffect, useState, useCallback } from 'react';
import { settingsService } from '../services/local/settingsService';
import { syncService } from '../services/sync/syncService';

export function useInitialSyncStatus() {
  const [isInitialSyncCompleted, setInitialSyncCompleted] = useState(false);
  const [isChecking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkStatus = async () => {
      try {
        const completed = await settingsService.isInitialSyncCompleted();
        if (!cancelled) {
          setInitialSyncCompleted(completed);
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    };

    checkStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const waitForInitialSync = useCallback(async () => {
    if (isInitialSyncCompleted) {
      return;
    }

    await syncService.sync();
    setInitialSyncCompleted(true);
  }, [isInitialSyncCompleted]);

  return { isInitialSyncCompleted, isChecking, waitForInitialSync };
}

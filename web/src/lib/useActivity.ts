import { useCallback, useEffect, useState } from 'react';
import { api, type ActivitySummary } from './api';

// Loads the consistency summary and keeps it fresh while the app is open (so
// today's active minutes tick up as the heartbeat accrues).
export function useActivity(enabled: boolean) {
  const [activity, setActivity] = useState<ActivitySummary | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setActivity(await api.activity());
    } catch {
      /* keep last known */
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  return { activity, refresh };
}

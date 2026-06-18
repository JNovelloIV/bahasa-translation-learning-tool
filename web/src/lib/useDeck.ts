import { useCallback, useEffect, useState } from 'react';
import { api, type WordsResponse } from './api';

// The deck (GET /words) is the design's single source of truth: it drives the
// Words screen, the Compose "N due" pill, and the Review tab badge. Gated on
// `enabled` (auth) so we don't fetch before login.
export function useDeck(enabled: boolean) {
  const [deck, setDeck] = useState<WordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setError('');
      setDeck(await api.words());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your deck');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  const dueCount = deck?.due_count ?? 0;
  return { deck, dueCount, loading, error, refresh };
}

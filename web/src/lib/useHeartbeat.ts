import { useEffect } from 'react';
import { api } from './api';

const TICK_MS = 15_000; // heartbeat cadence
const IDLE_MS = 60_000; // pause after this much no-input

// Measures ACTIVE time only: pings every 15s, but skips the ping when the tab is
// hidden or the user hasn't interacted in the last ~60s. So idle/open-but-away
// time is never counted.
export function useHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    const bump = () => {
      last = Date.now();
    };
    const events = ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart', 'input'];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const id = setInterval(() => {
      const active = document.visibilityState === 'visible' && Date.now() - last < IDLE_MS;
      if (active) api.ping(TICK_MS / 1000).catch(() => {});
    }, TICK_MS);

    return () => {
      clearInterval(id);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [enabled]);
}

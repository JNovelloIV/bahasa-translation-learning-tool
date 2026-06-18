import { useEffect, useState } from 'react';
import { api, type Profile } from './api';

// The user's profile drives language coding (typeface) and TTS language across
// every screen. Falls back to owner defaults (native en / target id) if it can't
// load, so the UI never hard-blocks on this.
export function useProfile() {
  const [profile, setProfile] = useState<Profile>({
    id: 'me',
    display_name: 'you',
    native_lang: 'en',
    target_lang: 'id',
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .me()
      .then((p) => {
        if (alive) setProfile(p);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { profile, loaded };
}

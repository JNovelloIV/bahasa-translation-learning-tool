import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type Profile } from './api';

const OWNER_DEFAULT: Profile = { id: 'me', display_name: 'you', native_lang: 'en', target_lang: 'id' };

// The profile drives language coding (typeface) + TTS, and tells us whether the
// user is authenticated (a 401 from /me means show the login screen).
export function useProfile() {
  const [profile, setProfile] = useState<Profile>(OWNER_DEFAULT);
  const [authed, setAuthed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const p = await api.me();
      setProfile(p);
      setAuthed(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setAuthed(false);
      // other errors: leave authed as-is (transient); UI shows login if never authed
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { profile, authed, loaded, reload };
}

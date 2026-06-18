import { useState } from 'react';
import { api, LANG_NAME, type Profile } from '../lib/api';

interface Props {
  profile: Profile;
  onClose: () => void;
  onLoggedOut: () => void;
}

// Bottom sheet for account controls (new-feature surface, reused by later phases).
export function Settings({ profile, onClose, onLoggedOut }: Props) {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await api.logout();
    } catch {
      /* ignore — clear locally regardless */
    } finally {
      onLoggedOut();
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'absolute', inset: 0, background: 'rgba(20,14,6,.42)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', background: 'var(--surface)', borderRadius: '26px 26px 0 0', padding: '14px 22px 30px', animation: 'sheetUp .32s cubic-bezier(.2,.8,.2,1) both', display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <div style={{ width: 38, height: 5, borderRadius: 99, background: 'var(--line)', alignSelf: 'center' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span className="id" style={{ fontSize: 26, fontWeight: 600, color: 'var(--ink)' }}>{profile.display_name}</span>
          <span className="en" style={{ fontSize: 13, color: 'var(--muted)' }}>
            Learning {LANG_NAME[profile.target_lang]} · from {LANG_NAME[profile.native_lang]}
          </span>
        </div>

        <button
          onClick={signOut}
          disabled={busy}
          className="en"
          style={{ width: '100%', height: 50, background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 15, fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
        >
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}

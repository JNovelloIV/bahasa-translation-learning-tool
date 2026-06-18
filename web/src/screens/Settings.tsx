import { useEffect, useState } from 'react';
import { api, LANG_NAME, type Profile, type UsageResponse } from '../lib/api';

interface Props {
  profile: Profile;
  onClose: () => void;
  onLoggedOut: () => void;
}

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

// Bottom sheet for account controls (new-feature surface, reused by later phases).
export function Settings({ profile, onClose, onLoggedOut }: Props) {
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<UsageResponse | null>(null);

  useEffect(() => {
    api.usage().then(setUsage).catch(() => {});
  }, []);

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          <span className="en" style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600 }}>
            Spend
          </span>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="en" style={{ fontSize: 14, color: 'var(--muted)' }}>Today</span>
            <span className="en" style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>
              {usage ? usd(usage.today.cost_usd) : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="en" style={{ fontSize: 14, color: 'var(--muted)' }}>This month</span>
            <span className="en" style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>
              {usage ? usd(usage.month.cost_usd) : '—'}
            </span>
          </div>
          {usage && (
            <span className="en" style={{ fontSize: 11, color: 'var(--faint)' }}>
              {usage.month.calls} calls this month · {(usage.month.input_tokens + usage.month.output_tokens).toLocaleString()} tokens
            </span>
          )}
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

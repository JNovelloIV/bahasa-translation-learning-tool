import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { MoonIcon, SunIcon } from '../lib/icons';

const SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY;

interface Props {
  dark: boolean;
  toggleDark: () => void;
  onLoggedIn: () => void;
}

// Optional Cloudflare Turnstile. Inert unless VITE_TURNSTILE_SITEKEY is set.
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; theme?: string }) => void;
    };
  }
}

export function Login({ dark, toggleDark, onLoggedIn }: Props) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITEKEY) return;
    const id = 'cf-turnstile-script';
    function render() {
      if (window.turnstile && widgetRef.current && !widgetRef.current.hasChildNodes()) {
        window.turnstile.render(widgetRef.current, {
          sitekey: SITEKEY!,
          theme: dark ? 'dark' : 'light',
          callback: (t) => setToken(t),
        });
      }
    }
    if (!document.getElementById(id)) {
      const s = document.createElement('script');
      s.id = id;
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      s.async = true;
      s.onload = render;
      document.head.appendChild(s);
    } else {
      render();
    }
  }, [dark]);

  async function submit() {
    if (!name.trim() || !pin.trim() || busy) return;
    if (SITEKEY && !token) {
      setError('Please complete the verification.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.login(name.trim(), pin, token || undefined);
      onLoggedIn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '54px 28px 40px', position: 'relative' }}>
      <button
        onClick={toggleDark}
        style={{ position: 'absolute', top: 54, right: 24, width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {dark ? <MoonIcon /> : <SunIcon />}
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
        <span className="id" style={{ fontSize: 40, fontWeight: 600, color: 'var(--ink)', letterSpacing: '.2px' }}>Sehari</span>
        <span className="en" style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          message · remember
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="username"
            className="en"
            style={inputStyle}
          />
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="PIN (6+ digits)"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            className="en"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            style={inputStyle}
          />
          {SITEKEY && <div ref={widgetRef} style={{ minHeight: 65 }} />}
          {error && <span className="en" style={{ fontSize: 13, color: 'var(--accent)' }}>{error}</span>}
        </div>
      </div>

      <button
        onClick={submit}
        disabled={busy || !name.trim() || pin.length < 6}
        className="en"
        style={{ width: '100%', height: 54, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 17, fontSize: 16, fontWeight: 600, cursor: 'pointer', opacity: busy || !name.trim() || pin.length < 6 ? 0.55 : 1 }}
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="en" style={{ textAlign: 'center', fontSize: 12, color: 'var(--faint)', margin: '12px 0 0' }}>
        Ask the owner to set up your name and PIN.
      </p>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface-2)',
  border: '1px solid var(--line)',
  borderRadius: 14,
  padding: '14px 16px',
  fontSize: 16,
  color: 'var(--ink)',
  outline: 'none',
};

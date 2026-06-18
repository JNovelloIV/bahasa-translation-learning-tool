import { useEffect, useState } from 'react';
import { api, type Profile, type SnippetResponse } from '../lib/api';
import { speaker } from '../lib/audio';
import { SpeakerIcon } from '../lib/icons';

// "Today's snippet" — one short dose of comprehensible input in the target
// language. Tap to reveal the native-language gloss; audio in the target voice.
// Cached server-side per day, so it doesn't regenerate on refresh.
export function SnippetCard({ profile }: { profile: Profile }) {
  const [snippet, setSnippet] = useState<SnippetResponse | null>(null);
  const [revealed, setRevealed] = useState(false);
  const T = profile.target_lang;
  const N = profile.native_lang;

  useEffect(() => {
    let alive = true;
    api
      .dailySnippet()
      .then((s) => alive && setSnippet(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!snippet || snippet.empty || !snippet.text) return null;

  return (
    <div
      onClick={() => setRevealed((v) => !v)}
      style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="en" style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600 }}>
          Today’s snippet
        </span>
        {speaker.supported && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              speaker.speak(snippet.text!.replace(/\n/g, '. '), T);
            }}
            aria-label="Play snippet"
            style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <SpeakerIcon size={16} big={false} />
          </button>
        )}
      </div>

      <span className={T} style={{ fontSize: 18, lineHeight: 1.45, color: 'var(--ink)', whiteSpace: 'pre-line' }}>
        {snippet.text}
      </span>

      {revealed ? (
        <span className={N} style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
          {snippet.gloss}
        </span>
      ) : (
        <span className="en" style={{ fontSize: 12, color: 'var(--faint)' }}>Tap to reveal the translation</span>
      )}
    </div>
  );
}

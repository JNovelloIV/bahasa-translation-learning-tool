import { useState } from 'react';
import { api, LANG_NAME, type LangCode, type Profile, type TranslateResponse, type WordsResponse } from '../lib/api';
import { speaker } from '../lib/audio';
import { MoonIcon, SunIcon, CopyIcon, SpeakerIcon, ShareIcon, CheckIcon, GearIcon } from '../lib/icons';

interface Props {
  deck: WordsResponse | null;
  dueCount: number;
  dark: boolean;
  toggleDark: () => void;
  refresh: () => Promise<void> | void;
  toast: (t: string) => void;
  profile: Profile;
  onSettings: () => void;
  goReview: () => void;
}

interface Gloss {
  b: string;
  e: string;
}
interface Result {
  dirLabel: string;
  target: string;
  source: string;
  targetClass: LangCode;
  sourceClass: LangCode;
  gloss: Gloss[];
  literal: string;
  grammar: string;
  saved: Gloss[];
  speakText: string;
  speakLang: LangCode;
  harvested: number;
}

const ID_MARKERS = [
  'saya', 'kamu', 'terima kasih', 'tolong', 'bisa', 'besok', 'rapat', 'laporan',
  'kirim', 'pagi', 'hari ini', 'selesai', 'mari', 'sebelum', 'yang', 'dan', 'di',
];
function detectLang(t: string): LangCode {
  const n = ' ' + t.toLowerCase().replace(/[^a-z0-9\s']/g, '') + ' ';
  return ID_MARKERS.some((m) => n.includes(' ' + m + ' ')) ? 'id' : 'en';
}

// Build the display result generically from the user's native/target languages.
function toResult(r: TranslateResponse, submitted: string, native: LangCode, target: LangCode): Result {
  const detected = r.detected_lang as LangCode;
  const naturalLang: LangCode = detected === native ? target : native; // natural is the other side
  const targetIsSource = detected === target;
  return {
    dirLabel: `${LANG_NAME[detected]} → ${LANG_NAME[naturalLang]}`,
    target: r.natural,
    source: submitted,
    targetClass: naturalLang,
    sourceClass: detected,
    // b = target-language phrase, e = native-language phrase
    gloss: r.gloss.map((g) => ({
      b: targetIsSource ? g.src : g.tgt,
      e: targetIsSource ? g.tgt : g.src,
    })),
    literal: r.back_translation,
    grammar: r.grammar_note,
    saved: r.items.map((it) => ({ b: it.lemma, e: it.gloss_l1 })),
    // Speaker plays the TARGET-language side regardless of direction.
    speakText: targetIsSource ? submitted : r.natural,
    speakLang: target,
    harvested: r.harvested,
  };
}

const QUICK_PHRASES = [
  'Can you finish the report by Friday?',
  'Thanks for your hard work today',
  "Let's meet tomorrow morning",
  'Tolong kirim laporannya hari ini',
];

export function Compose({ dueCount, dark, toggleDark, refresh, toast, profile, onSettings, goReview }: Props) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [glossOpen, setGlossOpen] = useState(false);
  const [literalOpen, setLiteralOpen] = useState(false);
  const [grammarOpen, setGrammarOpen] = useState(false);

  async function translate(text?: string) {
    const t = (text ?? input).trim();
    if (!t || loading) return;
    setLoading(true);
    setError('');
    setGlossOpen(false);
    setLiteralOpen(false);
    setGrammarOpen(false);
    try {
      const r = await api.translate(t);
      const res = toResult(r, t, profile.native_lang, profile.target_lang);
      setResult(res);
      if (res.harvested > 0) toast(`Saved — ${res.harvested} added to your deck`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Translation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function loadPhrase(p: string) {
    setInput(p);
    translate(p);
  }

  function copy() {
    if (!result) return;
    try {
      navigator.clipboard?.writeText(result.target);
    } catch {
      /* ignore */
    }
    toast('Copied to clipboard');
  }

  const detected = input.trim() ? detectLang(input) : null;
  const detectedLabel = detected ? `Detected · ${LANG_NAME[detected]}` : 'Auto-detect';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '54px 20px 12px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span className="id" style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: '.2px' }}>
            Sehari
          </span>
          <span
            className="en"
            style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--faint)', marginTop: 4 }}
          >
            message · remember
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={goReview}
            className="en"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              border: 'none',
              borderRadius: 999,
              padding: '8px 13px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'block' }} />
            {dueCount} due
          </button>
          <button
            onClick={toggleDark}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--surface-2)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {dark ? <MoonIcon /> : <SunIcon />}
          </button>
          <button
            onClick={onSettings}
            aria-label="Settings"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--surface-2)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GearIcon />
          </button>
        </div>
      </div>

      {/* Result scroll area */}
      <div
        className="noscroll"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 16px 10px', display: 'flex', flexDirection: 'column', gap: 13 }}
      >
        {error && (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              padding: '14px 16px',
              color: 'var(--accent)',
            }}
            className="en"
          >
            {error}
          </div>
        )}

        {result && (
          <>
            {/* Translation card */}
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 22,
                padding: '17px 18px 14px',
                boxShadow: '0 1px 2px rgba(40,25,10,.04),0 10px 26px rgba(40,25,10,.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  className="en"
                  style={{ fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600 }}
                >
                  {result.dirLabel}
                </span>
              </div>
              <div style={{ marginTop: 11 }}>
                <span className={result.targetClass} style={{ fontSize: 27, lineHeight: 1.24, fontWeight: 500, color: 'var(--ink)' }}>
                  {result.target}
                </span>
              </div>
              <div style={{ marginTop: 9 }}>
                <span className={result.sourceClass} style={{ fontSize: 15, lineHeight: 1.4, color: 'var(--muted)' }}>
                  {result.source}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  onClick={copy}
                  className="en"
                  style={{
                    flex: 1,
                    height: 46,
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 14,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <CopyIcon />
                  Copy
                </button>
                <button onClick={() => speaker.speak(result.speakText, result.speakLang)} style={iconBtn}>
                  <SpeakerIcon />
                </button>
                <button onClick={() => toast('Shared')} style={iconBtn}>
                  <ShareIcon />
                </button>
              </div>
            </div>

            {/* Deposit confirmation card */}
            {result.saved.length > 0 && (
              <div
                style={{
                  background: 'var(--good-soft)',
                  border: '1px solid var(--good)',
                  borderRadius: 16,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  animation: 'depo .4s ease both',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckIcon />
                  <span className="en" style={{ fontSize: 13, fontWeight: 600, color: 'var(--good)', whiteSpace: 'nowrap' }}>
                    {result.harvested || result.saved.length} added to your deck
                  </span>
                  <span className="en" style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    · in queue
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {result.saved.map((w, i) => (
                    <span
                      key={i}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'baseline',
                        gap: 6,
                        background: 'var(--surface)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        padding: '5px 9px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span className="id" style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>
                        {w.b}
                      </span>
                      <span className="en" style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {w.e}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Expandable detail group */}
            <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', background: 'var(--surface)' }}>
              <DetailRow label="Word by word" open={glossOpen} onToggle={() => setGlossOpen((v) => !v)}>
                <div style={{ padding: '2px 16px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {result.gloss.map((g, i) => (
                    <div
                      key={i}
                      style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, borderBottom: '1px dotted var(--line)', paddingBottom: 7 }}
                    >
                      <span className="id" style={{ fontSize: 17, color: 'var(--ink)', fontWeight: 500 }}>
                        {g.b}
                      </span>
                      <span className="en" style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'right' }}>
                        {g.e}
                      </span>
                    </div>
                  ))}
                </div>
              </DetailRow>

              {result.literal && (
                <div style={{ borderTop: '1px solid var(--line)' }}>
                  <DetailRow label="Literal meaning" open={literalOpen} onToggle={() => setLiteralOpen((v) => !v)}>
                    <div style={{ padding: '2px 16px 15px' }}>
                      <span className="en" style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--muted)', fontStyle: 'italic' }}>
                        “{result.literal}”
                      </span>
                    </div>
                  </DetailRow>
                </div>
              )}

              {result.grammar && (
                <div style={{ borderTop: '1px solid var(--line)' }}>
                  <DetailRow label="Grammar note" open={grammarOpen} onToggle={() => setGrammarOpen((v) => !v)}>
                    <div style={{ padding: '2px 16px 15px' }}>
                      <span className="en" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--muted)' }}>
                        {result.grammar}
                      </span>
                    </div>
                  </DetailRow>
                </div>
              )}
            </div>
          </>
        )}

        {!result && !error && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '40px 20px', textAlign: 'center' }}>
            <span className="id" style={{ fontSize: 22, color: 'var(--ink)' }}>
              Apa kabar?
            </span>
            <span className="en" style={{ fontSize: 13, color: 'var(--muted)' }}>
              Type a message below and translate it.
            </span>
          </div>
        )}
      </div>

      {/* Input dock */}
      <div style={{ flex: 'none', padding: '10px 14px 26px', borderTop: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div className="noscroll" style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 1 }}>
          {QUICK_PHRASES.map((p) => (
            <button
              key={p}
              onClick={() => loadPhrase(p)}
              className="en chip"
              style={{ flex: 'none', border: 'none', borderRadius: 999, padding: '7px 12px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {p.length > 26 ? p.slice(0, 24) + '…' : p}
            </button>
          ))}
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type in English or Bahasa…"
          rows={2}
          className="en"
          style={{ width: '100%', resize: 'none', border: '1px solid var(--line)', background: 'var(--surface-2)', borderRadius: 16, padding: '12px 14px', fontSize: 16, lineHeight: 1.35, color: 'var(--ink)', outline: 'none' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="en" style={{ fontSize: 12, color: 'var(--faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'block' }} />
            {detectedLabel}
          </span>
          <button
            onClick={() => translate()}
            disabled={loading || !input.trim()}
            className="en"
            style={{
              background: 'var(--ink)',
              color: 'var(--bg)',
              border: 'none',
              borderRadius: 14,
              padding: '12px 22px',
              fontSize: 15,
              fontWeight: 600,
              cursor: loading || !input.trim() ? 'default' : 'pointer',
              opacity: loading || !input.trim() ? 0.55 : 1,
            }}
          >
            {loading ? 'Translating…' : 'Translate'}
          </button>
        </div>
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 46,
  height: 46,
  background: 'var(--surface-2)',
  border: 'none',
  borderRadius: 14,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function DetailRow({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <button
        onClick={onToggle}
        className="en"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 16px', width: '100%' }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--faint)' }}>{open ? '−' : '+'}</span>
      </button>
      {open && children}
    </>
  );
}

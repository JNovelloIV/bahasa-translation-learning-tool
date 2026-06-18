import { useState } from 'react';
import { api, type TranslateResponse } from '../lib/api';
import { speaker } from '../lib/audio';

export function Compose() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TranslateResponse | null>(null);
  const [submitted, setSubmitted] = useState('');
  const [copied, setCopied] = useState(false);

  async function onTranslate() {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      const r = await api.translate(text.trim());
      setSubmitted(text.trim());
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Translation failed');
    } finally {
      setLoading(false);
    }
  }

  async function copyNatural() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.natural);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }

  return (
    <main className="screen">
      <div className="card">
        <h3>Message</h3>
        <textarea
          rows={3}
          placeholder="Type English or Bahasa Indonesia…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="primary" onClick={onTranslate} disabled={loading || !text.trim()}>
            {loading ? 'Translating…' : 'Translate'}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      {result && (
        <>
          <div className="card">
            <h3>{result.detected_lang === 'en' ? 'English → Bahasa' : 'Bahasa → English'}</h3>
            <div className="natural">{result.natural}</div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="primary" onClick={copyNatural}>
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
              {speaker.supported && (
                <button onClick={() => speaker.speak(bahasaText(result, submitted))}>
                  🔊 Play
                </button>
              )}
            </div>
            {result.harvested > 0 && (
              <p className="small muted" style={{ marginTop: 8 }}>
                +{result.harvested} item{result.harvested === 1 ? '' : 's'} added to your deck
              </p>
            )}
          </div>

          {result.gloss.length > 0 && (
            <div className="card">
              <h3>Phrase by phrase</h3>
              {result.gloss.map((g, i) => (
                <div className="gloss-row" key={i}>
                  <span className="muted">{g.src}</span>
                  <span>{g.tgt}</span>
                </div>
              ))}
            </div>
          )}

          {result.back_translation && (
            <div className="card">
              <h3>Literal back-translation</h3>
              <p className="small">{result.back_translation}</p>
            </div>
          )}

          {result.grammar_note && (
            <div className="card">
              <h3>Grammar note</h3>
              <p className="small">{result.grammar_note}</p>
            </div>
          )}

          {result.items.length > 0 && (
            <div className="card">
              <h3>Learnable items</h3>
              {result.items.map((it, i) => (
                <div className="itemline" key={i}>
                  <div>
                    <span className="lemma">{it.lemma}</span>{' '}
                    <span className={`pill ${it.type}`}>{it.type}</span>
                    <div className="small muted">{it.gloss_en}</div>
                    {it.root && (
                      <div className="small muted">
                        root: {it.root}
                        {it.affixes.length > 0 && ` · ${it.affixes.join(', ')}`}
                      </div>
                    )}
                  </div>
                  {speaker.supported && (
                    <button className="iconbtn" onClick={() => speaker.speak(it.lemma)}>
                      🔊
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

// The Bahasa side to speak: the translation when input was English, else the
// original Bahasa input (so the id-ID voice never reads the English output).
function bahasaText(r: TranslateResponse, original: string): string {
  return r.detected_lang === 'en' ? r.natural : original;
}

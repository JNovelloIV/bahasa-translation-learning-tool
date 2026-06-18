import { useState } from 'react';
import { api, weekday, LANG_NAME, type Profile, type ReviewCard, type WordsResponse } from '../lib/api';
import { speaker } from '../lib/audio';
import { CloseIcon, SpeakerIcon, CheckIcon } from '../lib/icons';

interface Props {
  deck: WordsResponse | null;
  dueCount: number;
  refresh: () => Promise<void> | void;
  refreshActivity: () => Promise<void> | void;
  toast: (t: string) => void;
  profile: Profile;
  goCompose: () => void;
}

type Stage = 'hero' | 'active' | 'done';

const GRADES = [
  { key: 'again', label: 'Again', sub: '<1m' },
  { key: 'hard', label: 'Hard', sub: '2d' },
  { key: 'good', label: 'Good', sub: '4d' },
  { key: 'easy', label: 'Easy', sub: '9d' },
] as const;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ').trim();

export function Review({ deck, dueCount, refresh, refreshActivity, toast, profile, goCompose }: Props) {
  const N = profile.native_lang; // cue typeface/language
  const T = profile.target_lang; // answer typeface/language
  const targetName = LANG_NAME[T];

  const kickerFor = (t: ReviewCard['card_type']) =>
    t === 'recall'
      ? `Say it in ${targetName}`
      : t === 'cloze'
        ? 'Fill the blank'
        : t === 'listen'
          ? 'Listen & recall'
          : `Write it in ${targetName}`;

  const [stage, setStage] = useState<Stage>('hero');
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [attempt, setAttempt] = useState('');
  const [doneCount, setDoneCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; corrected: string; feedback: string } | null>(null);

  const card = cards[idx];
  const total = cards.length;
  const progressPct = total ? Math.round((idx / total) * 100) : 0;
  const attemptMatch = card ? norm(attempt) === norm(card.b) && norm(attempt).length > 0 : false;

  async function begin() {
    setBusy(true);
    try {
      const r = await api.queue();
      setCards(r.cards);
      setIdx(0);
      setRevealed(false);
      setAttempt('');
      setFeedback(null);
      setDoneCount(0);
      setStage(r.cards.length ? 'active' : 'hero');
      if (!r.cards.length) toast('Nothing due right now');
    } catch {
      toast('Could not load review');
    } finally {
      setBusy(false);
    }
  }

  function advance() {
    setRevealed(false);
    setAttempt('');
    setFeedback(null);
    if (idx + 1 >= total) {
      setStage('done');
      refresh();
    } else {
      setIdx(idx + 1);
    }
  }

  async function grade(key: string) {
    if (!card || busy) return;
    setBusy(true);
    setDoneCount((n) => n + 1);
    try {
      await api.grade(card.item_id, key, card.card_type);
      refreshActivity();
    } catch {
      toast('Grade failed');
    } finally {
      setBusy(false);
      advance();
    }
  }

  async function checkProduce() {
    if (!card || !attempt.trim() || busy) return;
    setBusy(true);
    try {
      const r = await api.produce(card.item_id, attempt.trim(), card.prompt);
      setFeedback({ correct: r.correct, corrected: r.corrected, feedback: r.feedback });
      setRevealed(true);
      setDoneCount((n) => n + 1);
      refreshActivity();
    } catch {
      toast('Could not check');
    } finally {
      setBusy(false);
    }
  }

  // ---------- HERO ----------
  if (stage === 'hero') {
    const preview = (deck?.all ?? []).filter((d) => d.is_due).slice(0, 4);
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 'none', padding: '54px 24px 0' }}>
          <span className="en" style={kicker}>Review</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="id" style={{ fontSize: 104, lineHeight: 0.82, fontWeight: 500, color: 'var(--accent)', letterSpacing: '-2px' }}>
              {dueCount}
            </span>
            <span className="id" style={{ fontSize: 30, lineHeight: 1, fontWeight: 500, color: 'var(--ink)', marginTop: 10 }}>
              words due today
            </span>
            <span className="en" style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>
              From messages you sent this week.
            </span>
          </div>
          {preview.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, borderTop: '1px solid var(--line)', paddingTop: 18 }}>
              {preview.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span className={T} style={{ fontSize: 18, color: 'var(--ink)', fontWeight: 500, minWidth: 96 }}>{p.b}</span>
                  <span className={N} style={{ fontSize: 13, color: 'var(--faint)' }}>{p.e}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: 'none', padding: '14px 20px 28px' }}>
          <button onClick={begin} disabled={busy || dueCount === 0} className="en" style={{ ...primaryBtn, opacity: busy || dueCount === 0 ? 0.55 : 1 }}>
            {busy ? 'Loading…' : 'Begin review'}
          </button>
          <p className="en" style={{ textAlign: 'center', fontSize: 12, color: 'var(--faint)', margin: '11px 0 0' }}>
            Recall first — the answer comes after you try.
          </p>
        </div>
      </div>
    );
  }

  // ---------- DONE ----------
  if (stage === 'done') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px', gap: 16 }}>
          <span className="id" style={{ fontSize: 58, lineHeight: 0.95, fontWeight: 500, color: 'var(--accent)' }}>Selesai.</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="id" style={{ fontSize: 24, color: 'var(--ink)', fontWeight: 500 }}>Done for today</span>
            <span className="en" style={{ fontSize: 14, color: 'var(--muted)' }}>
              {doneCount} review{doneCount === 1 ? '' : 's'} done — see you tomorrow.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 18 }}>
            {Array.from({ length: doneCount }).map((_, i) => (
              <span key={i} style={{ width: 18, height: 6, borderRadius: 99, background: 'var(--accent)', display: 'block' }} />
            ))}
          </div>
          <span className="en" style={{ fontSize: 12, color: 'var(--faint)' }}>
            Each one came from a message you actually sent.
          </span>
        </div>
        <div style={{ flex: 'none', padding: '14px 20px 28px' }}>
          <button onClick={() => { setStage('hero'); goCompose(); }} className="en" style={{ ...primaryBtn, background: 'var(--ink)', color: 'var(--bg)' }}>
            Back to messages
          </button>
        </div>
      </div>
    );
  }

  // ---------- ACTIVE ----------
  if (!card) return null;
  const isProduce = card.card_type === 'produce';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 'none', padding: '50px 20px 8px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setStage('hero')} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloseIcon />
          </button>
          <span className="en" style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>{idx + 1} / {total}</span>
          <span style={{ width: 34 }} />
        </div>
        <div style={{ height: 4, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 99, background: 'var(--accent)', width: `${progressPct}%`, transition: 'width .35s ease' }} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: '26px 22px', boxShadow: '0 1px 2px rgba(40,25,10,.04),0 14px 34px rgba(40,25,10,.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="en" style={kicker}>{kickerFor(card.card_type)}</span>

          {/* Prompt area varies by card type. Cloze shows the target sentence;
              listen plays the target audio; recall/produce show the native cue. */}
          {card.card_type === 'cloze' ? (
            <span className={T} style={{ fontSize: 26, lineHeight: 1.25, fontWeight: 500, color: 'var(--ink)', marginTop: 6 }}>{card.cloze}</span>
          ) : card.card_type === 'listen' ? (
            <button onClick={() => speaker.speak(card.b, T)} className="en" style={{ marginTop: 8, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: 'none', borderRadius: 14, padding: '12px 16px', cursor: 'pointer', color: 'var(--ink)', fontSize: 15, fontWeight: 600 }}>
              <SpeakerIcon /> Play audio
            </button>
          ) : (
            <span className={N} style={{ fontSize: 36, lineHeight: 1.1, fontWeight: 600, color: 'var(--ink)', marginTop: 6 }}>{card.prompt}</span>
          )}

          <span className={card.card_type === 'cloze' || card.card_type === 'listen' ? N : 'en'} style={{ fontSize: 13, color: 'var(--muted)' }}>
            {card.card_type === 'cloze' || card.card_type === 'listen' ? card.prompt : card.pos}
          </span>
          {card.source_date && (
            <span className="en" style={{ fontSize: 12, color: 'var(--faint)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              from your message · {weekday(card.source_date)}
            </span>
          )}

          {/* Input before reveal — the learner produces the TARGET language */}
          {!revealed && !isProduce && (
            <input
              value={attempt}
              onChange={(e) => setAttempt(e.target.value)}
              placeholder="type your answer (optional)"
              className={T}
              style={{ marginTop: 16, width: '100%', border: 'none', borderBottom: '1.5px solid var(--line)', background: 'none', padding: '8px 2px', fontSize: 20, color: 'var(--ink)', outline: 'none' }}
            />
          )}
          {!revealed && isProduce && (
            <textarea
              value={attempt}
              onChange={(e) => setAttempt(e.target.value)}
              placeholder={`write the full sentence in ${targetName}…`}
              rows={2}
              className={T}
              style={{ marginTop: 16, width: '100%', resize: 'none', border: '1px solid var(--line)', background: 'var(--surface-2)', borderRadius: 12, padding: '10px 12px', fontSize: 18, color: 'var(--ink)', outline: 'none' }}
            />
          )}

          {/* Reveal block */}
          {revealed && (
            <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12, animation: 'rev .3s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className={T} style={{ fontSize: 32, lineHeight: 1, fontWeight: 500, color: 'var(--ink)' }}>{card.b}</span>
                <button onClick={() => speaker.speak(card.b, T)} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SpeakerIcon size={16} big={false} />
                </button>
                {attemptMatch && !isProduce && (
                  <span className="en" style={{ fontSize: 12, fontWeight: 600, color: 'var(--good)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckIcon size={13} strokeWidth={2.6} /> you got it
                  </span>
                )}
              </div>

              {isProduce && feedback && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="en" style={{ fontSize: 13, fontWeight: 600, color: feedback.correct ? 'var(--good)' : 'var(--accent)' }}>
                    {feedback.correct ? '✓ Correct' : 'Not quite'}
                  </span>
                  <span className="en" style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>{feedback.feedback}</span>
                </div>
              )}

              {(card.example_b || card.example_e) && (
                <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {card.example_b && <span className={T} style={{ fontSize: 16, color: 'var(--ink)' }}>{card.example_b}</span>}
                  {card.example_e && <span className={N} style={{ fontSize: 12.5, color: 'var(--muted)' }}>{card.example_e}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom dock */}
      <div style={{ flex: 'none', padding: '12px 18px 28px' }}>
        {!revealed && !isProduce && (
          <button onClick={() => setRevealed(true)} className="en" style={primaryBtn}>Reveal answer</button>
        )}
        {!revealed && isProduce && (
          <button onClick={checkProduce} disabled={busy || !attempt.trim()} className="en" style={{ ...primaryBtn, opacity: busy || !attempt.trim() ? 0.55 : 1 }}>
            {busy ? 'Checking…' : 'Check'}
          </button>
        )}
        {revealed && isProduce && (
          <button onClick={advance} className="en" style={primaryBtn}>Next</button>
        )}
        {revealed && !isProduce && (
          <div style={{ display: 'flex', gap: 7 }}>
            {GRADES.map((g) => (
              <button key={g.key} onClick={() => grade(g.key)} disabled={busy} className="en" style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '11px 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{g.label}</span>
                <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{g.sub}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const kicker: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color: 'var(--faint)',
  fontWeight: 600,
};

const primaryBtn: React.CSSProperties = {
  width: '100%',
  height: 54,
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 17,
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
};

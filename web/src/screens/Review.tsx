import { useEffect, useState } from 'react';
import { api, type ReviewCard } from '../lib/api';
import { speaker } from '../lib/audio';

const GRADES: Array<{ id: 'again' | 'hard' | 'good' | 'easy'; label: string }> = [
  { id: 'again', label: 'Again' },
  { id: 'hard', label: 'Hard' },
  { id: 'good', label: 'Good' },
  { id: 'easy', label: 'Easy' },
];

export function Review() {
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

  // free-production state
  const [attempt, setAttempt] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; corrected: string; feedback: string } | null>(
    null,
  );

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await api.queue();
      setCards(r.cards);
      setIdx(0);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load queue');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function reset() {
    setRevealed(false);
    setAttempt('');
    setFeedback(null);
  }

  function next() {
    reset();
    setIdx((i) => i + 1);
  }

  const card = cards[idx];

  async function grade(rating: 'again' | 'hard' | 'good' | 'easy') {
    if (!card) return;
    setBusy(true);
    try {
      await api.grade(card.item_id, rating, card.card_type);
      next();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Grade failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitProduce() {
    if (!card || !attempt.trim()) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.produce(card.item_id, attempt.trim(), card.gloss_en);
      setFeedback({ correct: r.correct, corrected: r.corrected, feedback: r.feedback });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not grade');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="screen"><p className="muted">Loading queue…</p></main>;
  if (error) {
    return (
      <main className="screen">
        <p className="error">{error}</p>
        <button onClick={load}>Retry</button>
      </main>
    );
  }
  if (cards.length === 0 || idx >= cards.length) {
    return (
      <main className="screen">
        <div className="card">
          <h3>All caught up</h3>
          <p className="muted">
            Nothing due right now. Keep messaging in Compose — the words you actually use surface
            less, and Review fills the gaps.
          </p>
          <button className="primary" onClick={load} style={{ marginTop: 10 }}>
            Refresh
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      <p className="small muted">
        Card {idx + 1} of {cards.length} · {label(card.card_type)} · used {card.use_count}×
      </p>

      <div className="card">
        {card.card_type === 'recall' && (
          <Recall card={card} revealed={revealed} onReveal={() => setRevealed(true)} />
        )}
        {card.card_type === 'cloze' && (
          <Cloze card={card} revealed={revealed} onReveal={() => setRevealed(true)} />
        )}
        {card.card_type === 'listen' && (
          <Listen card={card} revealed={revealed} onReveal={() => setRevealed(true)} />
        )}
        {card.card_type === 'produce' && (
          <Produce
            card={card}
            attempt={attempt}
            setAttempt={setAttempt}
            feedback={feedback}
            onSubmit={submitProduce}
            busy={busy}
          />
        )}
      </div>

      {/* Grading: produce auto-advances after feedback; others reveal then grade. */}
      {card.card_type !== 'produce' && revealed && (
        <div className="grades">
          {GRADES.map((g) => (
            <button key={g.id} className={g.id} disabled={busy} onClick={() => grade(g.id)}>
              {g.label}
            </button>
          ))}
        </div>
      )}
      {card.card_type === 'produce' && feedback && (
        <button className="primary" onClick={next}>
          Next →
        </button>
      )}
    </main>
  );
}

function Recall({ card, revealed, onReveal }: CardProps) {
  return (
    <>
      <h3>Produce in Bahasa</h3>
      <div className="natural">{card.gloss_en}</div>
      {revealed ? (
        <Answer card={card} />
      ) : (
        <button className="primary" style={{ marginTop: 12 }} onClick={onReveal}>
          Show answer
        </button>
      )}
    </>
  );
}

function Cloze({ card, revealed, onReveal }: CardProps) {
  return (
    <>
      <h3>Fill the blank</h3>
      <div className="natural">{card.cloze}</div>
      <p className="small muted" style={{ marginTop: 6 }}>
        ({card.gloss_en})
      </p>
      {revealed ? (
        <Answer card={card} />
      ) : (
        <button className="primary" style={{ marginTop: 12 }} onClick={onReveal}>
          Show answer
        </button>
      )}
    </>
  );
}

function Listen({ card, revealed, onReveal }: CardProps) {
  return (
    <>
      <h3>Listen &amp; recall</h3>
      {speaker.supported ? (
        <button className="primary" onClick={() => speaker.speak(card.lemma)}>
          🔊 Play audio
        </button>
      ) : (
        <p className="muted small">Audio not supported on this browser.</p>
      )}
      {revealed ? (
        <Answer card={card} />
      ) : (
        <button style={{ marginTop: 12 }} onClick={onReveal}>
          Show answer
        </button>
      )}
    </>
  );
}

function Produce({
  card,
  attempt,
  setAttempt,
  feedback,
  onSubmit,
  busy,
}: {
  card: ReviewCard;
  attempt: string;
  setAttempt: (s: string) => void;
  feedback: { correct: boolean; corrected: string; feedback: string } | null;
  onSubmit: () => void;
  busy: boolean;
}) {
  return (
    <>
      <h3>Write it in Bahasa</h3>
      <div className="natural">{card.gloss_en}</div>
      <textarea
        rows={2}
        style={{ marginTop: 10 }}
        placeholder="Your Bahasa sentence…"
        value={attempt}
        onChange={(e) => setAttempt(e.target.value)}
        disabled={!!feedback}
      />
      {!feedback && (
        <button
          className="primary"
          style={{ marginTop: 10 }}
          onClick={onSubmit}
          disabled={busy || !attempt.trim()}
        >
          {busy ? 'Checking…' : 'Check'}
        </button>
      )}
      {feedback && (
        <div style={{ marginTop: 10 }}>
          <p className={feedback.correct ? 'success' : 'error'}>
            {feedback.correct ? '✓ Correct' : '✗ Not quite'}
          </p>
          <p className="small">{feedback.feedback}</p>
          {feedback.corrected && (
            <p className="small muted">Model answer: {feedback.corrected}</p>
          )}
        </div>
      )}
    </>
  );
}

function Answer({ card }: { card: ReviewCard }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div className="natural">{card.lemma}</div>
      {card.root && (
        <p className="small muted">
          root: {card.root}
          {card.affixes.length > 0 && ` · ${card.affixes.join(', ')}`}
        </p>
      )}
      {card.example && <p className="small muted">e.g. {card.example}</p>}
      {speaker.supported && (
        <button className="iconbtn" style={{ marginTop: 8 }} onClick={() => speaker.speak(card.lemma)}>
          🔊 Hear it
        </button>
      )}
    </div>
  );
}

interface CardProps {
  card: ReviewCard;
  revealed: boolean;
  onReveal: () => void;
}

function label(t: string): string {
  return t === 'recall'
    ? 'Recall'
    : t === 'cloze'
      ? 'Cloze'
      : t === 'listen'
        ? 'Listening'
        : 'Free production';
}

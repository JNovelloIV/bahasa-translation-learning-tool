import { useEffect, useState } from 'react';
import { api, type StatsResponse } from '../lib/api';

export function Stats() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await api.stats());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load stats');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <main className="screen"><p className="muted">Loading…</p></main>;
  if (error)
    return (
      <main className="screen">
        <p className="error">{error}</p>
        <button onClick={load}>Retry</button>
      </main>
    );
  if (!data) return null;

  const retention = data.retention === null ? '—' : `${Math.round(data.retention * 100)}%`;

  return (
    <main className="screen">
      <div className="stat-grid">
        <div className="stat">
          <div className="num">{data.due_count}</div>
          <div className="lbl">Due now</div>
        </div>
        <div className="stat">
          <div className="num">{retention}</div>
          <div className="lbl">Retention</div>
        </div>
        <div className="stat">
          <div className="num">{data.total}</div>
          <div className="lbl">Total items</div>
        </div>
        <div className="stat">
          <div className="num">{data.mastered}</div>
          <div className="lbl">Mastered</div>
        </div>
      </div>

      <div className="card">
        <h3>About to forget ({data.about_to_forget_count})</h3>
        {data.about_to_forget.length === 0 ? (
          <p className="muted small">Nothing slipping right now. Nice.</p>
        ) : (
          data.about_to_forget.map((it) => (
            <div className="itemline" key={it.id}>
              <div>
                <span className="lemma">{it.lemma}</span>
                <div className="small muted">{it.gloss_en}</div>
              </div>
              <div className="small muted">{Math.round(it.retrievability * 100)}%</div>
            </div>
          ))
        )}
      </div>

      <p className="small muted">
        {data.reviews_graded} graded review{data.reviews_graded === 1 ? '' : 's'} so far.
      </p>
    </main>
  );
}

import { useState } from 'react';
import { nextLabel, type DeckItem, type Profile, type WordsResponse } from '../lib/api';
import { SearchIcon } from '../lib/icons';
import { StrengthMeter } from '../components/StrengthMeter';

interface Props {
  deck: WordsResponse | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void> | void;
  profile: Profile;
  openSheet: (it: DeckItem) => void;
}

type Filter = 'all' | 'due' | 'learning' | 'strong';
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'due', label: 'Due' },
  { key: 'learning', label: 'Learning' },
  { key: 'strong', label: 'Strong' },
];

const norm = (s: string) => s.toLowerCase().trim();

export function Words({ deck, loading, error, refresh, profile, openSheet }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const T = profile.target_lang;
  const N = profile.native_lang;

  const all = deck?.all ?? [];
  const q = norm(search);

  const list = all
    .filter((d) => {
      if (filter === 'due' && !d.is_due) return false;
      if (filter === 'learning' && d.strength > 2) return false;
      if (filter === 'strong' && d.strength < 4) return false;
      if (q && !(norm(d.b).includes(q) || norm(d.e).includes(q))) return false;
      return true;
    })
    .sort((a, b) => (a.is_due === b.is_due ? a.strength - b.strength : a.is_due ? -1 : 1));

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 'none', padding: '54px 20px 6px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span className="id" style={{ fontSize: 30, fontWeight: 600, color: 'var(--ink)' }}>Words</span>
          <span className="en" style={{ fontSize: 12, color: 'var(--faint)', whiteSpace: 'nowrap' }}>
            {deck?.total ?? 0} saved · {deck?.due_count ?? 0} due
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface-2)', borderRadius: 13, padding: '9px 12px' }}>
          <SearchIcon />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your words"
            className="en"
            style={{ flex: 1, border: 'none', background: 'none', fontSize: 15, color: 'var(--ink)', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`en chip${filter === f.key ? ' active' : ''}`}
              style={{ border: 'none', borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="noscroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 0 8px' }}>
        {loading && <Centered text="Loading your deck…" />}
        {error && !loading && <Centered text={error} accent onRetry={refresh} />}
        {!loading && !error && list.length === 0 && (
          <Centered text={all.length === 0 ? 'No words yet — translate a message to start your deck.' : 'No matches.'} />
        )}

        {list.map((d) => (
          <button
            key={d.id}
            onClick={() => openSheet(d)}
            style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', textAlign: 'left' }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className={T} style={{ fontSize: 19, color: 'var(--ink)', fontWeight: 500 }}>{d.b}</span>
              <span className={N} style={{ fontSize: 13, color: 'var(--muted)' }}>{d.e} · {d.pos}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
              <StrengthMeter value={d.strength} />
              {d.is_due ? (
                <span className="en" style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap' }}>Due now</span>
              ) : (
                <span className="en" style={{ fontSize: 11, color: 'var(--faint)' }}>{nextLabel(d.due, d.is_due)}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Centered({ text, accent, onRetry }: { text: string; accent?: boolean; onRetry?: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '60px 30px', textAlign: 'center' }}>
      <span className="en" style={{ fontSize: 14, color: accent ? 'var(--accent)' : 'var(--muted)' }}>{text}</span>
      {onRetry && (
        <button onClick={onRetry} className="en" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 16px', cursor: 'pointer', color: 'var(--ink)' }}>
          Retry
        </button>
      )}
    </div>
  );
}

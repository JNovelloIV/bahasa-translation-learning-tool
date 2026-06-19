import { PencilIcon, ReviewIcon, BookIcon } from '../lib/icons';

export type Tab = 'compose' | 'review' | 'words';

export function TabBar({
  tab,
  setTab,
  dueCount,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  dueCount: number;
}) {
  const btn: React.CSSProperties = {
    flex: 1,
    background: 'none',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
    padding: 6,
  };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600 };

  return (
    <div
      style={{
        flex: 'none',
        display: 'flex',
        background: 'var(--surface)',
        borderTop: '1px solid var(--line)',
        padding: '8px 8px 24px',
      }}
    >
      <button className={`tab${tab === 'compose' ? ' active' : ''}`} style={btn} onClick={() => setTab('compose')}>
        <PencilIcon />
        <span className="lbl en" style={lbl}>
          Compose
        </span>
      </button>

      <button
        className={`tab${tab === 'review' ? ' active' : ''}`}
        style={{ ...btn, position: 'relative' }}
        onClick={() => setTab('review')}
      >
        <div style={{ position: 'relative' }}>
          <ReviewIcon />
          {dueCount > 0 && (
            <span
              className="en"
              style={{
                position: 'absolute',
                top: -5,
                right: -9,
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 9.5,
                fontWeight: 700,
                minWidth: 16,
                height: 16,
                borderRadius: 99,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
              }}
            >
              {dueCount}
            </span>
          )}
        </div>
        <span className="lbl en" style={lbl}>
          Review
        </span>
      </button>

      <button className={`tab${tab === 'words' ? ' active' : ''}`} style={btn} onClick={() => setTab('words')}>
        <BookIcon />
        <span className="lbl en" style={lbl}>
          Words
        </span>
      </button>
    </div>
  );
}

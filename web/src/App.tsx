import { useCallback, useRef, useState } from 'react';
import { useDarkMode } from './lib/theme';
import { useDeck } from './lib/useDeck';
import { useProfile } from './lib/useProfile';
import type { DeckItem } from './lib/api';
import { Compose } from './screens/Compose';
import { Review } from './screens/Review';
import { Words } from './screens/Words';
import { WordSheet } from './screens/WordSheet';
import { Toast } from './components/Toast';
import { TabBar, type Tab } from './components/TabBar';

export function App() {
  const [dark, toggleDark] = useDarkMode();
  const [tab, setTab] = useState<Tab>('compose');
  const { deck, dueCount, loading, error, refresh } = useDeck();
  const { profile } = useProfile();

  const [sheetItem, setSheetItem] = useState<DeckItem | null>(null);
  const [toastText, setToastText] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const toast = useCallback((t: string) => {
    setToastText(t);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 1800);
  }, []);

  const frame: React.CSSProperties = {
    height: '100%',
    maxWidth: 440,
    margin: '0 auto',
    position: 'relative',
    overflow: 'hidden',
    background: 'var(--bg)',
    color: 'var(--ink)',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div className={`sehari ${dark ? 'dark' : ''}`} style={frame}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {tab === 'compose' && (
          <Compose
            deck={deck}
            dueCount={dueCount}
            dark={dark}
            toggleDark={toggleDark}
            refresh={refresh}
            toast={toast}
            profile={profile}
            goReview={() => setTab('review')}
          />
        )}
        {tab === 'review' && (
          <Review
            deck={deck}
            dueCount={dueCount}
            refresh={refresh}
            toast={toast}
            profile={profile}
            goCompose={() => setTab('compose')}
          />
        )}
        {tab === 'words' && (
          <Words
            deck={deck}
            loading={loading}
            error={error}
            refresh={refresh}
            profile={profile}
            openSheet={(it) => setSheetItem(it)}
          />
        )}
      </div>

      <TabBar tab={tab} setTab={setTab} dueCount={dueCount} />

      {sheetItem && (
        <WordSheet
          item={sheetItem}
          profile={profile}
          onClose={() => setSheetItem(null)}
          onReviewNow={() => {
            setSheetItem(null);
            setTab('review');
          }}
          toast={toast}
        />
      )}

      <Toast text={toastText} visible={toastVisible} />
    </div>
  );
}

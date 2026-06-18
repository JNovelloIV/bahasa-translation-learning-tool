import { useCallback, useRef, useState } from 'react';
import { useDarkMode } from './lib/theme';
import { useDeck } from './lib/useDeck';
import { useProfile } from './lib/useProfile';
import type { DeckItem } from './lib/api';
import { Compose } from './screens/Compose';
import { Review } from './screens/Review';
import { Words } from './screens/Words';
import { WordSheet } from './screens/WordSheet';
import { Login } from './screens/Login';
import { Settings } from './screens/Settings';
import { Toast } from './components/Toast';
import { TabBar, type Tab } from './components/TabBar';

export function App() {
  const [dark, toggleDark] = useDarkMode();
  const [tab, setTab] = useState<Tab>('compose');
  const { profile, authed, loaded, reload } = useProfile();
  const { deck, dueCount, loading, error, refresh } = useDeck(authed);

  const [sheetItem, setSheetItem] = useState<DeckItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  // Splash while we check the session.
  if (!loaded) {
    return <div className={`sehari ${dark ? 'dark' : ''}`} style={frame} />;
  }

  // Auth gate.
  if (!authed) {
    return (
      <div className={`sehari ${dark ? 'dark' : ''}`} style={frame}>
        <Login dark={dark} toggleDark={toggleDark} onLoggedIn={() => reload()} />
      </div>
    );
  }

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
            onSettings={() => setSettingsOpen(true)}
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

      {settingsOpen && (
        <Settings
          profile={profile}
          onClose={() => setSettingsOpen(false)}
          onLoggedOut={() => {
            setSettingsOpen(false);
            reload();
          }}
        />
      )}

      <Toast text={toastText} visible={toastVisible} />
    </div>
  );
}

import { useState } from 'react';
import { Compose } from './screens/Compose';
import { Review } from './screens/Review';
import { Words } from './screens/Words';
import { Stats } from './screens/Stats';

type Tab = 'compose' | 'review' | 'words' | 'stats';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'compose', label: 'Compose' },
  { id: 'review', label: 'Review' },
  { id: 'words', label: 'Words' },
  { id: 'stats', label: 'Stats' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('compose');

  return (
    <div className="app">
      <header className="topbar">
        <h1>Sehari</h1>
        <div className="sub">Translate today · learn from it</div>
      </header>

      {tab === 'compose' && <Compose />}
      {tab === 'review' && <Review />}
      {tab === 'words' && <Words />}
      {tab === 'stats' && <Stats />}

      <nav className="nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

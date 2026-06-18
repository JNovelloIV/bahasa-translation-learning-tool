import { useEffect, useState } from 'react';
import { api, type WordItem, type WordsResponse } from '../lib/api';
import { speaker } from '../lib/audio';

export function Words() {
  const [data, setData] = useState<WordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupByRoot, setGroupByRoot] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await api.words());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load words');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <main className="screen"><p className="muted">Loading corpus…</p></main>;
  if (error)
    return (
      <main className="screen">
        <p className="error">{error}</p>
        <button onClick={load}>Retry</button>
      </main>
    );
  if (!data || data.total === 0)
    return (
      <main className="screen">
        <div className="card">
          <h3>No words yet</h3>
          <p className="muted">Translate a few messages in Compose to start building your deck.</p>
        </div>
      </main>
    );

  return (
    <main className="screen">
      <div className="row">
        <button className={!groupByRoot ? 'primary' : ''} onClick={() => setGroupByRoot(false)}>
          By frequency
        </button>
        <button className={groupByRoot ? 'primary' : ''} onClick={() => setGroupByRoot(true)}>
          By root family
        </button>
      </div>

      <ItemGroup
        title={`Words (${data.words.length})`}
        items={data.words}
        groupByRoot={groupByRoot}
        expanded={expanded}
        setExpanded={setExpanded}
      />
      <ItemGroup
        title={`Phrases (${data.phrases.length})`}
        items={data.phrases}
        groupByRoot={groupByRoot}
        expanded={expanded}
        setExpanded={setExpanded}
      />
      {data.mastered.length > 0 && (
        <ItemGroup
          title={`Mastered (${data.mastered.length})`}
          items={data.mastered}
          groupByRoot={groupByRoot}
          expanded={expanded}
          setExpanded={setExpanded}
        />
      )}
    </main>
  );
}

function ItemGroup({
  title,
  items,
  groupByRoot,
  expanded,
  setExpanded,
}: {
  title: string;
  items: WordItem[];
  groupByRoot: boolean;
  expanded: string | null;
  setExpanded: (id: string | null) => void;
}) {
  if (items.length === 0) return null;

  if (groupByRoot) {
    const families = new Map<string, WordItem[]>();
    for (const it of items) {
      const key = it.root || '(no root)';
      families.set(key, [...(families.get(key) ?? []), it]);
    }
    const keys = [...families.keys()].sort();
    return (
      <div className="card">
        <h3>{title}</h3>
        {keys.map((root) => (
          <div key={root} style={{ marginBottom: 10 }}>
            <div className="section-title">root: {root}</div>
            {families.get(root)!.map((it) => (
              <ItemRow key={it.id} it={it} expanded={expanded} setExpanded={setExpanded} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="card">
      <h3>{title}</h3>
      {items.map((it) => (
        <ItemRow key={it.id} it={it} expanded={expanded} setExpanded={setExpanded} />
      ))}
    </div>
  );
}

function ItemRow({
  it,
  expanded,
  setExpanded,
}: {
  it: WordItem;
  expanded: string | null;
  setExpanded: (id: string | null) => void;
}) {
  const open = expanded === it.id;
  return (
    <div className="itemline" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div onClick={() => setExpanded(open ? null : it.id)} style={{ cursor: 'pointer', flex: 1 }}>
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
        <div style={{ textAlign: 'right' }}>
          <div className="small muted">{it.use_count}×</div>
          {speaker.supported && (
            <button className="iconbtn" onClick={() => speaker.speak(it.lemma)}>
              🔊
            </button>
          )}
        </div>
      </div>
      {open && it.sources.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="section-title">From your messages</div>
          {it.sources.slice(0, 5).map((s) => (
            <p className="small muted" key={s.sentence_id} style={{ margin: '4px 0' }}>
              “{s.lang === 'id' ? s.text : s.translation}”
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

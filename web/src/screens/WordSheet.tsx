import { nextLabel, weekday, type DeckItem } from '../lib/api';
import { speaker } from '../lib/audio';
import { SpeakerIcon } from '../lib/icons';
import { StrengthMeter } from '../components/StrengthMeter';

interface Props {
  item: DeckItem;
  onClose: () => void;
  onReviewNow: () => void;
  toast: (t: string) => void;
}

export function WordSheet({ item, onClose, onReviewNow }: Props) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'absolute', inset: 0, background: 'rgba(20,14,6,.42)', display: 'flex', alignItems: 'flex-end', zIndex: 40 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', background: 'var(--surface)', borderRadius: '26px 26px 0 0', padding: '14px 22px 30px', animation: 'sheetUp .32s cubic-bezier(.2,.8,.2,1) both', display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ width: 38, height: 5, borderRadius: 99, background: 'var(--line)', alignSelf: 'center' }} />

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className="id" style={{ fontSize: 34, lineHeight: 1, fontWeight: 500, color: 'var(--ink)' }}>{item.b}</span>
            <span className="en" style={{ fontSize: 15, color: 'var(--muted)' }}>{item.e} · {item.pos}</span>
          </div>
          <button onClick={() => speaker.speak(item.b)} style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface-2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SpeakerIcon />
          </button>
        </div>

        {(item.example_b || item.example_e) && (
          <div style={{ background: 'var(--surface-2)', borderRadius: 14, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {item.example_b && <span className="id" style={{ fontSize: 18, color: 'var(--ink)' }}>{item.example_b}</span>}
            {item.example_e && <span className="en" style={{ fontSize: 13, color: 'var(--muted)' }}>{item.example_e}</span>}
          </div>
        )}

        {item.source_msg && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span className="en" style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600 }}>
              First saved from
            </span>
            <span className="en" style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.45 }}>
              “{item.source_msg}” · {weekday(item.source_date)}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="en" style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600 }}>Memory</span>
            <StrengthMeter value={item.strength} w={20} h={5} />
          </div>
          <span className="en" style={{ fontSize: 13, color: 'var(--muted)' }}>
            {item.graduated ? 'mastered' : nextLabel(item.due, item.is_due)}
          </span>
        </div>

        <button onClick={onReviewNow} className="en" style={{ width: '100%', height: 50, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 15, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          Review now
        </button>
      </div>
    </div>
  );
}

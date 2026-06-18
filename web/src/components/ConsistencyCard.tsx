import type { ActivitySummary } from '../lib/api';

// Calm, typographic consistency widget (no casino gamification):
// today's active minutes filling toward yesterday's, reps as the honesty
// companion, and a low-floor streak. "Beat yesterday" celebrates on the bar.
export function ConsistencyCard({ activity }: { activity: ActivitySummary | null }) {
  if (!activity) return null;

  const todayMin = activity.today.active_seconds / 60;
  const yMin = activity.yesterday.active_seconds / 60;
  const target = Math.max(yMin, 1); // avoid divide-by-zero; tiny target on day 1
  const pct = Math.max(0, Math.min(100, (todayMin / target) * 100));
  const beat = yMin > 0 && todayMin >= yMin;
  const fmt = (m: number) => (m >= 10 ? Math.round(m) : Math.round(m * 10) / 10);

  const floorMin = Math.round(activity.floor_seconds / 60);
  const needsNudge =
    !activity.met_today && activity.today.reps === 0 && activity.today.active_seconds < activity.floor_seconds;

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        padding: '13px 15px',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span className="en" style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600 }}>
          Today
        </span>
        {activity.streak > 0 && (
          <span className="en" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
            {activity.streak}-day streak{activity.best > 1 && activity.streak === activity.best ? ' · best!' : ''}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="id" style={{ fontSize: 26, fontWeight: 500, color: 'var(--ink)' }}>{fmt(todayMin)}</span>
        <span className="en" style={{ fontSize: 13, color: 'var(--muted)' }}>
          min active · {activity.today.reps} review{activity.today.reps === 1 ? '' : 's'}
        </span>
      </div>

      {/* Progress toward yesterday */}
      <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 99, background: beat ? 'var(--good)' : 'var(--accent)', width: `${pct}%`, transition: 'width .4s ease' }} />
      </div>

      <span className="en" style={{ fontSize: 12, color: beat ? 'var(--good)' : 'var(--faint)' }}>
        {beat
          ? `Beat yesterday (${fmt(yMin)} min) 🎉`
          : yMin > 0
            ? `${fmt(yMin)} min yesterday`
            : needsNudge
              ? `Just ${floorMin} min or ${activity.reps_floor} reviews keeps your streak alive.`
              : 'A fresh day — every bit counts.'}
      </span>
    </div>
  );
}

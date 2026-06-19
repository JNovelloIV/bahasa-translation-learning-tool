// The quiet 5-segment memory-strength meter ("calm, not casino-gamified").
export function StrengthMeter({ value, w = 13, h = 4 }: { value: number; w?: number; h?: number }) {
  return (
    <div style={{ display: 'flex', gap: w >= 18 ? 4 : 3 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`seg${i <= value ? ' on' : ''}`}
          style={{ width: w, height: h, borderRadius: 2, display: 'block' }}
        />
      ))}
    </div>
  );
}

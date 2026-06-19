export function Toast({ text, visible }: { text: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="en"
      style={{
        position: 'absolute',
        bottom: 104,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--ink)',
        color: 'var(--bg)',
        fontSize: 13,
        fontWeight: 600,
        padding: '10px 18px',
        borderRadius: 999,
        zIndex: 60,
        animation: 'toastUp .25s ease both',
        boxShadow: '0 8px 24px rgba(0,0,0,.2)',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
}

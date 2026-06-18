// Inline single-stroke icons, lifted from the design prototype so strokes match.
// Color comes from the .ic class (stroke: var(--faint)) unless overridden.

type P = { size?: number; className?: string; stroke?: string; strokeWidth?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
});

export const MoonIcon = ({ size = 18, className = 'ic' }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

export const SunIcon = ({ size = 18, className = 'ic' }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
  </svg>
);

export const CopyIcon = ({ size = 16, stroke = '#fff', strokeWidth = 1.9 }: P) => (
  <svg {...base(size)} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </svg>
);

export const SpeakerIcon = ({ size = 20, className = 'ic', big = true }: P & { big?: boolean }) => (
  <svg {...base(size)} className={className}>
    <path d="M11 5 6 9H3v6h3l5 4V5z" />
    {big ? <path d="M15.5 8.5a4 4 0 0 1 0 7M18 6a7 7 0 0 1 0 12" /> : <path d="M15.5 8.5a4 4 0 0 1 0 7" />}
  </svg>
);

export const ShareIcon = ({ size = 20, className = 'ic' }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="18" cy="5" r="2.6" />
    <circle cx="6" cy="12" r="2.6" />
    <circle cx="18" cy="19" r="2.6" />
    <path d="M8.3 10.8 15.7 6.3M8.3 13.2l7.4 4.5" />
  </svg>
);

export const CheckIcon = ({ size = 15, stroke = 'var(--good)', strokeWidth = 2.4 }: P) => (
  <svg {...base(size)} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const CloseIcon = ({ size = 14, className = 'ic' }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.2}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const ChatIcon = ({ size = 12, className = 'ic' }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M21 11.5a8.5 8.5 0 0 1-12.2 7.7L3 21l1.8-5.8A8.5 8.5 0 1 1 21 11.5z" />
  </svg>
);

export const SearchIcon = ({ size = 16, className = 'ic' }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const PencilIcon = ({ size = 23, className = 'ic' }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);

export const ReviewIcon = ({ size = 23, className = 'ic' }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 12a9 9 0 0 1 15.5-6.2M21 5v4h-4" />
    <path d="M21 12a9 9 0 0 1-15.5 6.2M3 19v-4h4" />
  </svg>
);

export const BookIcon = ({ size = 23, className = 'ic' }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M4 5.5v15" />
    <path d="M9 8h7M9 11.5h5" />
  </svg>
);

export const GearIcon = ({ size = 18, className = 'ic' }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

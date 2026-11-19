// Иконки экрана ноутбука. Все свои, нарисованы простыми фигурами.
import type { ReactNode } from 'react';
import type { DockItem } from './layout';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    files: (
      <>
        <path {...stroke} d="M14 3H8.5A1.5 1.5 0 0 0 7 4.5v13A1.5 1.5 0 0 0 8.5 19h9a1.5 1.5 0 0 0 1.5-1.5V8z" />
        <path {...stroke} d="M14 3v5h5M7 7H5.5A1.5 1.5 0 0 0 4 8.5v12A1.5 1.5 0 0 0 5.5 22H14" />
      </>
    ),
    search: (
      <>
        <circle {...stroke} cx="10.5" cy="10.5" r="6" />
        <path {...stroke} d="m15 15 5 5" />
      </>
    ),
    branch: (
      <>
        <circle {...stroke} cx="7" cy="5.5" r="2" />
        <circle {...stroke} cx="7" cy="18.5" r="2" />
        <circle {...stroke} cx="17" cy="8" r="2" />
        <path {...stroke} d="M7 7.5v9M17 10c0 4-10 2.5-10 6.5" />
      </>
    ),
    run: (
      <>
        <path {...stroke} d="M8 5.5v13l10-6.5z" />
        <path {...stroke} d="M4 9h2M4 15h2" />
      </>
    ),
    blocks: (
      <>
        <rect {...stroke} x="4" y="4" width="7" height="7" rx="1" />
        <rect {...stroke} x="4" y="13" width="7" height="7" rx="1" />
        <rect {...stroke} x="13" y="13" width="7" height="7" rx="1" />
        <rect {...stroke} x="14.5" y="2.5" width="7" height="7" rx="1" transform="rotate(12 18 6)" />
      </>
    ),
    spark: <path {...stroke} d="M12 3c.6 4.5 2.5 7.4 8 9-5.5 1.6-7.4 4.5-8 9-.6-4.5-2.5-7.4-8-9 5.5-1.6 7.4-4.5 8-9z" />,
    account: (
      <>
        <circle {...stroke} cx="12" cy="8.5" r="3.6" />
        <path {...stroke} d="M5 20c1.2-3.6 4-5.2 7-5.2s5.8 1.6 7 5.2" />
      </>
    ),
    gear: (
      <>
        <circle {...stroke} cx="12" cy="12" r="3" />
        <path {...stroke} d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
      </>
    ),
    chevronRight: <path {...stroke} d="m9 6 6 6-6 6" />,
    chevronDown: <path {...stroke} d="m6 9 6 6 6-6" />,
    back: <path {...stroke} d="M19 12H5m6-6-6 6 6 6" />,
    forward: <path {...stroke} d="M5 12h14m-6-6 6 6-6 6" />,
    reload: (
      <>
        <path {...stroke} d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
        <path {...stroke} d="M19.5 4.5v4h-4" />
      </>
    ),
    star: <path {...stroke} d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z" />,
    puzzle: <path {...stroke} d="M9 4.5a2 2 0 0 1 4 0V6h4v4h-1.5a2 2 0 0 0 0 4H17v4h-4v-1.5a2 2 0 0 0-4 0V18H5v-4h1.5a2 2 0 0 0 0-4H5V6h4z" />,
    dots: (
      <>
        <circle cx="12" cy="5.5" r="1.4" fill="currentColor" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" />
        <circle cx="12" cy="18.5" r="1.4" fill="currentColor" />
      </>
    ),
    dotsH: (
      <>
        <circle cx="5.5" cy="12" r="1.3" fill="currentColor" />
        <circle cx="12" cy="12" r="1.3" fill="currentColor" />
        <circle cx="18.5" cy="12" r="1.3" fill="currentColor" />
      </>
    ),
    plus: <path {...stroke} d="M12 5v14M5 12h14" />,
    close: <path {...stroke} d="m7 7 10 10M17 7 7 17" />,
    mic: (
      <>
        <rect {...stroke} x="9" y="3.5" width="6" height="11" rx="3" />
        <path {...stroke} d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
      </>
    ),
    lens: (
      <>
        <path {...stroke} d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15" />
        <circle {...stroke} cx="12" cy="12" r="3" />
      </>
    ),
    info: (
      <>
        <circle {...stroke} cx="12" cy="12" r="8" />
        <path {...stroke} d="M12 11v5M12 8h.01" />
      </>
    ),
    tune: <path {...stroke} d="M4 7h10m4 0h2M4 17h4m4 0h8M16 5v4M10 15v4" />,
    wifi: (
      <>
        <path {...stroke} d="M3.5 9.5a12 12 0 0 1 17 0M6.5 12.8a7.6 7.6 0 0 1 11 0M9.5 16a3.2 3.2 0 0 1 5 0" />
        <circle cx="12" cy="19" r="1.2" fill="currentColor" />
      </>
    ),
    battery: (
      <>
        <rect {...stroke} x="2.5" y="7.5" width="17" height="9" rx="2.5" />
        <rect x="4.5" y="9.5" width="10.5" height="5" rx="1" fill="currentColor" />
        <path {...stroke} d="M21.5 10.5v3" />
      </>
    ),
    control: (
      <>
        <rect {...stroke} x="3" y="5" width="18" height="6" rx="3" />
        <rect {...stroke} x="3" y="13" width="18" height="6" rx="3" />
        <circle cx="7" cy="8" r="1.6" fill="currentColor" />
        <circle cx="17" cy="16" r="1.6" fill="currentColor" />
      </>
    ),
    split: (
      <>
        <rect {...stroke} x="3.5" y="4.5" width="17" height="15" rx="1.5" />
        <path {...stroke} d="M12 4.5v15" />
      </>
    ),
    trash: <path {...stroke} d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />,
    bell: <path {...stroke} d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
    remote: <path {...stroke} d="m8 7-5 5 5 5M16 7l5 5-5 5" />,
    sync: (
      <>
        <path {...stroke} d="M19 8a7 7 0 0 0-12.5-1.5M5 16a7 7 0 0 0 12.5 1.5" />
        <path {...stroke} d="M6 3v4h4M18 21v-4h-4" />
      </>
    ),
    error: (
      <>
        <circle {...stroke} cx="12" cy="12" r="8" />
        <path {...stroke} d="m9 9 6 6m0-6-6 6" />
      </>
    ),
    warning: (
      <>
        <path {...stroke} d="M12 4 2.8 19.5h18.4z" />
        <path {...stroke} d="M12 10v4.5M12 17h.01" />
      </>
    ),
    braces: <path {...stroke} d="M8 4c-2 0-2.5 1-2.5 3s-.5 3.5-2 5c1.5 1.5 2 3 2 5s.5 3 2.5 3M16 4c2 0 2.5 1 2.5 3s.5 3.5 2 5c-1.5 1.5-2 3-2 5s-.5 3-2.5 3" />,
    layout: (
      <>
        <rect {...stroke} x="3.5" y="4.5" width="17" height="15" rx="1.5" />
        <path {...stroke} d="M9 4.5v15" />
      </>
    ),
    method: <path {...stroke} d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9" />,
    variable: (
      <>
        <rect {...stroke} x="3.5" y="7" width="17" height="10" rx="1.5" />
        <path {...stroke} d="M8 10.5h8M8 13.5h5" />
      </>
    ),
    pulse: <path {...stroke} d="M3 12h4l2.5-6 4 12 2.5-6H21" />,
    home: <path {...stroke} d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />,
    users: (
      <>
        <circle {...stroke} cx="9" cy="8.5" r="3.2" />
        <path {...stroke} d="M3 19.5c.8-3.4 3.2-5 6-5s5.2 1.6 6 5M16 5.5a3 3 0 0 1 0 6M18.5 14.6c1.3.7 2.1 2.2 2.5 4.9" />
      </>
    ),
    card: (
      <>
        <rect {...stroke} x="3" y="5.5" width="18" height="13" rx="2" />
        <path {...stroke} d="M3 10h18M7 15h4" />
      </>
    ),
    report: <path {...stroke} d="M5 20V4M5 20h15M9 16v-5M13 16V8M17 16v-3" />,
    calendar: (
      <>
        <rect {...stroke} x="4" y="5.5" width="16" height="14" rx="2" />
        <path {...stroke} d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {paths[name] ?? null}
    </svg>
  );
}

/** Иконки приложений в доке — квадраты со скруглением, у каждого свой характер. */
export function DockGlyph({ item }: { item: DockItem }) {
  const glyph: Record<DockItem, ReactNode> = {
    files: (
      <>
        <defs>
          <linearGradient id="dk-files" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6cc0ff" />
            <stop offset="1" stopColor="#1f6fe0" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="15" fill="url(#dk-files)" />
        <path d="M14 22a4 4 0 0 1 4-4h9l4 4h15a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4z" fill="#eaf5ff" />
        <path d="M14 28h36v16a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4z" fill="#ffffff" />
      </>
    ),
    browser: (
      <>
        <defs>
          <linearGradient id="dk-br" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#26323a" />
            <stop offset="1" stopColor="#0d1418" />
          </linearGradient>
          <linearGradient id="dk-br-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9be27a" />
            <stop offset="0.5" stopColor="#3fc2b3" />
            <stop offset="1" stopColor="#3a7bf0" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="15" fill="url(#dk-br)" />
        <circle cx="32" cy="32" r="17" fill="none" stroke="url(#dk-br-ring)" strokeWidth="6" />
        <ellipse cx="32" cy="32" rx="25" ry="8" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="2" transform="rotate(-28 32 32)" />
        <circle cx="49" cy="22" r="3.4" fill="#ffffff" />
      </>
    ),
    editor: (
      <>
        <defs>
          <linearGradient id="dk-ed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a3b6e" />
            <stop offset="1" stopColor="#141c38" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="15" fill="url(#dk-ed)" />
        <path d="m24 21-11 11 11 11M40 21l11 11-11 11" fill="none" stroke="#8fb7ff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m35 17-6 30" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" />
      </>
    ),
    messenger: (
      <>
        <defs>
          <linearGradient id="dk-msg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6ee48a" />
            <stop offset="1" stopColor="#1fae55" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="15" fill="url(#dk-msg)" />
        <path d="M32 15c10.5 0 18 6.8 18 15.4s-7.5 15.4-18 15.4c-2 0-4-.3-5.7-.8L17 48l2.6-7.6C16.4 37.7 14 34.3 14 30.4 14 21.8 21.5 15 32 15z" fill="#ffffff" />
      </>
    ),
    mail: (
      <>
        <defs>
          <linearGradient id="dk-mail" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7fd4ff" />
            <stop offset="1" stopColor="#2a8ef0" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="15" fill="url(#dk-mail)" />
        <rect x="13" y="20" width="38" height="26" rx="4" fill="#ffffff" />
        <path d="m14 22 18 13 18-13" fill="none" stroke="#2a8ef0" strokeWidth="2.6" strokeLinejoin="round" />
      </>
    ),
    notes: (
      <>
        <rect width="64" height="64" rx="15" fill="#fff8dc" />
        <path d="M0 15a15 15 0 0 1 15-15h34a15 15 0 0 1 15 15v2H0z" fill="#ffcb2e" />
        {[27, 35, 43, 51].map((y) => (
          <rect key={y} x="12" y={y} width={y === 51 ? 24 : 40} height="2" rx="1" fill="#d9cfb0" />
        ))}
      </>
    ),
    bank: (
      <>
        <defs>
          <linearGradient id="dk-bank" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#a17cff" />
            <stop offset="1" stopColor="#5a35d6" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="15" fill="url(#dk-bank)" />
        <rect x="12" y="20" width="40" height="26" rx="5" fill="#ffffff" fillOpacity="0.95" />
        <rect x="12" y="26" width="40" height="5" fill="#5a35d6" fillOpacity="0.85" />
        <rect x="17" y="37" width="12" height="3" rx="1.5" fill="#a17cff" />
      </>
    ),
    settings: (
      <>
        <defs>
          <linearGradient id="dk-set" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c9ccd3" />
            <stop offset="1" stopColor="#7d828c" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="15" fill="url(#dk-set)" />
        <circle cx="32" cy="32" r="15" fill="none" stroke="#3a3d44" strokeWidth="6" strokeDasharray="5 3.4" />
        <circle cx="32" cy="32" r="9" fill="#e6e8ec" stroke="#3a3d44" strokeWidth="3" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
      {glyph[item]}
    </svg>
  );
}

/** Маленький значок файла в редакторе: TS, TSX, JSON, MD и т.д. */
export function FileGlyph({ name }: { name: string }) {
  const ext = name.includes('.') ? name.split('.').pop() : '';
  const map: Record<string, [string, string]> = {
    ts: ['TS', '#3c8ce7'],
    tsx: ['TSX', '#3fb6d6'],
    json: ['{ }', '#e8c34f'],
    md: ['M↓', '#4f9bd9'],
    example: ['⚙', '#9aa0a6'],
    gitignore: ['◆', '#e0674a'],
  };
  const [label, color] = map[ext ?? ''] ?? ['•', '#8b8b8b'];
  return (
    <span className="ed-fileglyph" style={{ color }}>
      {label}
    </span>
  );
}

/** Логотип поисковика: своя кольцевая отметка, не похожая на чужие. */
export function SearchMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={`sm-${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5ad1a8" />
          <stop offset="1" stopColor="#3a7bf0" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill={`url(#sm-${size})`} />
      <circle cx="11" cy="11" r="4.6" fill="none" stroke="#fff" strokeWidth="2.4" />
      <path d="m14.4 14.4 3.4 3.4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function PulseMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6.5" fill="#6d5efc" />
      <path d="M4.5 12.5h3.4l2-4.5 3.4 9 2.2-4.5h4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

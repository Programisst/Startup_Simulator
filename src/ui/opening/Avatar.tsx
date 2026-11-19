// Пиксельный портрет друга: в мессенджере и в его подсказках во время игры.
/** Аватар друга: маленький пиксельный портрет, нарисованный квадратиками. */
export function FriendAvatar({ size, className = 'ms-avatar' }: { size: number; className?: string }) {
  // Каждая строка — 10 клеток: h — волосы, s — кожа, e — глаза, m — рот, t — футболка, . — фон.
  const rows = ['..hhhhhh..', '.hhhhhhhh.', '.hssssssh.', '.sesssses.', '.ssssssss.', '..ssmmss..', '...ssss...', '.tttttttt.', 'tttttttttt', 'tttttttttt'];
  const color: Record<string, string> = { h: '#3b2a24', s: '#f0c39c', e: '#26324a', m: '#c4553b', t: '#3fae62' };
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
      <rect width="10" height="10" fill="#f6c34a" />
      {rows.flatMap((row, y) =>
        [...row].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color[c]} />)),
      )}
    </svg>
  );
}

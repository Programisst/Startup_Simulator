// Простой линейный график без сторонних библиотек.
interface Props {
  values: number[];
  color: string;
  height?: number;
}

export function LineChart({ values, color, height = 120 }: Props) {
  const width = 600;
  if (values.length < 2) return <div className="chart-empty" style={{ height }} />;

  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => height - 4 - ((v - min) / span) * (height - 8);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height }}>
      {min < 0 && <line x1={0} x2={width} y1={y(0)} y2={y(0)} className="chart-zero" />}
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

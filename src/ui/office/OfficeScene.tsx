// Комната основателя: живая картинка, которая показывает, что происходит в компании.
// Сцена ничего не считает сама — только рисует состояние игры.
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { overload, type GameState } from '../../core';
import { Box, FloorRect, onBackWall, onSideWall, points, project, shade } from './iso';

const ROOM = 6;
const WALL_H = 2.6;

const SEAT = { x: 3.6, y: 1.45 };
/** Точки, между которыми основатель бродит, когда ему нечем заняться. */
const WANDER = [
  { x: 2.6, y: 3.2 },
  { x: 4.3, y: 4.3 },
  { x: 1.7, y: 2.7 },
  { x: 4.2, y: 2.6 },
];

type Activity = 'building' | 'sideJob' | 'idle' | 'broke';

function activityOf(game: GameState): Activity {
  if (game.cash < 0) return 'broke';
  if (game.sideJobShare >= 1) return 'sideJob';
  if (game.tasks.length > 0) return 'building';
  if (game.sideJobShare > 0) return 'sideJob';
  return 'idle';
}

interface Item {
  depth: number;
  node: ReactNode;
}

function Founder({ sitting }: { sitting: boolean }) {
  const jeans = '#3b4a6b';
  const shirt = '#e0564f';
  const skin = '#f0c29e';
  const hair = '#3a2a22';
  if (sitting) {
    return (
      <g className="founder-body typing">
        <Box x={-0.14} y={-0.4} z={0.3} w={0.28} d={0.34} h={0.1} color={jeans} />
        <Box x={-0.16} y={-0.11} z={0.34} w={0.32} d={0.22} h={0.44} color={shirt} />
        <Box x={-0.12} y={-0.11} z={0.78} w={0.24} d={0.22} h={0.25} color={skin} />
        <Box x={-0.13} y={-0.12} z={1.0} w={0.26} d={0.24} h={0.08} color={hair} />
      </g>
    );
  }
  return (
    <g className="founder-body walking">
      <Box x={-0.14} y={-0.1} z={0} w={0.28} d={0.2} h={0.42} color={jeans} />
      <Box x={-0.16} y={-0.11} z={0.42} w={0.32} d={0.22} h={0.46} color={shirt} />
      <Box x={-0.12} y={-0.11} z={0.88} w={0.24} d={0.22} h={0.25} color={skin} />
      <Box x={-0.13} y={-0.12} z={1.1} w={0.26} d={0.24} h={0.08} color={hair} />
    </g>
  );
}

function Bubble({ text, alert }: { text: string; alert: boolean }) {
  const width = Math.max(44, text.length * 6.4 + 18);
  return (
    <g className="bubble" transform={`translate(0, ${-1.5 * 44})`}>
      <rect x={-width / 2} y={-22} width={width} height={22} rx={8} className={alert ? 'bubble-box alert' : 'bubble-box'} />
      <polygon points="-5,0 5,0 0,7" className={alert ? 'bubble-box alert' : 'bubble-box'} />
      <text x={0} y={-7} textAnchor="middle" className="bubble-text">
        {text}
      </text>
    </g>
  );
}

export function OfficeScene({ game, speed }: { game: GameState; speed: number }) {
  const { t } = useTranslation();

  const activity = activityOf(game);
  const atDesk = activity === 'building' || activity === 'sideJob';
  const moving = speed > 0 && game.status === 'running' && game.pendingEvent === null;

  // Когда дел нет, основатель бродит по комнате. Это украшение: на игру не влияет.
  const [spot, setSpot] = useState(0);
  useEffect(() => {
    if (atDesk || !moving) return;
    const timer = setInterval(() => setSpot((s) => (s + 1 + Math.floor(Math.random() * (WANDER.length - 1))) % WANDER.length), 2600);
    return () => clearInterval(timer);
  }, [atDesk, moving]);

  const place = atDesk ? SEAT : WANDER[spot]!;
  const [fx, fy] = project(place.x, place.y);

  const over = overload(game.users, game.capacity);
  const month = (Math.floor(game.day / 30) % 12) + 1;
  const season = month <= 2 || month === 12 ? 'winter' : month <= 5 ? 'spring' : month <= 8 ? 'summer' : 'autumn';
  const sky = { winter: '#b9d4ea', spring: '#9fdcf5', summer: '#7fd0ff', autumn: '#e6b98a' }[season];
  const screenColor = activity === 'building' ? '#6fd3ff' : activity === 'sideJob' ? '#8ef0a6' : '#2a3144';

  let bubble: string;
  if (game.pendingEvent !== null) bubble = '!';
  else if (activity === 'broke') bubble = t('office.bubble.broke');
  else if (activity === 'sideJob' && (game.tasks.length === 0 || game.sideJobShare >= 1)) bubble = t('office.bubble.sideJob');
  else if (activity === 'idle') bubble = t('office.bubble.idle');
  else {
    const task = game.tasks[0]!;
    if (task.kind === 'feature') {
      const name = task.featureId === 'core' ? t(`productTypes.${game.productType}.core`) : t(`features.${task.featureId}`);
      bubble = t('office.bubble.feature', { name });
    } else bubble = t(`office.bubble.${task.kind}`);
  }

  // График пользователей на доске.
  const history = game.recentDays.map((d) => d.users);
  const maxUsers = Math.max(1, ...history);
  const chart =
    history.length > 1
      ? points(...history.map((u, i) => project(0, 4.75 - (i / (history.length - 1)) * 2.1, 1.02 + (u / maxUsers) * 0.85)))
      : null;

  const bugCount = Math.min(6, Math.floor(game.bugs / 2));
  const bugSpots: [number, number][] = [[0.5, 0.6], [2.4, 2.1], [4.9, 2.2], [5.5, 0.4], [0.7, 1.9], [2.3, 0.5]];

  const items: Item[] = [
    // кровать у левой стены
    {
      depth: 0.7 + 1.3,
      node: (
        <g>
          <Box x={0.15} y={0.3} w={1.1} d={2.0} h={0.22} color="#6b4a35" />
          <Box x={0.2} y={0.35} z={0.22} w={1.0} d={1.9} h={0.14} color="#e9e4dc" />
          <Box x={0.2} y={1.0} z={0.36} w={1.0} d={1.25} h={0.05} color="#4c6fa8" />
          <Box x={0.3} y={0.42} z={0.36} w={0.8} d={0.4} h={0.09} color="#ffffff" />
        </g>
      ),
    },
    // стол с монитором у задней стены
    {
      depth: 3.6 + 0.6,
      node: (
        <g>
          <Box x={2.7} y={0.25} z={0.7} w={1.9} d={0.8} h={0.07} color="#c9a36b" />
          <Box x={2.75} y={0.3} w={0.08} d={0.08} h={0.7} color="#8a6a45" />
          <Box x={4.47} y={0.3} w={0.08} d={0.08} h={0.7} color="#8a6a45" />
          <Box x={2.75} y={0.92} w={0.08} d={0.08} h={0.7} color="#8a6a45" />
          <Box x={4.47} y={0.92} w={0.08} d={0.08} h={0.7} color="#8a6a45" />
          <Box x={3.55} y={0.45} z={0.77} w={0.14} d={0.1} h={0.12} color="#30364a" />
          <Box x={3.2} y={0.45} z={0.89} w={0.84} d={0.06} h={0.5} color="#30364a" />
          <polygon
            className={atDesk ? 'screen on' : 'screen'}
            points={points(project(3.25, 0.51, 1.34), project(3.99, 0.51, 1.34), project(3.99, 0.51, 0.94), project(3.25, 0.51, 0.94))}
            fill={screenColor}
          />
          <Box x={3.3} y={0.72} z={0.77} w={0.6} d={0.2} h={0.03} color="#e8eaf0" />
          <Box x={4.2} y={0.5} z={0.77} w={0.14} d={0.14} h={0.16} color="#f3f3f3" />
          {game.rush && <Box x={2.85} y={0.5} z={0.77} w={0.12} d={0.12} h={0.22} color="#39d353" className="can" />}
          {game.rush && <Box x={3.0} y={0.65} z={0.77} w={0.12} d={0.12} h={0.22} color="#39d353" className="can" />}
        </g>
      ),
    },
    // стул
    {
      depth: SEAT.x + SEAT.y - 0.05,
      node: (
        <g>
          <Box x={SEAT.x - 0.04} y={SEAT.y - 0.04} w={0.08} d={0.08} h={0.26} color="#20242f" />
          <Box x={SEAT.x - 0.22} y={SEAT.y - 0.22} z={0.26} w={0.44} d={0.44} h={0.07} color="#3d4459" />
        </g>
      ),
    },
    {
      depth: SEAT.x + SEAT.y + 0.4,
      node: <Box x={SEAT.x - 0.22} y={SEAT.y + 0.2} z={0.3} w={0.44} d={0.06} h={0.34} color="#3d4459" />,
    },
    // сервер после запуска, коробки — до
    {
      depth: 5.3 + 0.6,
      node: game.launched ? (
        <g>
          <Box x={4.95} y={0.2} w={0.75} d={0.75} h={1.55} color="#2b3142" />
          {[0, 1, 2, 3, 4].map((row) =>
            [0, 1, 2].map((col) => {
              const [cx, cy] = project(5.08 + col * 0.2, 0.95, 1.35 - row * 0.26);
              return <circle key={`${row}-${col}`} cx={cx} cy={cy} r={2.3} className={over > 0 ? 'led red' : 'led'} style={{ animationDelay: `${(row * 3 + col) * 0.17}s` }} />;
            }),
          )}
        </g>
      ) : (
        <g>
          <Box x={5.0} y={0.25} w={0.7} d={0.7} h={0.5} color="#c49a6c" />
          <Box x={5.1} y={0.35} z={0.5} w={0.5} d={0.5} h={0.38} color="#d3ab7d" />
        </g>
      ),
    },
    // растение
    {
      depth: 0.45 + 5.25,
      node: (
        <g>
          <Box x={0.25} y={5.05} w={0.4} d={0.4} h={0.34} color="#b5654a" />
          <Box x={0.2} y={5.0} z={0.34} w={0.5} d={0.5} h={0.42} color="#3f9d5d" className="plant" />
          <Box x={0.32} y={5.12} z={0.76} w={0.26} d={0.26} h={0.3} color="#4fb56e" className="plant" />
        </g>
      ),
    },
    // столик с чайником
    {
      depth: 5.4 + 4.9,
      node: (
        <g>
          <Box x={5.0} y={4.5} w={0.8} d={0.8} h={0.5} color="#8a6a45" />
          <Box x={5.2} y={4.7} z={0.5} w={0.26} d={0.26} h={0.3} color="#d9dde6" />
          <Box x={5.55} y={4.95} z={0.5} w={0.13} d={0.13} h={0.15} color="#e0564f" />
        </g>
      ),
    },
    // коробки из-под пиццы копятся в спешке
    ...(game.rush
      ? [
          {
            depth: 1.9 + 5.0,
            node: (
              <g>
                {[0, 1, 2].map((i) => (
                  <Box key={i} x={1.5 + i * 0.03} y={4.7 - i * 0.02} z={i * 0.06} w={0.7} d={0.7} h={0.06} color={i % 2 ? '#d8b98a' : '#caa877'} />
                ))}
              </g>
            ),
          },
        ]
      : []),
    // основатель
    {
      depth: place.x + place.y,
      node: (
        <g className="founder" style={{ transform: `translate(${fx.toFixed(1)}px, ${fy.toFixed(1)}px)` }}>
          <ellipse cx={0} cy={2} rx={15} ry={7} className="shadow" />
          <Founder sitting={atDesk} />
          <Bubble text={bubble} alert={activity === 'broke' || game.pendingEvent !== null} />
        </g>
      ),
    },
  ];
  items.sort((a, b) => a.depth - b.depth);

  // Границы картинки: комната плюс запас сверху под стены и облачко.
  const left = project(0, ROOM)[0] - 12;
  const right = project(ROOM, 0)[0] + 12;
  const top = project(0, 0, WALL_H)[1] - 16;
  const bottom = project(ROOM, ROOM)[1] + 14;

  const floor: ReactNode[] = [];
  for (let x = 0; x < ROOM; x++) {
    for (let y = 0; y < ROOM; y++) {
      floor.push(<FloorRect key={`${x}-${y}`} x={x} y={y} w={1} d={1} z={0} color={(x + y) % 2 ? '#b8905f' : '#c29a68'} />);
    }
  }

  return (
    <section className={moving ? 'office' : 'office paused'}>
      <svg className="office-scene" viewBox={`${left} ${top} ${right - left} ${bottom - top}`} role="img" aria-label={t('office.title')}>
        {/* стены */}
        <polygon points={onSideWall(0, ROOM, 0, WALL_H)} fill="#d9d2c4" />
        <polygon points={onBackWall(0, ROOM, 0, WALL_H)} fill={shade('#d9d2c4', 0.88)} />
        <polygon points={onSideWall(0, ROOM, 0, 0.12)} fill="#8a6a45" />
        <polygon points={onBackWall(0, ROOM, 0, 0.12)} fill={shade('#8a6a45', 0.85)} />

        {/* окно со временем года */}
        <polygon points={onBackWall(0.7, 2.2, 0.95, 2.15)} fill="#f4f1ea" />
        <polygon points={onBackWall(0.8, 2.1, 1.05, 2.05)} fill={sky} className="sky" />
        <polygon points={onBackWall(1.43, 1.47, 1.05, 2.05)} fill="#f4f1ea" />
        {season === 'winter' && [0.95, 1.2, 1.7, 1.95].map((x, i) => {
          const [cx, cy] = project(x, 0, 1.9 - i * 0.2);
          return <circle key={i} cx={cx} cy={cy} r={1.6} fill="#fff" className="snow" style={{ animationDelay: `${i * 0.5}s` }} />;
        })}

        {/* доска с графиком пользователей */}
        <polygon points={onSideWall(2.5, 4.9, 0.9, 2.0)} fill="#f7f7f2" stroke="#9aa0ad" strokeWidth={1.5} />
        {chart && <polyline points={chart} fill="none" stroke="#e0564f" strokeWidth={2} strokeLinejoin="round" />}

        {/* ошибки ползают по стене */}
        {bugSpots.slice(0, bugCount).map(([x, z], i) => {
          const [cx, cy] = project(x, 0, z);
          return <circle key={i} cx={cx} cy={cy} r={2.6} className="bug" style={{ animationDelay: `${i * 0.3}s` }} />;
        })}

        {floor}
        <FloorRect x={2.2} y={2.3} w={2.6} d={2.4} color="#7a5c8f" />
        <FloorRect x={2.4} y={2.5} w={2.2} d={2.0} color="#8d6ea3" />

        {items.map((item, i) => (
          <g key={i}>{item.node}</g>
        ))}
      </svg>
      <div className="office-caption">
        <b>{t('office.title')}</b>
        <span>{t(`office.status.${activity}`)}</span>
      </div>
    </section>
  );
}

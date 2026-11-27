// @vitest-environment jsdom
// Простой выбор города на экране новой партии: настоящие цифры города и то, что они значат в игре.
import { describe, expect, it } from 'vitest';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/ui/i18n';
import { content } from '../src/content';
import { citiesView, createGame } from '../src/core';
import { CityPicker } from '../src/ui/components/CityPicker';
import { Team } from '../src/ui/screens/Team';
import { useStore } from '../src/ui/store';
import { baseSetup } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const missing = (text: string | null) => text?.match(/\b(new|cities|errors|team)\.[a-z][A-Za-z0-9_.]+/g) ?? [];

function Host({ onPick }: { onPick: (id: string) => void }) {
  const [city, setCity] = useState(content.cities[0]!.id);
  return (
    <CityPicker
      value={city}
      onChange={(id) => {
        setCity(id);
        onPick(id);
      }}
    />
  );
}

function show(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return { container, close: () => { act(() => root.unmount()); container.remove(); } };
}

describe('город в игре', () => {
  it('экран «Команда» называет город и говорит, тесен ли рынок труда', () => {
    const small = [...content.cities].sort((a, b) => a.devJobs - b.devJobs)[0]!;
    const base = createGame({ ...baseSetup, cityId: small.id }, content);
    useStore.setState({ game: base });
    const calm = show(<Team />);
    const line = calm.container.querySelector(`[data-labor-market="${small.id}"]`)!;
    expect(line.textContent).toMatch(/Ваш город — .+\. Легко нанять здесь можно около \d+ человек, у вас 0\. Пока людей хватает/);
    expect(missing(calm.container.textContent)).toEqual([]);
    calm.close();

    const crowd = Array.from({ length: 40 }, (_, i) => ({ id: 500 + i, role: 'developer' as const, skill: 1, trait: 'calm' as const, salaryAsk: 3000, salary: 3000, nameSeed: i, hiredDay: 0, motivation: 70 }));
    useStore.setState({ game: { ...base, office: 'floor', team: { ...base.team!, employees: crowd } } });
    const tight = show(<Team />);
    expect(tight.container.querySelector('[data-labor-market]')!.textContent).toMatch(/у вас 40\. Рынок труда тесный: следующие кандидаты попросят на \d+% больше, а придёт их \d+% от обычного\./);
    expect(missing(tight.container.textContent)).toEqual([]);
    tight.close();
  });

  it('в партии без города строки о рынке труда нет', () => {
    useStore.setState({ game: createGame(baseSetup, content) });
    const { container, close } = show(<Team />);
    expect(container.querySelector('[data-labor-market]')).toBeNull();
    close();
  });
});

describe('выбор города', () => {
  it('показывает все города по именам, выбранный — с цифрами и их значением в игре', () => {
    const { container, close } = show(<Host onPick={() => {}} />);
    expect(container.querySelectorAll('[data-city]')).toHaveLength(content.cities.length);
    const first = citiesView(content)[0]!;
    const facts = container.querySelector(`[data-city-facts="${first.id}"]`)!;
    expect(facts.textContent).toMatch(/Программистов в городе: [\d\s ]+, их средняя зарплата — \$[\d\s ]+ в год\./);
    expect(facts.textContent).toMatch(/В игре: жизнь [+-]?\d+%, зарплаты разработчиков [+-]?\d+%, аренда офиса [+-]?\d+%, интерес инвесторов [+-]?\d+%\./);
    expect(facts.textContent).toMatch(/Кандидатов в списке/);
    expect(missing(container.textContent)).toEqual([]);
    close();
  });

  it('у каждого города свои цифры: нажатие меняет выбор и подпись', () => {
    const picked: string[] = [];
    const { container, close } = show(<Host onPick={(id) => picked.push(id)} />);
    const seen = new Set<string>();
    for (const c of content.cities) {
      act(() => (container.querySelector(`[data-city="${c.id}"]`) as HTMLButtonElement).click());
      const facts = container.querySelector(`[data-city-facts="${c.id}"]`);
      expect(facts, c.id).not.toBeNull();
      expect(container.querySelector(`[data-city="${c.id}"]`)!.className).toContain('on');
      seen.add(facts!.textContent!);
      expect(missing(container.textContent), c.id).toEqual([]);
    }
    expect(picked).toEqual(content.cities.map((c) => c.id));
    // Двух одинаковых городов нет.
    expect(seen.size).toBe(content.cities.length);
    close();
  });
});

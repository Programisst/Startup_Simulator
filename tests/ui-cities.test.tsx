// @vitest-environment jsdom
// Простой выбор города на экране новой партии: настоящие цифры города и то, что они значат в игре.
import { describe, expect, it } from 'vitest';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/ui/i18n';
import { content } from '../src/content';
import { citiesView } from '../src/core';
import { CityPicker } from '../src/ui/components/CityPicker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const missing = (text: string | null) => text?.match(/\b(new|cities|errors)\.[A-Za-z0-9_.]+/g) ?? [];

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

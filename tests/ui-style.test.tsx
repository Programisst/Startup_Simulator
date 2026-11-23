// @vitest-environment jsdom
// Общий стиль «Орех и бумага»: шрифт Rubik из файлов проекта, пиксельные значки,
// кнопки времени — плашками в квартире и в углу экрана за компьютером, а не внутри программы «Компания».
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../src/ui/i18n';
import { CompanyApp } from '../src/ui/office/CompanyApp';
import { RoomControls } from '../src/ui/office/RoomControls';
import { PIXEL_ICONS } from '../src/ui/pixelIcons';
import { useStore } from '../src/ui/store';
import { newGame } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const root = join(__dirname, '..');
const read = (file: string) => readFileSync(join(root, file), 'utf-8');

let box: HTMLDivElement;
let r: Root;

beforeEach(() => {
  box = document.createElement('div');
  document.body.append(box);
  r = createRoot(box);
  useStore.setState({ game: newGame(), screen: 'overview', speed: 0, lastError: null });
});

afterEach(() => {
  act(() => r.unmount());
  box.remove();
  useStore.setState({ game: null });
});

describe('шрифт', () => {
  it('Rubik лежит в проекте вместе с лицензией и подключён без интернета', () => {
    for (const file of ['500', '700'].flatMap((w) => [`src/ui/fonts/rubik-${w}-latin.woff2`, `src/ui/fonts/rubik-${w}-cyrillic.woff2`]).concat('src/ui/fonts/OFL.txt')) {
      expect(existsSync(join(root, file)), file).toBe(true);
    }
    const css = read('src/ui/styles.css');
    expect(css).toContain("font-family: 'Rubik'");
    expect(css).toContain('./fonts/rubik-700-cyrillic.woff2');
    expect(css).not.toContain('googleapis');
  });
});

describe('пиксельные значки', () => {
  it('каждый — сетка 12×12 из точек и решёток', () => {
    for (const [name, rows] of Object.entries(PIXEL_ICONS)) {
      expect(rows, name).toHaveLength(12);
      for (const row of rows) expect(row, name).toMatch(/^[.#]{12}$/);
    }
  });
});

describe('кнопки времени в квартире', () => {
  it('пауза и скорости — пиксельные значки с подписью для экранного чтения', () => {
    act(() => r.render(<RoomControls />));
    const buttons = [...box.querySelectorAll('.lm-speed button')];
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Пауза', '×1', '×2', '×5']);
    for (const b of buttons) {
      expect(b.querySelector('svg.px-icon path')).not.toBeNull();
      expect(b.textContent).toBe('');
    }
    expect(box.querySelector('.lm-save svg.px-icon')).not.toBeNull();
  });
});

describe('программа «Компания»', () => {
  it('без кнопок времени и сохранения — они в углу экрана', () => {
    act(() => r.render(<CompanyApp />));
    const app = box.querySelector('.company-app')!;
    expect(app.querySelector('.speeds')).toBeNull();
    expect([...app.querySelectorAll('button')].some((b) => b.textContent === 'Сохранить')).toBe(false);
    expect(app.querySelector('.topbar .cash')).not.toBeNull();
  });

  it('разделы слева — с пиксельными значками', () => {
    act(() => r.render(<CompanyApp />));
    const icons = [...box.querySelectorAll('.company-app .sidebar [data-nav] .ca-ico svg')];
    expect(icons).toHaveLength(5);
    for (const svg of icons) expect(svg.classList.contains('px-icon')).toBe(true);
  });
});

describe('за компьютером', () => {
  it('кнопки времени и сохранение стоят рядом с подсказкой «Esc»', () => {
    expect(read('src/ui/apartment/Apartment.tsx')).toContain('controls={link?.controls}');
    const laptop = read('src/ui/apartment/laptop/Laptop.tsx');
    expect(laptop).toMatch(/className="lp-corner"[\s\S]*\{controls\}[\s\S]*className="lp-hint"/);
  });

  it('подсказка обучения не просит нажать «×1» — на кнопке теперь значок', () => {
    const ru = JSON.parse(read('src/content/ru/ui.json')) as { coach: Record<string, string> };
    expect(ru.coach.startTime).not.toContain('×1');
    expect(ru.coach.resumeTime).not.toContain('×1');
  });
});

// Логика «настоящего компьютера»: адресная строка, печать кода игроком, терминал, поиск.
import { describe, expect, it } from 'vitest';
import { advanceCode, navigateFromInput, repairPrefix, resultsFor, runCommand } from '../src/ui/apartment/laptop/logic';

describe('адресная строка', () => {
  it('открывает свой продукт по адресу localhost', () => {
    expect(navigateFromInput('localhost:5173').view).toBe('product');
    expect(navigateFromInput('http://localhost:5173/').view).toBe('product');
  });

  it('ищет в поисковике, если введены слова', () => {
    const nav = navigateFromInput('  как найти инвестора ');
    expect(nav).toEqual({ view: 'results', query: 'как найти инвестора', url: 'goagle.com/search?q=как+найти+инвестора' });
  });

  it('показывает страницу ошибки для незнакомого сайта', () => {
    expect(navigateFromInput('https://example.com/page')).toEqual({ view: 'error', url: 'example.com/page' });
  });

  it('пустой ввод — новая вкладка', () => {
    expect(navigateFromInput('   ').view).toBe('newtab');
  });
});

describe('игрок печатает код любыми клавишами', () => {
  const code = 'function a() {\n    return 1;\n}\n';

  it('каждое нажатие добавляет следующий кусок настоящего кода', () => {
    expect(advanceCode('', code, 3)).toBe('fun');
    expect(advanceCode('fun', code, 3)).toBe('functi');
  });

  it('после переноса строки сразу ставит отступ', () => {
    expect(advanceCode('function a() {', code, 3)).toBe('function a() {\n    ');
  });

  it('не выходит за конец файла', () => {
    expect(advanceCode(code, code, 3)).toBe(code);
  });

  it('стирает недоисправленную опечатку основателя', () => {
    expect(repairPrefix('functiom', code)).toBe('functio');
    expect(advanceCode('functiom', code, 1)).toBe('function');
  });
});

describe('терминал', () => {
  it('npm test запускает тесты', () => {
    expect(runCommand('npm test').tests).toBe(true);
    expect(runCommand('  npm run test ').tests).toBe(true);
  });

  it('знает простые команды', () => {
    expect(runCommand('pwd').lines.map((l) => l.text)).toEqual(['/Users/founder/projects/pulse-app']);
    expect(runCommand('ls').lines.length).toBeGreaterThan(0);
    expect(runCommand('clear').clear).toBe(true);
  });

  it('на незнакомую команду отвечает как настоящий zsh', () => {
    expect(runCommand('deploy now').lines.map((l) => l.text)).toEqual(['zsh: command not found: deploy']);
    expect(runCommand('').lines).toEqual([]);
  });
});

describe('поиск', () => {
  const curated = { queries: ['как считать отток в подписке'], results: [{ site: 'A', url: 'a', title: 'Готовый', text: 'x' }] };
  const templates = [{ site: 'Б', url: 'b.ru › {q}', title: '{q}: разбор', text: 'Про {q}.' }];

  it('на знакомый запрос отдаёт подобранные результаты', () => {
    expect(resultsFor('Как считать отток в подписке', curated, templates)[0]?.title).toBe('Готовый');
  });

  it('на любой другой запрос собирает результаты из шаблонов', () => {
    expect(resultsFor('аренда офиса', curated, templates)[0]).toEqual({ site: 'Б', url: 'b.ru › аренда офиса', title: 'аренда офиса: разбор', text: 'Про аренда офиса.' });
  });
});

describe('дерево файлов', () => {
  it('свёрнутая папка прячет всё, что внутри', async () => {
    const { visibleTree } = await import('../src/ui/apartment/laptop/project');
    const names = visibleTree(['src']).map((n) => n.name);
    expect(names).toContain('src');
    expect(names).not.toContain('session.ts');
    expect(names).toContain('package.json');
  });

  it('знает, какие папки раскрыть, чтобы показать файл', async () => {
    const { foldersOf } = await import('../src/ui/apartment/laptop/project');
    expect(foldersOf('session.ts')).toEqual(['api', 'src']);
    expect(foldersOf('package.json')).toEqual([]);
  });
});

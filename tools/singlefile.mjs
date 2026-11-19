// Собирает игру в один файл HTML, который открывается двойным щелчком без установки чего-либо.
// Запуск: npm run share  → файл share/StartupSimulator.html
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
let html = readFileSync(new URL('index.html', dist), 'utf-8');

html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/g, (_, file) => {
  return `<style>${readFileSync(new URL(file, dist), 'utf-8')}</style>`;
});

let scripts = '';
html = html.replace(/<script type="module"[^>]*src="\.\/([^"]+)"[^>]*><\/script>/g, (_, file) => {
  // Закрывающий тег внутри кода оборвал бы скрипт раньше времени.
  const js = readFileSync(new URL(file, dist), 'utf-8').replaceAll('</script', '<\\/script');
  scripts += `<script type="module">${js}</script>`;
  return '';
});
// Скрипт ставится в конец страницы: к этому моменту элемент #root уже существует.
html = html.replace('</body>', () => `${scripts}</body>`);

if (/(src|href)="\.\/assets\//.test(html)) throw new Error('Остались ссылки на отдельные файлы — сборка не цельная');
// Квартира и другие части, подгружаемые на ходу, тоже должны быть внутри файла.
if (/import\(\s*["'`]\.\.?\/[^"'`]+\.js/.test(html)) throw new Error('Часть игры подгружается отдельным файлом — запустите сборку через npm run share');

mkdirSync(new URL('../share/', import.meta.url), { recursive: true });
writeFileSync(new URL('../share/StartupSimulator.html', import.meta.url), html);
console.log(`Готово: share/StartupSimulator.html, ${Math.round(html.length / 1024)} КБ`);

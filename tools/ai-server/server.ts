// Служба игры для сервера: раздаёт собранную игру и отвечает на запросы к нейросети.
// Слушает только внутренний адрес 127.0.0.1 — наружу её показывает nginx.
// Настройки берутся из переменных окружения (на сервере — из файла, доступного только этой службе):
//   AI_API_KEY          ключ к нейросети
//   AI_MODEL            модель (по умолчанию claude-haiku-5-5)
//   AI_DAILY_LIMIT      сколько запросов к нейросети в сутки всем вместе (по умолчанию 300)
//   AI_VISITOR_LIMIT    сколько запросов в сутки одному посетителю (по умолчанию 40)
//   PORT                порт службы
//   PUBLIC_DIR          папка с собранной игрой
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { AI_ROUTES } from '../../src/ai/protocol.ts';
import { ideaLexicon } from '../../src/content/ideas.ts';
import { content } from '../../src/content/index.ts';
import { IDEA_MAX_LENGTH } from '../../src/core/index.ts';
import { createAiHandler } from './core.ts';

const env = process.env;
const positive = (value: string | undefined, fallback: number): number => (Number(value) > 0 ? Number(value) : fallback);

const port = positive(env.PORT, 18420);
const publicDir = resolve(env.PUBLIC_DIR ?? 'public');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const ai = createAiHandler({
  apiKey: (env.AI_API_KEY ?? '').trim(),
  model: env.AI_MODEL,
  dailyLimit: positive(env.AI_DAILY_LIMIT, 300),
  perVisitorLimit: positive(env.AI_VISITOR_LIMIT, 40),
  content,
  ideaLexicon,
  ideaMaxLength: IDEA_MAX_LENGTH,
  routes: AI_ROUTES,
  log: (message) => console.warn(message),
});

/** Файл из папки игры по адресу запроса; null — такого файла нет или адрес выходит за пределы папки. */
function fileFor(url: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(url.split('?')[0] ?? '/');
  } catch {
    return null;
  }
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(publicDir, path));
  if (file !== publicDir && !file.startsWith(publicDir + sep)) return null;
  return existsSync(file) && statSync(file).isFile() ? file : null;
}

const server = createServer((req, res) => {
  // Настоящий адрес посетителя передаёт nginx; служба принимает соединения только от него.
  const forwarded = req.headers['x-real-ip'];
  const visitor = (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? req.socket.remoteAddress ?? 'unknown';

  void ai(req, res, visitor).then((mine) => {
    if (mine) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      return res.end();
    }
    const file = fileFor(req.url ?? '/');
    if (!file) {
      res.statusCode = 404;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      return res.end('Не найдено');
    }
    res.setHeader('content-type', MIME[extname(file)] ?? 'application/octet-stream');
    res.setHeader('x-content-type-options', 'nosniff');
    // У файлов в assets имя меняется с каждой сборкой — их можно хранить долго; страницу — проверять каждый раз.
    res.setHeader('cache-control', file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Startup Simulator: служба запущена на 127.0.0.1:${port}, нейросеть ${env.AI_API_KEY ? 'подключена' : 'не подключена (нет ключа)'}`);
});

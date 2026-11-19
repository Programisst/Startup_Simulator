// AI-посредник для разработки: работает внутри `npm run dev`, на компьютере разработчика.
// Берёт ключ из файла .env.local и сам ходит к нейросети. В браузер и в собранную игру ключ не попадает:
// этот файл выполняется только на стороне сервера разработки и в сборку не входит.
import { loadEnv, type Plugin } from 'vite';
import type { GameContent, IdeaLexicon } from '../../src/core/index.ts';
import { createAiHandler } from './core.ts';

/** Предохранитель от случайных трат при разработке. */
const DEFAULT_REQUEST_LIMIT = 300;

export function aiServer(): Plugin {
  return {
    name: 'startup-simulator-ai',
    apply: 'serve',
    async configureServer(server) {
      // Данные игры подгружаются через сам сервер разработки, а не при чтении настроек Vite.
      const { content } = (await server.ssrLoadModule('/src/content/index.ts')) as { content: GameContent };
      const { ideaLexicon } = (await server.ssrLoadModule('/src/content/ideas.ts')) as { ideaLexicon: IdeaLexicon };
      const { IDEA_MAX_LENGTH } = (await server.ssrLoadModule('/src/core/index.ts')) as { IDEA_MAX_LENGTH: number };
      const { AI_ROUTES } = (await server.ssrLoadModule('/src/ai/protocol.ts')) as typeof import('../../src/ai/protocol.ts');

      // Третий аргумент '' — читать все переменные, не только VITE_*. Они остаются на сервере.
      const env = loadEnv(server.config.mode, server.config.root, '');
      const limit = Number(env.AI_REQUEST_LIMIT) > 0 ? Number(env.AI_REQUEST_LIMIT) : DEFAULT_REQUEST_LIMIT;
      const handler = createAiHandler({
        apiKey: (env.AI_API_KEY ?? '').trim(),
        model: env.AI_MODEL,
        dailyLimit: limit,
        perVisitorLimit: limit,
        content,
        ideaLexicon,
        ideaMaxLength: IDEA_MAX_LENGTH,
        routes: AI_ROUTES,
        log: (message) => server.config.logger.warn(message),
      });

      server.middlewares.use((req, res, next) => {
        void handler(req, res, 'local').then((mine) => {
          if (!mine) next();
        });
      });
    },
  };
}

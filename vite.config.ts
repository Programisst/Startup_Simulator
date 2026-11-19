import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { aiServer } from './tools/ai-server/plugin.ts';

export default defineConfig(({ mode }) => ({
  // Относительные пути: игра работает и локально, и по адресу GitHub Pages.
  base: './',
  // aiServer работает только в `npm run dev`: в собранную игру он не входит.
  plugins: [react(), aiServer()],
  build: {
    // Для игры одним файлом (`npm run share`) квартира не выносится в отдельный файл:
    // из файла, открытого двойным щелчком, браузер не может подгрузить соседний.
    rollupOptions: { output: { inlineDynamicImports: mode === 'share' } },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
  },
}));

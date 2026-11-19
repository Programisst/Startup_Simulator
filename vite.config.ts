import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { aiServer } from './tools/ai-server/plugin.ts';

export default defineConfig({
  // Относительные пути: игра работает и локально, и по адресу GitHub Pages.
  base: './',
  // aiServer работает только в `npm run dev`: в собранную игру он не входит.
  plugins: [react(), aiServer()],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});

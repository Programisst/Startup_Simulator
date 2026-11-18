import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Относительные пути: игра работает и локально, и по адресу GitHub Pages.
  base: './',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});

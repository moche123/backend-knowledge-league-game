import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.(t|j)s'],
    },
  },
  plugins: [swc.vite()],
});

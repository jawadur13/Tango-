import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  server: {
    port: 5173,
    host: true
  },
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 25000
  }
});

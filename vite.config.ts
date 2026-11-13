import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // in development, send /api to a local `wrangler pages dev` (see README)
  server: { proxy: { '/api': 'http://127.0.0.1:8788' } },
});

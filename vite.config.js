import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
const hosting = JSON.parse(readFileSync(new URL('./.openai/hosting.json', import.meta.url), 'utf8'));

export default defineConfig({
  plugins: [react()],
  base: './',
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify(hosting.cloud_origin || '') },
  build: { outDir: 'docs', emptyOutDir: true },
});

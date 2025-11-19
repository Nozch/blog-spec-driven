import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const dirname = fileURLToPath(new URL('.', import.meta.url));
const composeAlias = path.resolve(dirname, 'app/(editor)/compose/page.tsx');

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    alias: {
      '../app/(editor)/compose/page': composeAlias,
      '@blog-spec/editor': path.resolve(dirname, '../../packages/editor/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    css: false,
    setupFiles: ['./vitest-setup.ts'],
    include: [
      'src/__tests__/**/*.spec.{ts,tsx}',
      'components/**/__tests__/**/*.test.{ts,tsx}',
      'src/lib/__tests__/**/*.test.{ts,tsx}',
    ],
  },
});

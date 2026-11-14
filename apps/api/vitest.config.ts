import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// O SWC é necessário para o Vitest respeitar os decoradores e a injeção de dependência do Nest.
export default defineConfig({
  test: { include: ['test/**/*.spec.ts'], environment: 'node' },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});

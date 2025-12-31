import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  shims: true,
  noExternal: [],
  external: ['@prisma/client', '@prisma/adapter-better-sqlite3'],
});

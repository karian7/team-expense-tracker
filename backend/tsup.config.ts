import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    server: 'src/server.ts',
    lambda: 'src/lambda.ts',
  },
  format: ['esm'],
  target: 'node20',
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  shims: true,
  noExternal: [],
  external: ['@prisma/client', '@prisma/adapter-pg', 'sharp', 'heic-convert'],
});

import { defineConfig } from 'prisma/config';

const shadowDbUrl = process.env.SHADOW_DATABASE_URL;

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
    ...(shadowDbUrl ? { shadowDatabaseUrl: shadowDbUrl } : {}),
  },
  migrations: {
    path: './prisma/migrations',
  },
});

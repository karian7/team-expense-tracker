import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL 환경 변수가 설정되어야 합니다.');
}

const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;
const adapter = new PrismaBetterSqlite3(
  { url: databaseUrl },
  shadowDatabaseUrl ? { shadowDatabaseUrl } : undefined
);

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;

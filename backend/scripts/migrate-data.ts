/**
 * SQLite → PostgreSQL (Supabase) 데이터 이관 스크립트
 *
 * 사용법:
 *   1. .env에 DATABASE_URL(PostgreSQL)과 SQLITE_URL(기존 SQLite 경로) 설정
 *   2. PostgreSQL에 마이그레이션 적용: npx prisma migrate deploy
 *   3. 실행: tsx scripts/migrate-data.ts
 */
import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import dotenv from 'dotenv';

dotenv.config();

const SQLITE_PATH = process.env.SQLITE_URL ?? './prisma/dev.db';

interface SqliteBudgetEvent {
  sequence: number;
  eventType: string;
  eventDate: string;
  year: number;
  month: number;
  authorName: string;
  amount: string;
  storeName: string | null;
  description: string | null;
  receiptImage: Buffer | null;
  ocrRawData: string | null;
  referenceSequence: number | null;
  createdAt: string;
}

interface SqliteSettings {
  id: string;
  key: string;
  value: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SqlitePushSubscription {
  id: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

async function migrate() {
  console.log('📦 SQLite → PostgreSQL 데이터 이관 시작...\n');

  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const prisma = new PrismaClient();

  try {
    // 1. BudgetEvent 이관
    const events = sqlite
      .prepare('SELECT * FROM budget_events ORDER BY sequence')
      .all() as SqliteBudgetEvent[];
    console.log(`📋 BudgetEvent: ${events.length}건 발견`);

    let maxSequence = 0;
    for (const event of events) {
      await prisma.budgetEvent.create({
        data: {
          sequence: event.sequence,
          eventType: event.eventType,
          eventDate: new Date(event.eventDate),
          year: event.year,
          month: event.month,
          authorName: event.authorName,
          amount: new Decimal(event.amount),
          storeName: event.storeName,
          description: event.description,
          receiptImage: event.receiptImage,
          ocrRawData: event.ocrRawData,
          referenceSequence: event.referenceSequence,
          createdAt: new Date(event.createdAt),
        },
      });
      maxSequence = Math.max(maxSequence, event.sequence);
    }
    console.log(`  ✅ ${events.length}건 삽입 완료 (max sequence: ${maxSequence})`);

    // PostgreSQL 시퀀스 동기화
    if (maxSequence > 0) {
      await prisma.$executeRawUnsafe(
        `ALTER SEQUENCE budget_events_sequence_seq RESTART WITH ${maxSequence + 1}`
      );
      console.log(`  🔄 시퀀스 동기화: ${maxSequence + 1}부터 시작`);
    }

    // 2. Settings 이관
    const settings = sqlite
      .prepare('SELECT * FROM settings ORDER BY key')
      .all() as SqliteSettings[];
    console.log(`\n⚙️  Settings: ${settings.length}건 발견`);

    for (const setting of settings) {
      await prisma.settings.create({
        data: {
          id: setting.id,
          key: setting.key,
          value: setting.value,
          description: setting.description,
          createdAt: new Date(setting.createdAt),
          updatedAt: new Date(setting.updatedAt),
        },
      });
    }
    console.log(`  ✅ ${settings.length}건 삽입 완료`);

    // 3. PushSubscription 이관
    const subscriptions = sqlite
      .prepare('SELECT * FROM push_subscriptions ORDER BY createdAt')
      .all() as SqlitePushSubscription[];
    console.log(`\n🔔 PushSubscription: ${subscriptions.length}건 발견`);

    for (const sub of subscriptions) {
      await prisma.pushSubscription.create({
        data: {
          id: sub.id,
          endpoint: sub.endpoint,
          p256dhKey: sub.p256dhKey,
          authKey: sub.authKey,
          userAgent: sub.userAgent,
          createdAt: new Date(sub.createdAt),
          updatedAt: new Date(sub.updatedAt),
        },
      });
    }
    console.log(`  ✅ ${subscriptions.length}건 삽입 완료`);

    console.log('\n🎉 데이터 이관 완료!');
  } catch (error) {
    console.error('\n❌ 이관 실패:', error);
    process.exit(1);
  } finally {
    sqlite.close();
    await prisma.$disconnect();
  }
}

migrate();

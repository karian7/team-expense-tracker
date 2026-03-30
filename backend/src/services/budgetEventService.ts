import prisma from '../utils/prisma';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { convertDecimalsToNumbers } from '../utils/decimal';
import { BudgetEventResponse, CreateBudgetEventRequest, SyncEventsResponse } from '../types';
import { BUDGET_EVENT_CONSTANTS } from '../constants/budgetEvents';
import { setNeedsFullSync } from './settingsService';
import { pushService } from './pushService';

// 중복 알림 방지용 캐시 (메모리 기반)
// key: "YYYY-MM", value: 마지막 알림 임계값 (80 | 90 | 100)
const notificationCache = new Map<string, number>();

// 테스트용: 알림 캐시 초기화
export function clearNotificationCache(): void {
  notificationCache.clear();
}

const isDefaultMonthlyBudgetPayload = (data: CreateBudgetEventRequest) =>
  data.eventType === 'BUDGET_IN' &&
  data.authorName === BUDGET_EVENT_CONSTANTS.SYSTEM_AUTHOR &&
  (data.description ?? '') === BUDGET_EVENT_CONSTANTS.MONTHLY_BUDGET_DESCRIPTION;

async function findExistingDefaultMonthlyBudgetEvent(data: CreateBudgetEventRequest) {
  return prisma.budgetEvent.findFirst({
    where: {
      year: data.year,
      month: data.month,
      eventType: data.eventType,
      authorName: data.authorName,
      description: data.description ?? null,
    },
    orderBy: {
      sequence: 'asc',
    },
  });
}

async function getLastResetSequence(): Promise<number> {
  const resetEvent = await prisma.budgetEvent.findFirst({
    where: {
      eventType: 'BUDGET_RESET',
    },
    orderBy: {
      sequence: 'desc',
    },
    select: {
      sequence: true,
    },
  });

  return resetEvent?.sequence ?? 0;
}

/**
 * 월별 잔액 계산 (푸시 알림 임계값 체크용)
 */
export async function calculateMonthlyBalance(
  year: number,
  month: number
): Promise<{
  totalBudget: number;
  spent: number;
  balance: number;
  spentPercentage: number;
}> {
  const events = await prisma.budgetEvent.findMany({
    where: { year, month },
    orderBy: { sequence: 'asc' },
  });

  let totalBudget = 0;
  let spent = 0;

  for (const event of events) {
    const amount = event.amount.toNumber();

    if (event.eventType === 'BUDGET_IN') {
      totalBudget += amount;
    } else if (event.eventType === 'EXPENSE') {
      spent += amount;
    } else if (event.eventType === 'BUDGET_ADJUSTMENT_INCREASE') {
      totalBudget += amount;
    } else if (event.eventType === 'BUDGET_ADJUSTMENT_DECREASE') {
      totalBudget -= amount;
    }
  }

  const balance = totalBudget - spent;
  const spentPercentage = totalBudget > 0 ? (spent / totalBudget) * 100 : 0;

  return { totalBudget, spent, balance, spentPercentage };
}

/**
 * 이벤트 타입에 따라 푸시 알림 전송
 */
async function sendPushNotificationForEvent(
  data: CreateBudgetEventRequest,
  _event: BudgetEventResponse
): Promise<void> {
  // 1. 새 지출 등록 시
  if (data.eventType === 'EXPENSE') {
    await pushService.sendToAll({
      title: '새로운 지출 등록',
      body: `${data.authorName}님이 ${data.storeName || '지출'} ${data.amount.toLocaleString('ko-KR')}원`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'new-expense',
      data: {
        url: `/#expense/${_event.sequence}`,
        expenseSequence: _event.sequence,
      },
    });

    // 지출 후 예산 임계값 체크
    await checkBudgetThreshold(data.year, data.month);
  }

  // 2. 예산 리셋 시
  if (data.eventType === 'BUDGET_RESET') {
    await pushService.sendToAll({
      title: '예산 초기화',
      body: '모든 예산 데이터가 초기화되었습니다.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'budget-reset',
      data: { url: '/' },
    });
  }
}

/**
 * 예산 임계값 체크 (80%, 100%)
 */
export async function checkBudgetThreshold(year: number, month: number): Promise<void> {
  const {
    totalBudget: _totalBudget,
    balance,
    spentPercentage,
  } = await calculateMonthlyBalance(year, month);
  const cacheKey = `${year}-${String(month).padStart(2, '0')}`;
  const lastNotifiedThreshold = notificationCache.get(cacheKey) || 0;

  // 100% 초과 (적자)
  if (spentPercentage >= 100 && lastNotifiedThreshold < 100) {
    await pushService.sendToAll({
      title: '⚠️ 예산 초과',
      body: `이번 달 예산을 모두 소진했습니다. 현재 ${Math.abs(balance).toLocaleString('ko-KR')}원 적자입니다.`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'budget-exceeded',
      data: { url: '/' },
    });
    notificationCache.set(cacheKey, 100);
  }
  // 90% 이상 100% 미만
  else if (spentPercentage >= 90 && spentPercentage < 100 && lastNotifiedThreshold < 90) {
    await pushService.sendToAll({
      title: '🚨 예산 위험',
      body: `이번 달 예산의 ${Math.round(spentPercentage)}%가 소진되었습니다. 남은 예산: ${balance.toLocaleString('ko-KR')}원`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'budget-warning-90',
      data: { url: '/' },
    });
    notificationCache.set(cacheKey, 90);
  }
  // 80% 이상 90% 미만
  else if (spentPercentage >= 80 && spentPercentage < 90 && lastNotifiedThreshold < 80) {
    await pushService.sendToAll({
      title: '⚠️ 예산 경고',
      body: `이번 달 예산의 ${Math.round(spentPercentage)}%가 소진되었습니다. 남은 예산: ${balance.toLocaleString('ko-KR')}원`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'budget-warning-80',
      data: { url: '/' },
    });
    notificationCache.set(cacheKey, 80);
  }
}

type PrismaBytes = Uint8Array<ArrayBuffer>;

const toBudgetEventResponse = (event: unknown): BudgetEventResponse => {
  const rawEvent = event as Record<string, unknown>;

  // Buffer 또는 Uint8Array를 base64로 변환 (PrismaPg 어댑터는 Uint8Array 반환)
  if (rawEvent.receiptImage instanceof Uint8Array) {
    rawEvent.receiptImage = Buffer.from(rawEvent.receiptImage).toString('base64');
  }

  return convertDecimalsToNumbers(rawEvent) as unknown as BudgetEventResponse;
};

const toBufferFromArrayBufferLike = (value: ArrayBuffer | ArrayBufferView): PrismaBytes => {
  if (value instanceof ArrayBuffer) {
    return Buffer.from(value) as PrismaBytes;
  }

  return Buffer.from(value.buffer, value.byteOffset, value.byteLength) as PrismaBytes;
};

const toBufferFromIntegerRecord = (value: Record<string, unknown>): PrismaBytes | null => {
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return null;
  }

  if (!keys.every((key) => /^\d+$/.test(key))) {
    return null;
  }

  const sortedIndexes = keys.map(Number).sort((a, b) => a - b);
  const lastIndex = sortedIndexes[sortedIndexes.length - 1];
  const buffer = Buffer.alloc(lastIndex + 1) as PrismaBytes;

  for (const index of sortedIndexes) {
    const raw = value[String(index)];
    if (typeof raw === 'number') {
      buffer[index] = raw & 0xff;
    } else if (typeof raw === 'string') {
      const parsed = Number.parseInt(raw, 10);
      buffer[index] = Number.isNaN(parsed) ? 0 : parsed & 0xff;
    } else {
      buffer[index] = 0;
    }
  }

  return buffer;
};

const toReceiptImageBuffer = (input?: unknown): PrismaBytes | null => {
  if (input == null) {
    return null;
  }

  if (typeof input === 'string') {
    return Buffer.from(input, 'base64') as PrismaBytes;
  }

  if (Buffer.isBuffer(input)) {
    return input as PrismaBytes;
  }

  if (input instanceof ArrayBuffer || ArrayBuffer.isView(input as ArrayBufferView)) {
    return toBufferFromArrayBufferLike(input as ArrayBuffer | ArrayBufferView);
  }

  if (Array.isArray(input)) {
    return Buffer.from(input) as PrismaBytes;
  }

  if (typeof input === 'object') {
    const candidate = input as {
      data?: unknown;
      base64?: unknown;
      encoding?: BufferEncoding;
    };

    if (typeof candidate.base64 === 'string') {
      return Buffer.from(candidate.base64, 'base64') as PrismaBytes;
    }

    if (candidate.data instanceof ArrayBuffer) {
      return toBufferFromArrayBufferLike(candidate.data);
    }

    if (candidate.data && ArrayBuffer.isView(candidate.data as ArrayBufferView)) {
      return toBufferFromArrayBufferLike(candidate.data as ArrayBufferView);
    }

    if (Array.isArray(candidate.data)) {
      return Buffer.from(candidate.data) as PrismaBytes;
    }

    if (typeof candidate.data === 'string') {
      return Buffer.from(candidate.data, candidate.encoding ?? 'base64') as PrismaBytes;
    }

    const fromNumericRecord = toBufferFromIntegerRecord(candidate);
    if (fromNumericRecord) {
      return fromNumericRecord;
    }
  }

  throw new Error('Unsupported receiptImage format. Provide a base64 string or binary data.');
};

export interface CreateEventOptions {
  sendPushNotification?: boolean;
}

/**
 * 이벤트 생성 (Append-Only)
 */
export async function createBudgetEvent(
  data: CreateBudgetEventRequest,
  options: CreateEventOptions = {}
): Promise<BudgetEventResponse> {
  const eventDate = new Date(data.eventDate);

  try {
    const event = await prisma.budgetEvent.create({
      data: {
        eventType: data.eventType,
        eventDate,
        year: data.year,
        month: data.month,
        authorName: data.authorName,
        amount: new Decimal(data.amount),
        storeName: data.storeName || null,
        description: data.description || null,
        receiptImage: toReceiptImageBuffer(data.receiptImage),
        ocrRawData: data.ocrRawData ? JSON.stringify(data.ocrRawData) : null,
        referenceSequence: data.referenceSequence ?? null,
      },
    });

    const eventResponse = toBudgetEventResponse(event);

    // 푸시 알림 전송 (비동기, 에러 무시)
    if (options.sendPushNotification !== false) {
      sendPushNotificationForEvent(data, eventResponse).catch((error) => {
        console.error('Failed to send push notification:', error);
      });
    }

    return eventResponse;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      isDefaultMonthlyBudgetPayload(data)
    ) {
      const existingEvent = await findExistingDefaultMonthlyBudgetEvent(data);
      if (existingEvent) {
        console.warn(`[BudgetEvent] ⚠️ Duplicate detected - returning existing event:`, {
          eventType: data.eventType,
          year: data.year,
          month: data.month,
          description: data.description,
          existingSequence: existingEvent.sequence,
          requestedAmount: data.amount,
          existingAmount: existingEvent.amount.toString(),
        });
        return toBudgetEventResponse(existingEvent);
      }
    }

    throw error;
  }
}

/**
 * 동기화 API: 특정 sequence 이후의 이벤트 조회
 */
export async function syncEvents(sinceSequence: number = 0): Promise<SyncEventsResponse> {
  const lastResetSequence = await getLastResetSequence();
  const effectiveSince =
    lastResetSequence > 0 && sinceSequence < lastResetSequence
      ? lastResetSequence - 1
      : sinceSequence;

  const events = await prisma.budgetEvent.findMany({
    where: {
      sequence: {
        gt: effectiveSince,
      },
    },
    orderBy: {
      sequence: 'asc',
    },
  });

  const lastSequence =
    events.length > 0
      ? events[events.length - 1].sequence
      : Math.max(effectiveSince, lastResetSequence);

  // DB 리셋 감지: 전체 이벤트 개수 확인
  const totalEventCount = await prisma.budgetEvent.count();
  let needsFullSync = false;

  if (totalEventCount === 0) {
    // 서버 DB가 리셋됨 → needsFullSync 플래그 설정
    await setNeedsFullSync(true);
    needsFullSync = true;
  }

  return {
    lastSequence,
    events: events.map(toBudgetEventResponse),
    needsFullSync,
  };
}

/**
 * Bulk 이벤트 생성 (Full Sync용)
 * 모든 이벤트를 트랜잭션으로 생성하며, 충돌 발생 시 전체 롤백
 */
export async function bulkCreateEvents(
  events: CreateBudgetEventRequest[]
): Promise<BudgetEventResponse[]> {
  const createdEvents = await prisma.$transaction(
    async (tx) => {
      const results: BudgetEventResponse[] = [];

      for (const data of events) {
        const eventDate = new Date(data.eventDate);

        const event = await tx.budgetEvent.create({
          data: {
            eventType: data.eventType,
            eventDate,
            year: data.year,
            month: data.month,
            authorName: data.authorName,
            amount: new Decimal(data.amount),
            storeName: data.storeName || null,
            description: data.description || null,
            receiptImage: toReceiptImageBuffer(data.receiptImage),
            ocrRawData: data.ocrRawData ? JSON.stringify(data.ocrRawData) : null,
            referenceSequence: data.referenceSequence ?? null,
          },
        });

        results.push(toBudgetEventResponse(event));
      }

      return results;
    },
    { timeout: 30000 } // 30초 타임아웃
  );

  // Full Sync 완료 → needsFullSync 플래그 제거
  await setNeedsFullSync(false);

  return createdEvents;
}

import prisma from '../utils/prisma';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { convertDecimalsToNumbers } from '../utils/decimal';
import {
  BudgetEventResponse,
  CreateBudgetEventRequest,
  SyncEventsResponse,
  MonthlyBudgetResponse,
} from '../types';
import { BUDGET_EVENT_CONSTANTS } from '../constants/budgetEvents';
import { setNeedsFullSync } from './settingsService';

const INCOMING_EVENT_TYPES = new Set(['BUDGET_IN', 'BUDGET_ADJUSTMENT_INCREASE']);

const OUTGOING_EVENT_TYPES = new Set(['EXPENSE', 'BUDGET_ADJUSTMENT_DECREASE']);

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

type PrismaBytes = Uint8Array<ArrayBuffer>;

const toBudgetEventResponse = (event: unknown): BudgetEventResponse => {
  const rawEvent = event as Record<string, unknown>;

  // Buffer를 base64로 변환
  if (rawEvent.receiptImage && Buffer.isBuffer(rawEvent.receiptImage)) {
    rawEvent.receiptImage = rawEvent.receiptImage.toString('base64');
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

/**
 * 이벤트 생성 (Append-Only)
 */
export async function createBudgetEvent(
  data: CreateBudgetEventRequest
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

    return toBudgetEventResponse(event);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      isDefaultMonthlyBudgetPayload(data)
    ) {
      console.info(
        `[BudgetEvent] Default monthly budget already exists for ${data.year}-${data.month}. Skipping duplicate.`
      );
      const existingEvent = await findExistingDefaultMonthlyBudgetEvent(data);
      if (existingEvent) {
        return toBudgetEventResponse(existingEvent);
      }
    }

    throw error;
  }
}

/**
 * 특정 월의 모든 이벤트 조회
 */
export async function getEventsByMonth(
  year: number,
  month: number
): Promise<BudgetEventResponse[]> {
  const lastResetSequence = await getLastResetSequence();
  const events = await prisma.budgetEvent.findMany({
    where: {
      year,
      month,
      ...(lastResetSequence > 0
        ? {
            sequence: {
              gte: lastResetSequence,
            },
          }
        : {}),
    },
    orderBy: {
      sequence: 'asc',
    },
  });

  return events.map(toBudgetEventResponse);
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
 * 특정 월의 예산 계산 (복식부기 방식)
 *
 * 복식부기 원칙:
 * 이전 달 잔액 + 이번 달 예산 유입 - 이번 달 지출 = 이번 달 잔액
 */
export async function calculateMonthlyBudget(
  year: number,
  month: number
): Promise<MonthlyBudgetResponse> {
  const events = await getEventsByMonth(year, month);

  let budgetIn = 0; // 이번 달 예산 유입
  let totalSpent = 0; // 이번 달 지출

  events.forEach((event) => {
    if (INCOMING_EVENT_TYPES.has(event.eventType)) {
      budgetIn += event.amount;
    } else if (OUTGOING_EVENT_TYPES.has(event.eventType)) {
      totalSpent += event.amount;
    } else if (event.eventType === 'EXPENSE_REVERSAL') {
      totalSpent -= event.amount;
    }
  });

  if (totalSpent < 0) {
    totalSpent = 0;
  }

  // 이전 달 잔액 계산 (재귀)
  let previousBalance = 0;
  if (year > 2000) {
    // 시작 연도 제한
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    // 무한 재귀 방지: 이전 달이 있는지 먼저 확인
    const prevEvents = await getEventsByMonth(prevYear, prevMonth);
    if (prevEvents.length > 0) {
      const prevBudget = await calculateMonthlyBudget(prevYear, prevMonth);
      previousBalance = prevBudget.balance;
    }
  }

  const totalBudget = previousBalance + budgetIn;
  const balance = totalBudget - totalSpent;

  return {
    year,
    month,
    budgetIn,
    previousBalance,
    totalBudget,
    totalSpent,
    balance,
    eventCount: events.length,
  };
}

/**
 * 전체 이벤트 수 조회
 */
export async function getEventCount(): Promise<number> {
  const lastResetSequence = await getLastResetSequence();
  return prisma.budgetEvent.count({
    where:
      lastResetSequence > 0
        ? {
            sequence: {
              gte: lastResetSequence,
            },
          }
        : undefined,
  });
}

/**
 * 최신 sequence 조회
 */
export async function getLatestSequence(): Promise<number> {
  const lastResetSequence = await getLastResetSequence();
  const latest = await prisma.budgetEvent.findFirst({
    where:
      lastResetSequence > 0
        ? {
            sequence: {
              gte: lastResetSequence,
            },
          }
        : undefined,
    orderBy: {
      sequence: 'desc',
    },
    select: {
      sequence: true,
    },
  });

  return latest?.sequence || lastResetSequence;
}

/**
 * 날짜 범위로 이벤트 조회
 */
export async function getEventsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<BudgetEventResponse[]> {
  const lastResetSequence = await getLastResetSequence();
  const events = await prisma.budgetEvent.findMany({
    where: {
      eventDate: {
        gte: startDate,
        lte: endDate,
      },
      ...(lastResetSequence > 0
        ? {
            sequence: {
              gte: lastResetSequence,
            },
          }
        : {}),
    },
    orderBy: {
      eventDate: 'desc',
    },
  });

  return events.map(toBudgetEventResponse);
}

/**
 * 특정 이벤트 조회
 */
export async function getEventBySequence(sequence: number): Promise<BudgetEventResponse | null> {
  const lastResetSequence = await getLastResetSequence();
  if (lastResetSequence > 0 && sequence < lastResetSequence) {
    return null;
  }

  const event = await prisma.budgetEvent.findUnique({
    where: {
      sequence,
    },
  });
  if (!event || (lastResetSequence > 0 && event.sequence < lastResetSequence)) {
    return null;
  }

  return toBudgetEventResponse(event);
}

export async function getEventByReferenceSequence(
  referenceSequence: number
): Promise<BudgetEventResponse | null> {
  const lastResetSequence = await getLastResetSequence();
  const event = await prisma.budgetEvent.findFirst({
    where: {
      referenceSequence,
      ...(lastResetSequence > 0
        ? {
            sequence: {
              gte: lastResetSequence,
            },
          }
        : {}),
    },
    orderBy: {
      sequence: 'desc',
    },
  });
  return event ? toBudgetEventResponse(event) : null;
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

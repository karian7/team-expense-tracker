import prisma from '../utils/prisma';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { convertDecimalsToNumbers } from '../utils/decimal';
import {
  BudgetEventResponse,
  CreateBudgetEventRequest,
  SyncEventsResponse,
  MonthlyBudgetResponse,
} from '../types';
import { BUDGET_EVENT_CONSTANTS } from '../constants/budgetEvents';

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

const toBudgetEventResponse = (event: unknown): BudgetEventResponse => {
  const rawEvent = event as Record<string, unknown>;

  // Buffer를 base64로 변환
  if (rawEvent.receiptImage && Buffer.isBuffer(rawEvent.receiptImage)) {
    rawEvent.receiptImage = rawEvent.receiptImage.toString('base64');
  }

  return convertDecimalsToNumbers(rawEvent) as unknown as BudgetEventResponse;
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
        receiptImage: data.receiptImage ? Buffer.from(data.receiptImage, 'base64') : null,
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

  return {
    lastSequence,
    events: events.map(toBudgetEventResponse),
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

# Event Sourcing 마이그레이션 현황

**작업 일시**: 2025-12-07  
**작업 상태**: Backend 완료 (100%) / Frontend 진행 중 (90%)

## 📋 목차

1. [개요](#개요)
2. [Backend 완료 사항](#backend-완료-사항)
3. [Frontend 진행 상황](#frontend-진행-상황)
4. [남은 작업](#남은-작업)
5. [테스트 방법](#테스트-방법)
6. [참고 문서](#참고-문서)

---

## 개요

### 변경 목표

- **기존**: 수정/삭제 가능한 일반 CRUD 방식
- **신규**: Append-Only Event Sourcing + 복식부기 원칙

### 핵심 개념

```
이월은 이벤트가 아닌 계산된 값!
이전 달 잔액 + 이번 달 예산 유입 - 이번 달 지출 = 이번 달 잔액
```

### 이벤트 타입 (지출/예산 조정 포함)

1. **BUDGET_IN**: 예산 유입 (기본 예산, 추가 예산)
2. **EXPENSE**: 지출 (영수증 기반)
3. **EXPENSE_REVERSAL**: 지출 삭제/환불 (대상 sequence 참조)
4. **BUDGET_ADJUSTMENT_INCREASE / _DECREASE**: 시스템/관리자 잔액 조정 이벤트

---

## Backend 완료 사항

### ✅ 1. DB 스키마 변경

**파일**: `backend/prisma/schema.prisma`

```prisma
model BudgetEvent {
  sequence    Int      @id @default(autoincrement())

  eventType   String   // "BUDGET_IN" | "EXPENSE" | "EXPENSE_REVERSAL" | "BUDGET_ADJUSTMENT_INCREASE" | "BUDGET_ADJUSTMENT_DECREASE"
  eventDate   DateTime
  year        Int
  month       Int

  authorName  String
  amount      Decimal
  storeName   String?
  description String?

  receiptImage Bytes?
  ocrRawData   String?
  referenceSequence Int?

  createdAt   DateTime @default(now())

  // Race Condition 방지
  @@unique([year, month, eventType, authorName, description])
  @@index([year, month])
  @@index([eventDate])
  @@index([authorName])
}
```

**마이그레이션**:

```bash
cd backend
npx prisma migrate dev --name event_sourcing_migration
```

### ✅ 2. 타입 정의

**파일**: `backend/src/types/index.ts`

```typescript
// Event
export interface BudgetEventResponse {
  sequence: number;
  eventType: 'BUDGET_IN' | 'EXPENSE' | 'EXPENSE_REVERSAL' | 'BUDGET_ADJUSTMENT_INCREASE' | 'BUDGET_ADJUSTMENT_DECREASE';
  eventDate: string;
  year: number;
  month: number;
  authorName: string;
  amount: number;
  storeName: string | null;
  description: string | null;
  receiptImage: string | null;
  ocrRawData: string | null;
  referenceSequence: number | null;
  createdAt: string;
}

// Monthly Budget (계산된 값)
export interface MonthlyBudgetResponse {
  year: number;
  month: number;
  budgetIn: number; // 이번 달 예산 유입
  previousBalance: number; // 이전 달 잔액 (계산됨!)
  totalBudget: number; // previousBalance + budgetIn
  totalSpent: number; // 이번 달 지출
  balance: number; // totalBudget - totalSpent
  eventCount: number;
}
```

### ✅ 3. 핵심 서비스

**파일**: `backend/src/services/budgetEventService.ts`

```typescript
// 이벤트 생성 (Append-Only)
export async function createBudgetEvent(data: CreateBudgetEventRequest);

// 특정 월 이벤트 조회
export async function getEventsByMonth(year: number, month: number);

// 월별 예산 계산 (재귀적 이월 계산)
export async function calculateMonthlyBudget(year: number, month: number) {
  // 1. 이번 달 이벤트 조회
  // 2. budgetIn, totalSpent 계산
  // 3. 이전 달 잔액 재귀 계산
  // 4. 복식부기 공식 적용
}

// 동기화 API
export async function getEventsForSync(sinceSequence: number);
```

### ✅ 4. Race Condition 방지

**방법**: Unique Constraint + Try-Catch + 재조회

```typescript
async function getOrCreateMonthlyBudget(year: number, month: number) {
  const events = await getEventsByMonth(year, month);
  if (events.length > 0) {
    return calculateMonthlyBudget(year, month);
  }

  try {
    await createBudgetEvent({
      eventType: 'BUDGET_IN',
      description: '기본 월별 예산', // ← Unique constraint
      // ...
    });
  } catch {
    // Unique 위반 = 다른 요청이 먼저 생성
    // 에러 무시하고 재조회
  }

  return calculateMonthlyBudget(year, month);
}
```

### ✅ 5. API 엔드포인트

**새로운 엔드포인트**:

```
POST   /api/events                    # 이벤트 생성
GET    /api/events/sync?since=0       # 동기화
GET    /api/events/month/:year/:month # 월별 이벤트
GET    /api/events/budget/:year/:month # 월별 예산 계산
```

**레거시 호환**:

```
GET    /api/monthly-budgets/current
GET    /api/monthly-budgets/:year/:month
```

### ✅ 6. 테스트 결과

```bash
# 1월 예산 생성
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "BUDGET_IN",
    "eventDate": "2025-01-01T00:00:00.000Z",
    "year": 2025, "month": 1,
    "authorName": "SYSTEM",
    "amount": 300000,
    "description": "1월 기본 예산"
  }'

# 1월 예산 조회
curl http://localhost:3001/api/events/budget/2025/1
# → budgetIn: 300000, balance: 300000 ✅

# 1월 지출 추가
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "EXPENSE",
    "eventDate": "2025-01-10T00:00:00.000Z",
    "year": 2025, "month": 1,
    "authorName": "홍길동",
    "amount": 50000,
    "storeName": "카페"
  }'

# 1월 최종 예산
curl http://localhost:3001/api/events/budget/2025/1
# → totalSpent: 50000, balance: 250000 ✅

# 2월 예산 생성
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "BUDGET_IN",
    "eventDate": "2025-02-01T00:00:00.000Z",
    "year": 2025, "month": 2,
    "authorName": "SYSTEM",
    "amount": 300000,
    "description": "2월 기본 예산"
  }'

# 2월 예산 조회 (자동 이월 확인)
curl http://localhost:3001/api/events/budget/2025/2
# → budgetIn: 300000
# → previousBalance: 250000 (1월 잔액, 자동 계산!)
# → totalBudget: 550000 ✅
```

### ✅ 7. 문서

- `docs/DOUBLE_ENTRY_ACCOUNTING.md`: 복식부기 상세 설명
- `docs/RACE_CONDITION_PREVENTION.md`: 동시성 제어
- `CLAUDE.md`: 복식부기 원칙 추가

---

## Frontend 진행 상황

### ✅ 완료된 작업 (90%)

#### 1. 타입 정의 업데이트

**파일**: `frontend/src/types/index.ts`

```typescript
// Budget Event (Backend와 동일)
export interface BudgetEvent {
  sequence: number;
  eventType: 'BUDGET_IN' | 'EXPENSE';
  eventDate: string;
  year: number;
  month: number;
  authorName: string;
  amount: number;
  storeName: string | null;
  description: string | null;
  receiptImage: string | null;
  ocrRawData: string | null;
  createdAt: string;
}

// Monthly Budget (계산된 값)
export interface MonthlyBudget {
  year: number;
  month: number;
  budgetIn: number; // baseAmount 대체
  previousBalance: number; // carriedAmount 대체
  totalBudget: number;
  totalSpent: number;
  balance: number;
  eventCount: number;
}

// Expense = BudgetEvent 별칭
export type Expense = BudgetEvent;
```

#### 2. Dexie DB 스키마 변경

**파일**: `frontend/src/services/db/database.ts`

```typescript
// Event Sourcing 방식
class ExpenseTrackerDB extends Dexie {
  budgetEvents!: Table<BudgetEvent, number>;
  settings!: Table<Settings, string>;
  syncMetadata!: Table<SyncMetadata, string>;

  constructor() {
    super('ExpenseTrackerDB');

    this.version(2).stores({
      budgetEvents: 'sequence, [year+month], eventType, eventDate',
      settings: 'key',
      syncMetadata: 'key',
    });
  }
}
```

#### 3. 핵심 서비스 생성

**파일**: `frontend/src/services/local/eventService.ts`

```typescript
export const eventService = {
  // 특정 월 이벤트 조회
  async getEventsByMonth(year: number, month: number): Promise<BudgetEvent[]>

  // 동기화용 (sequence 이후)
  async getEventsSince(sequence: number): Promise<BudgetEvent[]>

  // 최신 sequence
  async getLatestSequence(): Promise<number>

  // 이벤트 저장
  async saveEvents(events: BudgetEvent[]): Promise<void>

  // 월별 예산 계산 (클라이언트 사이드)
  async calculateMonthlyBudget(year: number, month: number) {
    // Backend와 동일한 로직
    // 1. 이번 달 이벤트에서 budgetIn, totalSpent 계산
    // 2. 이전 달 잔액 재귀 계산
    // 3. 복식부기 공식 적용
  }
}
```

**파일**: `frontend/src/services/sync/syncService.ts`

```typescript
export const syncService = {
  async sync(): Promise<{ newEvents: number; lastSequence: number }> {
    // 1. 로컬 최신 sequence 조회
    const lastSequence = await eventService.getLatestSequence();

    // 2. 서버에서 새 이벤트 가져오기
    const { events, lastSequence: serverSequence } = await eventApi.sync(lastSequence);

    // 3. 로컬에 저장
    await eventService.saveEvents(events);
    await eventService.updateLastSequence(serverSequence);

    return { newEvents: events.length, lastSequence: serverSequence };
  },
};
```

#### 4. Hooks 재작성

**파일**: `frontend/src/hooks/useBudget.ts`

```typescript
export function useCurrentBudget() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return useLiveQuery(() => budgetService.getMonthlyBudget(year, month), [year, month]);
}
```

**파일**: `frontend/src/hooks/useExpenses.ts`

```typescript
export function useExpenses(params?: { year?: number; month?: number }) {
  return useLiveQuery(async () => {
    if (!params?.year || !params?.month) return [];
    return expenseService.getExpensesByMonth(params.year, params.month);
  }, [params?.year, params?.month]);
}

export function useCreateExpense() {
  return {
    mutateAsync: async (data: ExpenseFormData) => {
      const now = new Date();
      return expenseApi.create({
        ...data,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      });
    },
  };
}
```

#### 5. 컴포넌트 수정

**완료**:

- ✅ `BudgetSummary.tsx`: `carriedAmount` → `previousBalance`
- ✅ `ExpenseList.tsx`: `id` → `sequence`, 삭제 버튼 비활성화
- ✅ `App.tsx`: `syncService.pull()` → `syncService.sync()`
- ✅ `MonthlyReportPage.tsx`: `expense.id` → `expense.sequence`

---

## 남은 작업

### 🔧 Frontend 완료 필요 (10%)

#### 1. ExpenseForm.tsx 수정 (우선순위: 높음)

**문제**: 구문 오류 발생

**파일**: `frontend/src/components/expense/ExpenseForm.tsx`

**현재 상태**:

```typescript
import type { CreateExpenseData } from '../../services/local/expenseService';
// ❌ CreateExpenseData가 더 이상 export되지 않음
```

**수정 방법**:

```typescript
// 1. import 수정
import type { ExpenseFormData } from '../../types';

// 2. handleSubmit 수정
const onSubmit = async (formData: ExpenseFormData) => {
  await createMutation.mutateAsync({
    authorName: formData.authorName,
    amount: formData.amount,
    expenseDate: formData.expenseDate,
    storeName: formData.storeName,
    receiptImage: imageBuffer,
    ocrRawData: ocrResult,
  });

  onSuccess?.();
};
```

#### 2. API 타입 정의 추가

**파일**: `frontend/src/services/api.ts`

```typescript
import type { BudgetEvent } from '../types';

export const eventApi = {
  sync: async (sinceSequence: number = 0) => {
    const { data } = await apiClient.get(`/events/sync?since=${sinceSequence}`);
    // ✅ 타입 명시
    return data.data as { lastSequence: number; events: BudgetEvent[] };
  },

  create: async (event: {
    eventType: 'BUDGET_IN' | 'EXPENSE';
    eventDate: string;
    year: number;
    month: number;
    authorName: string;
    amount: number;
    storeName?: string;
    description?: string;
    receiptImage?: string;
    ocrRawData?: Record<string, unknown>;
  }): Promise<BudgetEvent> => {
    const { data } = await apiClient.post('/events', event);
    return data.data;
  },
};
```

#### 3. 남은 컴포넌트 타입 에러 수정

**파일들**:

- `ExpenseList.tsx`: `expense.id` → `expense.sequence` (일부 누락된 부분)
- `ExpenseList.tsx`: `expense.expenseDate` → `expense.eventDate` (일부 누락)
- `ExpenseList.tsx`: `expense.receiptImageUrl` → `expense.receiptImage` (base64)

**수정 명령어**:

```bash
cd frontend/src/components/expense
sed -i '' 's/expense\.id/expense.sequence/g' ExpenseList.tsx
sed -i '' 's/expense\.expenseDate/expense.eventDate/g' ExpenseList.tsx
sed -i '' 's/expense\.receiptImageUrl/expense.receiptImage/g' ExpenseList.tsx
```

#### 4. NodeJS 타입 에러 수정

**파일**: `frontend/src/services/sync/syncService.ts`

```typescript
// ❌ 현재
startAutoSync(intervalMs: number = 30000): NodeJS.Timeout

// ✅ 수정
startAutoSync(intervalMs: number = 30000): number

// ✅ 또는 tsconfig.json에 추가
{
  "compilerOptions": {
    "types": ["node"]
  }
}
```

---

## 테스트 방법

### Backend 테스트

```bash
cd backend

# 1. DB 초기화 및 마이그레이션
rm -f prisma/dev.db
npx prisma migrate dev

# 2. 서버 시작
pnpm dev

# 3. 테스트 (다른 터미널)
# 1월 예산 생성
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{"eventType":"BUDGET_IN","eventDate":"2025-01-01T00:00:00Z","year":2025,"month":1,"authorName":"SYSTEM","amount":300000,"description":"기본 예산"}'

# 1월 지출 추가
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{"eventType":"EXPENSE","eventDate":"2025-01-10T00:00:00Z","year":2025,"month":1,"authorName":"홍길동","amount":50000,"storeName":"카페"}'

# 예산 조회
curl http://localhost:3001/api/events/budget/2025/1 | python3 -m json.tool

# 동기화 테스트
curl 'http://localhost:3001/api/events/sync?since=0' | python3 -m json.tool
```

**예상 결과**:

```json
{
  "success": true,
  "data": {
    "year": 2025,
    "month": 1,
    "budgetIn": 300000,
    "previousBalance": 0,
    "totalBudget": 300000,
    "totalSpent": 50000,
    "balance": 250000,
    "eventCount": 2
  }
}
```

### Frontend 테스트 (완료 후)

```bash
cd frontend

# 1. 의존성 설치
pnpm install

# 2. 빌드 테스트
pnpm build

# 3. Lint & Format
pnpm lint:fix
pnpm format

# 4. 개발 서버 시작
pnpm dev
```

**확인 사항**:

1. 예산 요약이 올바르게 표시되는가?
   - `previousBalance`가 "이월"로 표시
2. 지출 목록이 올바르게 표시되는가?
   - `sequence`가 key로 사용됨
3. 새 지출 추가가 작동하는가?
4. 동기화가 작동하는가?

---

## 참고 문서

### 새로 작성된 문서

1. **`docs/DOUBLE_ENTRY_ACCOUNTING.md`**
   - 복식부기 원칙 상세 설명
   - 이월 계산 방식
   - 예시 시나리오

2. **`docs/RACE_CONDITION_PREVENTION.md`**
   - 동시 접속 문제 해결
   - Unique Constraint 설명
   - 성능 영향 분석

3. **`CLAUDE.md` (업데이트)**
   - 복식부기 원칙 추가
   - Race Condition 방지 추가

### 기존 문서

- `README.md`: 프로젝트 개요
- `docs/OCR_CONFIGURATION.md`: OCR 설정

---

## 다음 세션 시작 시 체크리스트

### 1단계: 환경 확인

```bash
# Backend 서버 실행 확인
curl http://localhost:3001/api/events/sync?since=0

# 만약 안되면
cd backend && pnpm dev
```

### 2단계: Frontend 남은 작업 완료

```bash
cd frontend/src

# 1. ExpenseForm.tsx 수정
# - import 수정: CreateExpenseData → ExpenseFormData
# - handleSubmit 로직 수정

# 2. 타입 에러 일괄 수정
cd components/expense
sed -i '' 's/expense\.id/expense.sequence/g' ExpenseList.tsx
sed -i '' 's/expense\.expenseDate/expense.eventDate/g' ExpenseList.tsx

# 3. API 타입 추가
# services/api.ts에 BudgetEvent import 추가

# 4. 빌드 테스트
cd ../..
pnpm build
```

### 3단계: 통합 테스트

```bash
# Backend + Frontend 동시 실행
cd /Users/karian7/workspace/team-expense-tracker
pnpm dev

# 브라우저에서 확인
open http://localhost:5173
```

### 4단계: 문서 업데이트

- [ ] README.md에 Event Sourcing 방식 추가
- [ ] 마이그레이션 가이드 작성 (필요 시)

---

## 트러블슈팅

### 문제 1: TypeScript 캐시 문제

**증상**: 파일을 수정했는데 타입 에러가 사라지지 않음

**해결**:

```bash
cd frontend
rm -rf node_modules/.vite tsconfig.tsbuildinfo
pnpm build --force
```

### 문제 2: DB 스키마 불일치

**증상**: Prisma 에러 발생

**해결**:

```bash
cd backend
rm -f prisma/dev.db
npx prisma migrate dev
npx prisma generate
```

### 문제 3: 동기화 실패

**증상**: 클라이언트에서 서버 데이터를 못 가져옴

**확인**:

```bash
# 서버 로그 확인
cd backend && pnpm dev

# API 테스트
curl http://localhost:3001/api/events/sync?since=0
```

---

## 요약

### ✅ 완료

- Backend Event Sourcing 전환 (100%)
- 복식부기 원칙 적용
- Race Condition 방지
- Frontend 타입/DB/서비스 구조 변경 (90%)

### 🔧 남은 작업 (예상 1-2시간)

- ExpenseForm.tsx 수정
- 남은 타입 에러 수정
- 통합 테스트

### 📚 핵심 개념

```
이월 = 이전 달 잔액 (계산됨, 이벤트 아님)
이벤트 = BUDGET_IN | EXPENSE (2가지만)
수정/삭제 = 불가능 (Append-Only)
동기화 = sequence 기반
```

**다음 세션에서 ExpenseForm.tsx 수정부터 시작하세요!**

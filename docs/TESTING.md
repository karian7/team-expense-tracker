# 테스트 코드 가이드

팀 회식비 관리 서비스의 테스트 코드 상세 문서입니다.

## 목차

- [테스트 전략](#테스트-전략)
- [Backend 테스트](#backend-테스트)
- [Frontend 테스트](#frontend-테스트)
- [E2E 테스트](#e2e-테스트)
- [테스트 실행 방법](#테스트-실행-방법)

---

## 테스트 전략

### 테스트 피라미드

```
        /\
       /  \     E2E 테스트 (3개 시나리오)
      /----\    - 실제 브라우저에서 전체 플로우 검증
     /      \
    /--------\  통합 테스트 (서비스 레벨)
   /          \ - API, 훅, 서비스 간 상호작용
  /------------\
 /   단위 테스트  \ - 개별 함수/모듈의 로직 검증
/________________\
```

### 테스트 도구

| 영역 | 도구 | 용도 |
|------|------|------|
| Backend | Vitest + vitest-mock-extended | 단위 테스트, Prisma mock |
| Frontend | Vitest + @testing-library/react | 단위 테스트, 훅 테스트 |
| Frontend | fake-indexeddb | IndexedDB mock |
| Frontend | axios-mock-adapter | API 호출 mock |
| E2E | Playwright | 브라우저 자동화 테스트 |

---

## Backend 테스트

### 1. budgetEventService.test.ts

**파일 위치**: `backend/src/services/budgetEventService.test.ts`

#### Why (왜 테스트하는가?)

`budgetEventService`는 이벤트 소싱 아키텍처의 핵심입니다. 모든 예산/지출 데이터가 이벤트로 저장되며, 잘못된 이벤트 생성은 전체 데이터 무결성을 손상시킵니다.

#### What (무엇을 테스트하는가?)

| 테스트 케이스 | 검증 내용 |
|--------------|----------|
| `createBudgetEvent`: 이벤트 생성 | 기본적인 이벤트 생성 및 저장 |
| `createBudgetEvent`: Race Condition 처리 | 동시에 같은 월 예산 생성 시 중복 방지 |
| `syncEvents`: sequence 기반 조회 | 특정 sequence 이후 이벤트만 반환 |
| `syncEvents`: BUDGET_RESET 필터링 | 리셋 이벤트 이후 데이터만 반환 |
| `syncEvents`: needsFullSync 플래그 | DB 비어있을 때 Full Sync 필요 표시 |
| `calculateMonthlyBalance`: 예산 계산 | BUDGET_IN + EXPENSE 정확한 계산 |
| `calculateMonthlyBalance`: 조정 반영 | BUDGET_ADJUSTMENT 증감 반영 |
| `calculateMonthlyBalance`: 퍼센트 | spentPercentage 정확도 |
| `checkBudgetThreshold`: 80% 경고 | 예산 80% 소진 시 알림 |
| `checkBudgetThreshold`: 90% 위험 | 예산 90% 소진 시 알림 |
| `checkBudgetThreshold`: 100% 초과 | 예산 초과(적자) 시 알림 |
| `checkBudgetThreshold`: 중복 방지 | 같은 임계값 알림 재발송 방지 |

#### How (어떻게 테스트하는가?)

```typescript
// Prisma mock 사용
import { prismaMock } from '../test/setup';

// 1. Mock 데이터 설정
prismaMock.budgetEvent.create.mockResolvedValue(mockEvent);

// 2. 함수 호출
const result = await createBudgetEvent(data, { sendPushNotification: false });

// 3. 결과 검증
expect(result.sequence).toBe(1);
expect(prismaMock.budgetEvent.create).toHaveBeenCalledOnce();
```

**핵심 테스트 패턴**:
- `sendPushNotification: false` 옵션으로 푸시 알림 비활성화 (테스트 격리)
- `clearNotificationCache()` 호출로 테스트 간 상태 초기화
- Prisma 에러 시뮬레이션으로 Race Condition 테스트

---

### 2. settingsService.test.ts

**파일 위치**: `backend/src/services/settingsService.test.ts`

#### Why (왜 테스트하는가?)

앱 설정(기본 예산, 초기 예산)은 시스템 전체 동작에 영향을 미칩니다. 설정 조회/저장의 정확성은 필수입니다.

#### What (무엇을 테스트하는가?)

| 테스트 케이스 | 검증 내용 |
|--------------|----------|
| `getSetting`: 값 반환 | 저장된 설정 값 조회 |
| `getSetting`: null 반환 | 존재하지 않는 키 처리 |
| `setSetting`: upsert 동작 | 설정 생성/업데이트 |
| `getAppSettings`: 기본값 | 설정 없을 때 기본값 반환 |
| `getAppSettings`: 저장된 값 | 설정 있을 때 해당 값 반환 |
| `getAppSettings`: needsFullSync 자동 해제 | 이벤트 존재 시 플래그 리셋 |
| `setInitialBudget`: 트랜잭션 | 초기/기본 예산 동시 설정 |

#### How (어떻게 테스트하는가?)

```typescript
// Mock 설정
prismaMock.settings.findUnique.mockResolvedValue({
  key: 'default_monthly_budget',
  value: '300000',
  description: null,
});

// 함수 호출 및 검증
const result = await getAppSettings();
expect(result.defaultMonthlyBudget).toBe(300000);
```

---

### 3. pushService.test.ts

**파일 위치**: `backend/src/services/pushService.test.ts`

#### Why (왜 테스트하는가?)

푸시 알림은 사용자 경험의 핵심입니다. 다양한 에러 상황(404, 410, 429 등)에서의 올바른 처리가 중요합니다.

#### What (무엇을 테스트하는가?)

| 테스트 케이스 | 검증 내용 |
|--------------|----------|
| `sendNotification`: 성공 | 정상 전송 시 success: true |
| `sendNotification`: 404/410 | 무효 구독 → shouldRemove: true |
| `sendNotification`: 401/403 | 인증 실패 → shouldRemove: true |
| `sendNotification`: 429 | Rate limit → shouldRemove: false (재시도 가능) |
| `sendToAll`: 모든 구독 전송 | 등록된 모든 구독에 전송 |
| `sendToAll`: 무효 구독 삭제 | 전송 실패한 구독 자동 정리 |
| `createOrUpdateSubscription`: Upsert | 구독 생성/업데이트 |

#### How (어떻게 테스트하는가?)

```typescript
// web-push mock
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

// 에러 시뮬레이션
vi.mocked(webpush.sendNotification).mockRejectedValue({ statusCode: 410 });

// 검증
const result = await pushService.sendNotification(...);
expect(result.shouldRemove).toBe(true);
```

---

## Frontend 테스트

### 1. eventService.test.ts

**파일 위치**: `frontend/src/services/local/eventService.test.ts`

#### Why (왜 테스트하는가?)

`eventService`는 로컬 퍼스트 아키텍처의 핵심입니다. IndexedDB에 이벤트를 저장하고, 월별 예산을 계산합니다.

#### What (무엇을 테스트하는가?)

| 테스트 케이스 | 검증 내용 |
|--------------|----------|
| BUDGET_RESET 필터링 | 리셋 이후 이벤트만 조회 |
| BUDGET_RESET 음수 sequence | 로컬 리셋(음수)도 정상 처리 |
| `calculateMonthlyBudget`: 이월 계산 | 이전 달 잔액 → 다음 달 이월 |
| `calculateMonthlyBudget`: 복식부기 | BUDGET_IN + ADJUSTMENT - EXPENSE |
| `createLocalEvent`: 음수 sequence | 로컬 이벤트는 음수 sequence 생성 |
| `clearAll`: 데이터 초기화 | 모든 로컬 데이터 삭제 |

#### How (어떻게 테스트하는가?)

```typescript
// fake-indexeddb 자동 로드 (setup.ts)
import 'fake-indexeddb/auto';

// 테스트 전 DB 초기화
beforeEach(async () => {
  await db.delete();
  await db.open();
});

// 이벤트 저장 및 검증
await eventService.saveEvents([...events]);
const result = await eventService.calculateMonthlyBudget(2025, 2);
expect(result.previousBalance).toBe(250000);
```

**핵심 포인트**:
- `fake-indexeddb`로 실제 IndexedDB 동작 시뮬레이션
- `createEvent` 헬퍼 함수로 테스트 데이터 생성 간소화

---

### 2. syncService.test.ts

**파일 위치**: `frontend/src/services/sync/syncService.test.ts`

#### Why (왜 테스트하는가?)

`syncService`는 로컬-서버 간 데이터 동기화를 담당합니다. 오프라인 지원, 충돌 해결, sequence 재할당이 정확해야 합니다.

#### What (무엇을 테스트하는가?)

| 테스트 케이스 | 검증 내용 |
|--------------|----------|
| BUDGET_RESET 이후 이벤트만 계산 | 리셋 이전 데이터 무시 |
| 시간 기반 pending 필터링 | 리셋 이전 pending 삭제, 이후 유지 |
| Sequence 재할당 (1개) | 서버 최신 + 1로 재할당 |
| Sequence 재할당 (여러 개) | 순차적으로 +1, +2, +3... |
| BUDGET_RESET + Sequence 재할당 | 복합 시나리오 |
| 지수 백오프 | 재시도 간격: 1s, 2s, 4s... |
| 5회 초과 재시도 | 최대 재시도 후 건너뛰기 |
| 네트워크 에러 처리 | 에러 시 retryCount 증가 |

#### How (어떻게 테스트하는가?)

```typescript
// API mock
vi.mock('../api', () => ({
  eventApi: {
    createEvent: vi.fn(),
    sync: vi.fn(),
  },
  settingsApi: { get: vi.fn() },
}));

// 시나리오 설정
vi.mocked(eventApi.sync).mockResolvedValue({
  events: [{ sequence: 100, eventType: 'BUDGET_RESET', ... }],
  lastSequence: 100,
  needsFullSync: false,
});

// 동기화 실행 및 검증
await syncService.sync();
const pending = await pendingEventService.getAll();
expect(pending[0].tempSequence).toBe(101); // 재할당됨
```

---

### 3. pendingEventService.test.ts

**파일 위치**: `frontend/src/services/local/pendingEventService.test.ts`

#### Why (왜 테스트하는가?)

`pendingEventService`는 오프라인에서 생성된 이벤트를 관리합니다. 동기화 대기열의 정확한 관리가 필수입니다.

#### What (무엇을 테스트하는가?)

| 테스트 케이스 | 검증 내용 |
|--------------|----------|
| `enqueue`: pending 생성 | 대기열에 이벤트 추가 |
| `enqueue`: 음수 tempSequence | 로컬 식별자로 음수 사용 |
| `enqueue`: createdAt 타임스탬프 | 생성 시간 기록 |
| `getAll`: createdAt 순 정렬 | 오래된 것부터 처리 |
| `getAll`: 동일 시간 시 tempSequence 역순 | 정렬 규칙 |
| `updateStatus`: 상태 전이 | pending → syncing → failed |
| `updateStatus`: lastError 설정 | 에러 메시지 저장 |

#### How (어떻게 테스트하는가?)

```typescript
// pending 이벤트 생성
const pending = await pendingEventService.enqueue(payload, -1000);
expect(pending.status).toBe('pending');
expect(pending.tempSequence).toBe(-1000);

// 상태 업데이트
await pendingEventService.updateStatus(pending.id, 'failed', 'Network error');
const updated = await db.pendingEvents.get(pending.id);
expect(updated?.lastError).toBe('Network error');
```

---

### 4. budgetService.test.ts

**파일 위치**: `frontend/src/services/local/budgetService.test.ts`

#### Why (왜 테스트하는가?)

`budgetService`는 월별 예산 자동 생성을 담당합니다. 중복 생성 방지와 서버 설정 연동이 중요합니다.

#### What (무엇을 테스트하는가?)

| 테스트 케이스 | 검증 내용 |
|--------------|----------|
| `ensureMonthlyBudget`: 초기 동기화 미완료 시 건너뜀 | 서버 연결 전 생성 방지 |
| `ensureMonthlyBudget`: 이미 존재 시 false | 중복 생성 방지 |
| `ensureMonthlyBudget`: 서버에서 가져와 생성 | defaultBudget 조회 후 생성 |
| `ensureMonthlyBudget`: TaskMap 중복 방지 | 동시 호출 시 한 번만 실행 |
| `getMonthlyBudget`: eventService 위임 | 계산 로직 위임 |

#### How (어떻게 테스트하는가?)

```typescript
// Mock 설정
vi.spyOn(settingsService, 'isInitialSyncCompleted').mockResolvedValue(true);
vi.mocked(settingsApi.getDefaultMonthlyBudget).mockResolvedValue(300000);

// 동시 호출 테스트
const results = await Promise.all([
  budgetService.ensureMonthlyBudget(2025, 2),
  budgetService.ensureMonthlyBudget(2025, 2),
  budgetService.ensureMonthlyBudget(2025, 2),
]);

// API는 한 번만 호출됨
expect(settingsApi.getDefaultMonthlyBudget).toHaveBeenCalledTimes(1);
```

---

### 5. expenseService.test.ts

**파일 위치**: `frontend/src/services/local/expenseService.test.ts`

#### Why (왜 테스트하는가?)

`expenseService`는 지출 조회/삭제 로직을 담당합니다. EXPENSE_REVERSAL을 통한 삭제 처리가 핵심입니다.

#### What (무엇을 테스트하는가?)

| 테스트 케이스 | 검증 내용 |
|--------------|----------|
| `getExpensesByMonth`: EXPENSE만 필터링 | 다른 이벤트 타입 제외 |
| `getExpensesByMonth`: REVERSAL 제외 | 삭제된 지출 목록에서 제외 |
| `getExpensesByMonth`: eventDate 순 정렬 | 날짜순 정렬 |
| `isExpenseDeleted`: REVERSAL 존재 시 true | 삭제 여부 확인 |
| `isExpenseDeleted`: 미삭제 시 false | 활성 지출 확인 |
| `getExpenseById`: 삭제된 지출 undefined | 삭제된 항목 조회 불가 |

#### How (어떻게 테스트하는가?)

```typescript
// EXPENSE_REVERSAL로 삭제 처리
await eventService.saveEvents([
  { sequence: 1, eventType: 'EXPENSE', amount: 50000 },
  { sequence: 2, eventType: 'EXPENSE_REVERSAL', referenceSequence: 1 },
]);

// 삭제된 지출은 목록에서 제외
const expenses = await expenseService.getExpensesByMonth(2025, 1);
expect(expenses.find(e => e.sequence === 1)).toBeUndefined();

// isExpenseDeleted 검증
expect(await expenseService.isExpenseDeleted(1)).toBe(true);
```

---

### 6. api.test.ts

**파일 위치**: `frontend/src/services/api.test.ts`

#### Why (왜 테스트하는가?)

API 클라이언트는 서버와의 통신을 담당합니다. 요청 형식, 타임아웃, 에러 처리가 정확해야 합니다.

#### What (무엇을 테스트하는가?)

| 테스트 케이스 | 검증 내용 |
|--------------|----------|
| `eventApi.sync`: since 파라미터 | 쿼리 파라미터 정확히 전달 |
| `eventApi.sync`: 5초 타임아웃 | 타임아웃 설정 확인 |
| `eventApi.sync`: needsFullSync 플래그 | 응답 플래그 반환 |
| `eventApi.createEvent`: 성공 | 이벤트 생성 요청 |
| `eventApi.createEvent`: 서버 에러 | 500 에러 처리 |
| `settingsApi.get`: 설정 조회 | 앱 설정 반환 |
| `settingsApi.setInitialBudget`: 초기 예산 | 요청 본문 검증 |

#### How (어떻게 테스트하는가?)

```typescript
// axios-mock-adapter 사용
import MockAdapter from 'axios-mock-adapter';
const mock = new MockAdapter(apiClient);

// Mock 응답 설정
mock.onGet('/events/sync?since=100').reply(200, {
  data: { lastSequence: 105, events: [], needsFullSync: false },
});

// 호출 및 검증
const result = await eventApi.sync(100);
expect(result.lastSequence).toBe(105);
expect(mock.history.get[0].url).toBe('/events/sync?since=100');
```

---

### 7. useBudget.test.tsx

**파일 위치**: `frontend/src/hooks/useBudget.test.tsx`

#### Why (왜 테스트하는가?)

`useBudget` 훅은 React 컴포넌트에서 예산 데이터를 사용하는 인터페이스입니다. 예산 조정 로직의 정확성이 중요합니다.

#### What (무엇을 테스트하는가?)

| 테스트 케이스 | 검증 내용 |
|--------------|----------|
| `useAdjustCurrentBudget`: 양수 조정 | BUDGET_ADJUSTMENT_INCREASE 생성 |
| `useAdjustCurrentBudget`: 음수 조정 | BUDGET_ADJUSTMENT_DECREASE 생성 |
| `useAdjustCurrentBudget`: 동기화 실패 시 | 로컬 이벤트 유지 |

#### How (어떻게 테스트하는가?)

```typescript
import { renderHook } from '@testing-library/react';

// Mock 설정
vi.mocked(budgetService.getCurrentBudget).mockResolvedValue({
  balance: 250000,
  ...
});

// 훅 렌더링
const { result } = renderHook(() => useAdjustCurrentBudget());

// 조정 실행
await result.current.mutateAsync({
  targetBalance: 300000,  // 250000 → 300000 (증가)
  description: '추가 예산',
});

// INCREASE 이벤트 생성 확인
expect(eventService.createLocalEvent).toHaveBeenCalledWith(
  expect.objectContaining({
    eventType: 'BUDGET_ADJUSTMENT_INCREASE',
    amount: 50000,
  })
);
```

---

### 8. useExpenses.test.tsx

**파일 위치**: `frontend/src/hooks/useExpenses.test.tsx`

#### Why (왜 테스트하는가?)

`useExpenses` 훅은 지출 생성/삭제를 담당합니다. 이벤트 소싱 원칙(EXPENSE_REVERSAL)이 정확히 적용되어야 합니다.

#### What (무엇을 테스트하는가?)

| 테스트 케이스 | 검증 내용 |
|--------------|----------|
| `useCreateExpense`: 지출 생성 | EXPENSE 이벤트 생성 |
| `useCreateExpense`: 음수 sequence | 로컬 이벤트 식별자 |
| `useDeleteExpense`: REVERSAL 생성 | EXPENSE_REVERSAL 이벤트 |
| `useDeleteExpense`: referenceSequence | 원본 지출 참조 |
| `useDeleteExpense`: 지출 없음 에러 | 존재하지 않는 지출 |
| `useDeleteExpense`: 이미 삭제됨 에러 | 중복 삭제 방지 |

#### How (어떻게 테스트하는가?)

```typescript
// 삭제 테스트
vi.mocked(expenseService.getExpenseById).mockResolvedValue({
  sequence: 1,
  amount: 50000,
  ...
});
vi.mocked(expenseService.isExpenseDeleted).mockResolvedValue(false);

const { result } = renderHook(() => useDeleteExpense());
await result.current.mutateAsync({ sequence: 1 });

// EXPENSE_REVERSAL 생성 확인
expect(eventService.createLocalEvent).toHaveBeenCalledWith(
  expect.objectContaining({
    eventType: 'EXPENSE_REVERSAL',
    referenceSequence: 1,
  })
);
```

---

## E2E 테스트

### 1. expense-flow.spec.ts

**파일 위치**: `e2e/tests/expense-flow.spec.ts`

#### Why (왜 테스트하는가?)

실제 사용자 시나리오를 검증합니다. 지출 등록부터 삭제까지 전체 플로우가 정상 동작해야 합니다.

#### What (무엇을 테스트하는가?)

| 테스트 시나리오 | 검증 내용 |
|----------------|----------|
| 영수증 없이 직접 입력 | 폼 입력 → 저장 → 목록 표시 |
| 지출 목록 표시 | 예산 정보 및 지출 목록 UI |
| 지출 삭제 | 삭제 버튼 → 확인 → 목록에서 제거 |

#### How (어떻게 테스트하는가?)

```typescript
test('영수증 없이 직접 입력', async ({ page }) => {
  // DB 초기화
  await resetDatabase();
  await seedInitialBudget(300000);

  // 지출 등록 페이지
  await page.goto('/expense/new');
  
  // 폼 입력
  await page.getByLabel(/이름/).fill('테스트유저');
  await page.getByLabel(/금액/).fill('50000');
  
  // 저장
  await page.getByRole('button', { name: /저장/ }).click();
  
  // 결과 확인
  await expect(page).toHaveURL(/\/$|\/expense/);
});
```

---

### 2. budget-view.spec.ts

**파일 위치**: `e2e/tests/budget-view.spec.ts`

#### Why (왜 테스트하는가?)

예산 표시와 조정 기능을 검증합니다. 복식부기 원칙이 UI에 정확히 반영되어야 합니다.

#### What (무엇을 테스트하는가?)

| 테스트 시나리오 | 검증 내용 |
|----------------|----------|
| 현재 월 예산 표시 | 예산 금액 UI 표시 |
| 지출 후 잔액 감소 | 300,000 - 50,000 = 250,000 |
| 예산 조정 (증가) | BUDGET_ADJUSTMENT_INCREASE 반영 |
| 예산 조정 (감소) | BUDGET_ADJUSTMENT_DECREASE 반영 |

---

### 3. offline-sync.spec.ts

**파일 위치**: `e2e/tests/offline-sync.spec.ts`

#### Why (왜 테스트하는가?)

로컬 퍼스트 아키텍처의 핵심 기능입니다. 오프라인에서도 작동하고, 온라인 복귀 시 동기화되어야 합니다.

#### What (무엇을 테스트하는가?)

| 테스트 시나리오 | 검증 내용 |
|----------------|----------|
| 오프라인 지출 등록 → 온라인 동기화 | 오프라인 저장 → 복귀 후 서버 동기화 |
| 동기화 상태 표시 | 동기화 인디케이터 UI |
| 네트워크 복구 후 pending 동기화 | 여러 pending 이벤트 일괄 동기화 |

#### How (어떻게 테스트하는가?)

```typescript
test('오프라인 지출 등록', async ({ page, context }) => {
  // 오프라인 전환
  await context.setOffline(true);
  
  // 지출 등록 (로컬 저장)
  await page.goto('/expense/new');
  await page.getByLabel(/금액/).fill('50000');
  await page.getByRole('button', { name: /저장/ }).click();
  
  // 온라인 복귀
  await context.setOffline(false);
  
  // 동기화 대기
  await page.waitForTimeout(3000);
  
  // 데이터 유지 확인
  await page.reload();
  await expect(page.getByText(/50,000/)).toBeVisible();
});
```

---

## 테스트 실행 방법

### Backend 테스트

```bash
cd backend
pnpm test           # 테스트 실행
pnpm test:watch     # 감시 모드
pnpm test:coverage  # 커버리지 리포트
```

### Frontend 테스트

```bash
cd frontend
pnpm test           # 테스트 실행
pnpm test:watch     # 감시 모드
pnpm test:ui        # Vitest UI
```

### E2E 테스트

```bash
# 프로젝트 루트에서
pnpm test:e2e           # E2E 실행
pnpm test:e2e:ui        # Playwright UI
pnpm test:e2e:headed    # 브라우저 표시
pnpm test:e2e:report    # 리포트 보기
```

### 전체 테스트 (CI)

```bash
# GitHub Actions에서 자동 실행
# .github/workflows/test.yml 참고
```

---

## 테스트 작성 가이드라인

### 1. 테스트 격리

```typescript
beforeEach(async () => {
  vi.clearAllMocks();      // Mock 초기화
  await db.delete();        // DB 초기화
  await db.open();
});
```

### 2. 명확한 테스트 이름

```typescript
// ❌ 불명확
it('should work', ...);

// ✅ 명확
it('should return shouldRemove: true on 404 status code', ...);
```

### 3. AAA 패턴

```typescript
it('should calculate balance correctly', async () => {
  // Arrange (준비)
  await eventService.saveEvents([...]);
  
  // Act (실행)
  const result = await eventService.calculateMonthlyBudget(2025, 1);
  
  // Assert (검증)
  expect(result.balance).toBe(250000);
});
```

### 4. 에지 케이스 테스트

- 빈 데이터
- 경계값 (0, 음수, 최대값)
- 동시 호출
- 네트워크 에러
- 권한 에러

---

## 참고 문서

- [Vitest 공식 문서](https://vitest.dev/)
- [Testing Library 공식 문서](https://testing-library.com/)
- [Playwright 공식 문서](https://playwright.dev/)
- [복식부기 원칙](./DOUBLE_ENTRY_ACCOUNTING.md)
- [Race Condition 방지](./RACE_CONDITION_PREVENTION.md)

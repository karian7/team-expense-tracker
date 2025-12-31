# 테스트 코드 추가 작업 목록

팀 회식비 관리 서비스 - 리그레션 방지를 위한 테스트 코드 작성

## 📋 작업 개요

- **목표**: 향후 기능 변경 시 리그레션 방지
- **범위**: Backend, Frontend, E2E 테스트 추가
- **리팩토링**: 최소 범위 (테스트 용이성만 개선)
- **CI/CD**: GitHub Actions 포함

---

## Phase 1: 테스트 인프라 구축

### ✅ Task 1.1: Backend Vitest 설정

- [ ] `backend/vitest.config.ts` 생성
- [ ] `backend/src/test/setup.ts` 생성 (Prisma Mock)
- [ ] `backend/package.json` 의존성 추가
  - `vitest`
  - `vitest-mock-extended`
  - `@vitest/coverage-v8`
- [ ] `backend/package.json` scripts 추가
  - `test`: `vitest run`
  - `test:watch`: `vitest`
  - `test:coverage`: `vitest run --coverage`

### ✅ Task 1.2: Frontend 테스트 의존성 추가

- [ ] `frontend/package.json` 의존성 추가
  - `@testing-library/react`
  - `axios-mock-adapter`

### ✅ Task 1.3: GitHub Actions CI 설정

- [ ] `.github/workflows/test.yml` 생성
  - Backend 테스트 실행
  - Frontend 테스트 실행
  - E2E 테스트 실행
  - 커버리지 리포트 업로드

---

## Phase 2: Backend 핵심 테스트

### ✅ Task 2.1: budgetEventService 테스트

- [ ] 최소 리팩토링: `sendPushNotificationForEvent` 선택적 호출
- [ ] `backend/src/services/budgetEventService.test.ts` 생성
- [ ] 테스트 케이스:
  - [ ] `createBudgetEvent`: 이벤트 생성
  - [ ] `createBudgetEvent`: Race Condition 처리 (중복 생성)
  - [ ] `syncEvents`: sequence 기반 조회
  - [ ] `syncEvents`: BUDGET_RESET 필터링
  - [ ] `syncEvents`: DB 비어있을 때 needsFullSync
  - [ ] `calculateMonthlyBalance`: BUDGET_IN + EXPENSE 계산
  - [ ] `calculateMonthlyBalance`: BUDGET_ADJUSTMENT 반영
  - [ ] `calculateMonthlyBalance`: spentPercentage 정확도
  - [ ] `checkBudgetThreshold`: 80% 초과 경고
  - [ ] `checkBudgetThreshold`: 90% 초과 위험
  - [ ] `checkBudgetThreshold`: 100% 초과 적자
  - [ ] `checkBudgetThreshold`: 중복 알림 방지

### ✅ Task 2.2: settingsService 테스트

- [ ] `backend/src/services/settingsService.test.ts` 생성
- [ ] 테스트 케이스:
  - [ ] `getAppSettings`: 기본값 반환
  - [ ] `getAppSettings`: 저장된 설정 반환
  - [ ] `getAppSettings`: needsFullSync 자동 해제
  - [ ] `setInitialBudget`: 트랜잭션 처리

### ✅ Task 2.3: pushService 테스트

- [ ] `backend/src/services/pushService.test.ts` 생성
- [ ] 테스트 케이스:
  - [ ] `sendNotification`: 성공 시나리오
  - [ ] `sendNotification`: 404/410 → shouldRemove: true
  - [ ] `sendNotification`: 401/403 → shouldRemove: true
  - [ ] `sendNotification`: 429 → shouldRemove: false
  - [ ] `sendToAll`: 모든 구독 전송
  - [ ] `sendToAll`: 무효 구독 자동 삭제
  - [ ] `createOrUpdateSubscription`: Upsert 동작

---

## Phase 3: Frontend 서비스 테스트 확장

### ✅ Task 3.1: eventService 테스트 확장

- [ ] `frontend/src/services/local/eventService.test.ts` 수정
- [ ] 기존 테스트 유지 (2개)
- [ ] 추가 테스트 케이스:
  - [ ] `calculateMonthlyBudget`: 이월 계산 (이전 달 잔액)
  - [ ] `calculateMonthlyBudget`: 복식부기 검증
  - [ ] `createLocalEvent`: 임시 sequence 생성 (음수)
  - [ ] `clearAll`: 데이터 초기화

### ✅ Task 3.2: syncService 테스트 확장

- [ ] `frontend/src/services/sync/syncService.test.ts` 수정
- [ ] 기존 테스트 유지 (5개)
- [ ] 추가 테스트 케이스:
  - [ ] `pushPendingEvents`: 지수 백오프 (1s, 2s, 4s, 8s, 16s)
  - [ ] `pushPendingEvents`: 재시도 5회 초과 시 건너뛰기
  - [ ] `pushPendingEvents`: 네트워크 에러 처리
  - [ ] `sync`: 동시성 시나리오

### ✅ Task 3.3: pendingEventService 테스트 (신규)

- [ ] `frontend/src/services/local/pendingEventService.test.ts` 생성
- [ ] 테스트 케이스:
  - [ ] `enqueue`: pending 이벤트 생성
  - [ ] `enqueue`: tempSequence 음수 생성
  - [ ] `enqueue`: createdAt 타임스탬프
  - [ ] `getAll`: createdAt 순 정렬
  - [ ] `getAll`: 동일 시간 시 tempSequence 역순
  - [ ] `updateStatus`: pending → syncing → failed
  - [ ] `updateStatus`: lastError 설정

### ✅ Task 3.4: budgetService 테스트 (신규)

- [ ] 최소 리팩토링: `ensureMonthlyBudgetTasks` 초기화 함수
- [ ] `frontend/src/services/local/budgetService.test.ts` 생성
- [ ] 테스트 케이스:
  - [ ] `ensureMonthlyBudget`: 초기 동기화 미완료 시 건너뜀
  - [ ] `ensureMonthlyBudget`: 이미 존재 시 false 반환
  - [ ] `ensureMonthlyBudget`: 서버에서 defaultBudget 가져와서 생성
  - [ ] `ensureMonthlyBudget`: 동시 호출 시 TaskMap으로 중복 방지
  - [ ] `getMonthlyBudget`: eventService 위임

### ✅ Task 3.5: expenseService 테스트 (신규)

- [ ] `frontend/src/services/local/expenseService.test.ts` 생성
- [ ] 테스트 케이스:
  - [ ] `getExpensesByMonth`: EXPENSE 타입만 필터링
  - [ ] `getExpensesByMonth`: EXPENSE_REVERSAL 참조된 지출 제외
  - [ ] `getExpensesByMonth`: eventDate 순 정렬
  - [ ] `isExpenseDeleted`: EXPENSE_REVERSAL 존재 시 true
  - [ ] `isExpenseDeleted`: 미삭제 시 false

---

## Phase 4: Frontend API/훅 테스트

### ✅ Task 4.1: API 클라이언트 테스트

- [ ] 최소 리팩토링: `api.ts`에 `apiClient` export 추가
- [ ] `frontend/src/services/api.test.ts` 생성
- [ ] 테스트 케이스:
  - [ ] `eventApi.sync`: since 파라미터 전달
  - [ ] `eventApi.sync`: 타임아웃 5초
  - [ ] `eventApi.sync`: needsFullSync 플래그 반환
  - [ ] `eventApi.createEvent`: 성공
  - [ ] `eventApi.createEvent`: 서버 에러 처리
  - [ ] `settingsApi.getAppSettings`: 설정 조회
  - [ ] `settingsApi.setInitialBudget`: 초기 예산 설정

### ✅ Task 4.2: useBudget 훅 테스트

- [ ] `frontend/src/hooks/useBudget.test.tsx` 생성
- [ ] 테스트 케이스:
  - [ ] `useCurrentBudget`: 현재 월 예산 반환
  - [ ] `useCurrentBudget`: ensureMonthlyBudget 호출
  - [ ] `useCurrentBudget`: 초기 동기화 대기
  - [ ] `useAdjustCurrentBudget`: 양수 조정 (INCREASE)
  - [ ] `useAdjustCurrentBudget`: 음수 조정 (DECREASE)
  - [ ] `useAdjustCurrentBudget`: 동기화 실패 시 로컬 유지

### ✅ Task 4.3: useExpenses 훅 테스트

- [ ] `frontend/src/hooks/useExpenses.test.tsx` 생성
- [ ] 테스트 케이스:
  - [ ] `useExpenses`: 월별 지출 목록
  - [ ] `useExpenses`: eventDate 순 정렬
  - [ ] `useCreateExpense`: 지출 생성
  - [ ] `useCreateExpense`: 임시 sequence 생성
  - [ ] `useDeleteExpense`: EXPENSE_REVERSAL 생성
  - [ ] `useDeleteExpense`: referenceSequence 참조

---

## Phase 5: E2E 테스트

### ✅ Task 5.1: E2E 헬퍼 함수 작성

- [ ] `e2e/support/database.ts` 생성
  - `resetDatabase()`: Backend API로 DB 초기화
  - `seedInitialBudget()`: 초기 예산 설정
- [ ] `e2e/support/commands.ts` 생성
  - 공통 명령 정의
- [ ] `e2e/fixtures/test-data.ts` 생성
  - 테스트 데이터

### ✅ Task 5.2: 지출 플로우 테스트

- [ ] `e2e/tests/expense-flow.spec.ts` 생성
- [ ] 테스트 시나리오:
  - [ ] 영수증 없이 직접 입력
  - [ ] 지출 목록 표시
  - [ ] 지출 삭제 (EXPENSE_REVERSAL)

### ✅ Task 5.3: 예산 조회/이월 테스트

- [ ] `e2e/tests/budget-view.spec.ts` 생성
- [ ] 테스트 시나리오:
  - [ ] 현재 월 예산 표시
  - [ ] 이전 달 잔액 이월 확인
  - [ ] 예산 조정 (증가/감소)

### ✅ Task 5.4: 오프라인 동기화 테스트

- [ ] `e2e/tests/offline-sync.spec.ts` 생성
- [ ] 테스트 시나리오:
  - [ ] 오프라인 지출 등록 → 온라인 동기화
  - [ ] 동기화 상태 표시

---

## 📊 예상 결과

| 영역            | 현재 커버리지 | 목표 커버리지 |
| --------------- | ------------- | ------------- |
| Backend 서비스  | 0%            | 70%+          |
| Frontend 서비스 | ~15%          | 80%+          |
| Frontend 훅     | 0%            | 60%+          |
| E2E 시나리오    | 0개           | 3개           |

---

## 🔧 리팩토링 (최소)

### backend/src/services/budgetEventService.ts

```typescript
// 변경: 푸시 알림 선택적 호출
interface CreateEventOptions {
  sendPushNotification?: boolean;
}

async function createBudgetEvent(data: CreateBudgetEventPayload, options: CreateEventOptions = {}) {
  // ...
  if (options.sendPushNotification !== false) {
    await sendPushNotificationForEvent(data, eventResponse);
  }
}
```

### frontend/src/services/api.ts

```typescript
// 변경: apiClient export 추가
export const apiClient = axios.create({...});
```

### frontend/src/services/local/budgetService.ts

```typescript
// 추가: TaskMap 초기화 함수
export function clearEnsureBudgetTasks() {
  ensureMonthlyBudgetTasks.clear();
}
```

---

## 📦 의존성 추가

### Backend

```bash
pnpm --filter backend add -D vitest vitest-mock-extended @vitest/coverage-v8
```

### Frontend

```bash
pnpm --filter frontend add -D @testing-library/react axios-mock-adapter
```

---

## 🚀 실행 방법

### Backend 테스트

```bash
cd backend
pnpm test           # 테스트 실행
pnpm test:watch     # 감시 모드
pnpm test:coverage  # 커버리지
```

### Frontend 테스트

```bash
cd frontend
pnpm test           # 테스트 실행
pnpm test:watch     # 감시 모드
```

### E2E 테스트

```bash
pnpm test:e2e       # E2E 실행
```

### 전체 테스트

```bash
pnpm test:all       # Backend + Frontend + E2E
```

---

## 📝 참고 문서

- [계획 상세](/Users/karian7/.claude/plans/scalable-coalescing-patterson.md)
- [README](README.md)
- [복식부기 원칙](docs/DOUBLE_ENTRY_ACCOUNTING.md)
- [Race Condition 방지](docs/RACE_CONDITION_PREVENTION.md)

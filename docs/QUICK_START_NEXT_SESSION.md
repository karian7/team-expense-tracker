# 다음 세션 빠른 시작 가이드

**현재 상태**: Backend 100% 완료, Frontend 90% 완료

## 🚀 즉시 시작 명령어

### 1. Backend 테스트 (1분)

```bash
cd /Users/karian7/workspace/team-expense-tracker/backend
pnpm dev
```

다른 터미널에서:

```bash
curl http://localhost:3001/api/events/sync?since=0
```

**예상 출력**: `{"success":true,"data":{"lastSequence":...}}`

✅ 출력되면 Backend 정상

---

### 2. Frontend 남은 작업 (30분)

#### Step 1: ExpenseForm.tsx 수정 (10분)

**파일**: `frontend/src/components/expense/ExpenseForm.tsx`

```bash
cd /Users/karian7/workspace/team-expense-tracker/frontend/src/components/expense
```

**수정 내용**:

```typescript
// ❌ 삭제할 줄 (line 6)
import type { CreateExpenseData } from '../../services/local/expenseService';

// ✅ 추가할 줄
import type { ExpenseFormData } from '../../types';

// ❌ 찾아서 수정 (line 60 근처)
const expenseData: CreateExpenseData = {

// ✅ 이렇게 수정
const expenseData: ExpenseFormData = {
  authorName: formData.authorName,
  amount: formData.amount,
  expenseDate: formData.expenseDate,
  storeName: formData.storeName,
  receiptImage: imageBuffer,
  ocrRawData: ocrResult,
};
```

#### Step 2: 타입 에러 일괄 수정 (5분)

```bash
cd /Users/karian7/workspace/team-expense-tracker/frontend/src

# ExpenseList.tsx 수정
cd components/expense
sed -i '' 's/expense\.id/expense.sequence/g' ExpenseList.tsx
sed -i '' 's/expense\.expenseDate/expense.eventDate/g' ExpenseList.tsx
sed -i '' 's/receiptImageUrl/receiptImage/g' ExpenseList.tsx

# MonthlyReportPage.tsx 수정
cd ../../pages
sed -i '' 's/expense\.id/expense.sequence/g' MonthlyReportPage.tsx
sed -i '' 's/expense\.expenseDate/expense.eventDate/g' MonthlyReportPage.tsx
```

#### Step 3: API 타입 추가 (5분)

**파일**: `frontend/src/services/api.ts`

```typescript
// 파일 상단에 추가
import type { BudgetEvent } from '../types';

// eventApi.sync 함수 수정 (line 32 근처)
sync: async (sinceSequence: number = 0) => {
  const { data } = await apiClient.get(`/events/sync?since=${sinceSequence}`);
  return data.data as { lastSequence: number; events: BudgetEvent[] };
},
```

#### Step 4: syncService 타입 수정 (5분)

**파일**: `frontend/src/services/sync/syncService.ts`

```typescript
// ❌ 수정 전
startAutoSync(intervalMs: number = 30000): NodeJS.Timeout {
  return setInterval(() => {

// ✅ 수정 후
startAutoSync(intervalMs: number = 30000): ReturnType<typeof setInterval> {
  return setInterval(() => {

// ❌ 수정 전
stopAutoSync(timerId: NodeJS.Timeout): void {

// ✅ 수정 후
stopAutoSync(timerId: ReturnType<typeof setInterval>): void {
```

#### Step 5: 빌드 테스트 (5분)

```bash
cd /Users/karian7/workspace/team-expense-tracker/frontend
pnpm build
```

**에러 없으면 성공!**

---

### 3. 통합 테스트 (10분)

```bash
# 루트에서 frontend + backend 동시 실행
cd /Users/karian7/workspace/team-expense-tracker
pnpm dev
```

브라우저에서 `http://localhost:5173` 접속

**체크리스트**:

- [ ] 예산 요약이 표시되는가?
- [ ] "이월" 금액이 보이는가? (previousBalance)
- [ ] 지출 목록이 표시되는가?
- [ ] 새 지출 추가가 되는가?
- [ ] 콘솔에 "Synced X new events" 로그가 보이는가?

---

## 📝 예상 에러 및 해결

### 에러 1: "Cannot find module 'CreateExpenseData'"

**위치**: ExpenseForm.tsx

**해결**: Step 1 수행

---

### 에러 2: "Property 'id' does not exist on type 'BudgetEvent'"

**위치**: ExpenseList.tsx, MonthlyReportPage.tsx

**해결**: Step 2 수행

---

### 에러 3: "any[] is not assignable"

**위치**: api.ts

**해결**: Step 3 수행

---

### 에러 4: "Cannot find namespace 'NodeJS'"

**위치**: syncService.ts

**해결**: Step 4 수행

---

## 🔍 최종 검증

```bash
# Lint & Format
cd /Users/karian7/workspace/team-expense-tracker
pnpm lint:fix && pnpm format

# Build 테스트
cd frontend && pnpm build
cd ../backend && pnpm build

# 모두 성공하면 완료! 🎉
```

---

## 📚 참고 문서

- `docs/EVENT_SOURCING_MIGRATION_STATUS.md`: 전체 진행 상황
- `docs/DOUBLE_ENTRY_ACCOUNTING.md`: 복식부기 원칙
- `docs/RACE_CONDITION_PREVENTION.md`: 동시성 제어

---

## 💡 핵심 개념 요약

```typescript
// 이월은 계산된 값!
previousBalance = 이전_달_잔액 (재귀 계산)
totalBudget = previousBalance + budgetIn
balance = totalBudget - totalSpent

// 이벤트는 2가지만
'BUDGET_IN'  // 예산 유입
'EXPENSE'    // 지출

// 수정/삭제 불가
// Append-Only
// sequence 기반 동기화
```

---

## 🎯 30분 완료 체크리스트

- [ ] Step 1: ExpenseForm.tsx 수정 (10분)
- [ ] Step 2: 타입 에러 일괄 수정 (5분)
- [ ] Step 3: API 타입 추가 (5분)
- [ ] Step 4: syncService 타입 수정 (5분)
- [ ] Step 5: 빌드 테스트 (5분)
- [ ] 통합 테스트 (10분)

**예상 완료 시간**: 40분

**실제 작업 시작**:

- ExpenseForm.tsx 수정부터!
- 파일 위치: `frontend/src/components/expense/ExpenseForm.tsx`
- 6번째 줄 import 수정부터 시작하세요

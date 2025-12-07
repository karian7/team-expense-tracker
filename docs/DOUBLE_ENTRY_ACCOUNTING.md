# 복식부기(Double-Entry Accounting) 기반 Event Sourcing

## 📊 핵심 원칙

### 복식부기 공식

```
이전 달 잔액 + 이번 달 예산 유입 - 이번 달 지출 = 이번 달 잔액
```

**이월은 이벤트가 아닌 계산된 값입니다!**

## 🎯 이벤트 타입 (2가지만)

### 1. BUDGET_IN (예산 유입)

```json
{
  "eventType": "BUDGET_IN",
  "amount": 300000, // 항상 양수
  "description": "기본 월별 예산"
}
```

- 월 초 기본 예산
- 추가 예산 승인
- 예산 증액

### 2. EXPENSE (지출)

```json
{
  "eventType": "EXPENSE",
  "amount": 50000, // 항상 양수
  "storeName": "카페",
  "receiptImage": "base64..."
}
```

- 실제 지출
- 영수증 기반 기록

## 📝 실제 예시

### 시나리오: 2025년 1월~2월

```typescript
// === 1월 ===
// Event 1: 기본 예산
{
  sequence: 1,
  eventType: "BUDGET_IN",
  year: 2025, month: 1,
  amount: 300000
}

// Event 2: 지출
{
  sequence: 2,
  eventType: "EXPENSE",
  year: 2025, month: 1,
  amount: 50000,
  storeName: "카페"
}

// 1월 계산:
budgetIn = 300,000원
previousBalance = 0원 (첫 달)
totalBudget = 0 + 300,000 = 300,000원
totalSpent = 50,000원
balance = 300,000 - 50,000 = 250,000원


// === 2월 ===
// Event 3: 기본 예산
{
  sequence: 3,
  eventType: "BUDGET_IN",
  year: 2025, month: 2,
  amount: 300000
}

// Event 4: 추가 예산
{
  sequence: 4,
  eventType: "BUDGET_IN",
  year: 2025, month: 2,
  amount: 100000,
  description: "추가 승인"
}

// 2월 계산:
budgetIn = 300,000 + 100,000 = 400,000원
previousBalance = 250,000원 (1월 잔액, 계산됨!)
totalBudget = 250,000 + 400,000 = 650,000원
totalSpent = 0원
balance = 650,000 - 0 = 650,000원
```

## ✅ 복식부기 검증

### 항상 성립하는 등식:

```
∑(모든 BUDGET_IN) - ∑(모든 EXPENSE) = 최종 잔액
```

### 예시 검증:

```
총 예산 유입: 300,000 (1월) + 300,000 (2월) + 100,000 (2월 추가) = 700,000원
총 지출: 50,000 (1월) = 50,000원
최종 잔액: 700,000 - 50,000 = 650,000원 ✅
```

## 🚫 제거된 개념

### ❌ CARRYOVER 이벤트 (삭제됨)

```typescript
// 잘못된 방식 (기존)
{
  eventType: "CARRYOVER",  // ❌ 중복 기록!
  amount: 250000
}
```

**이유**: 이월은 이전 달 잔액의 복사본이므로 중복 기록입니다.

### ❌ BUDGET_ADJUST 이벤트 (삭제됨)

```typescript
// 잘못된 방식 (기존)
{
  eventType: "BUDGET_ADJUST",
  amount: -10000  // ❌ 음수? 혼란스러움
}
```

**대체**:

- 예산 증액 → `BUDGET_IN`
- 예산 감액 → 없음 (취소 불가)
- 지출 취소 → 별도 로직 필요 시 구현

## 💻 계산 로직

### Backend (budgetEventService.ts)

```typescript
export async function calculateMonthlyBudget(
  year: number,
  month: number
): Promise<MonthlyBudgetResponse> {
  const events = await getEventsByMonth(year, month);

  let budgetIn = 0;
  let totalSpent = 0;

  events.forEach((event) => {
    if (event.eventType === 'BUDGET_IN') {
      budgetIn += event.amount;
    } else if (event.eventType === 'EXPENSE') {
      totalSpent += event.amount;
    }
  });

  // 재귀적으로 이전 달 잔액 계산
  let previousBalance = 0;
  if (year > 2000) {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const prevEvents = await getEventsByMonth(prevYear, prevMonth);
    if (prevEvents.length > 0) {
      const prevBudget = await calculateMonthlyBudget(prevYear, prevMonth);
      previousBalance = prevBudget.balance;
    }
  }

  return {
    year,
    month,
    budgetIn, // 이번 달 예산 유입
    previousBalance, // 이전 달 잔액 (계산됨!)
    totalBudget: previousBalance + budgetIn,
    totalSpent,
    balance: previousBalance + budgetIn - totalSpent,
    eventCount: events.length,
  };
}
```

## 🔄 동기화

클라이언트는 sequence만 확인하면 됩니다:

```typescript
// 1. 현재 클라이언트 최대 sequence 조회
const lastSeq = await getLastSequence();

// 2. 서버에서 이후 이벤트만 가져오기
const { events } = await fetch(`/api/events/sync?since=${lastSeq}`);

// 3. 로컬 DB에 추가
for (const event of events) {
  await insertEvent(event);
}

// 4. 예산 재계산 (로컬)
const budget = calculateMonthlyBudget(2025, 2);
```

## 🎨 UI 표시

```typescript
// BudgetSummary.tsx
function BudgetSummary({ budget }) {
  return (
    <div>
      <div>남은 예산: {budget.balance.toLocaleString()}원</div>
      <div>
        총 예산: {budget.totalBudget.toLocaleString()}원
        {budget.previousBalance > 0 && (
          <span className="badge">
            이월 +{budget.previousBalance.toLocaleString()}원
          </span>
        )}
      </div>
      <div>지출: {budget.totalSpent.toLocaleString()}원</div>
      <div>사용률: {(budget.totalSpent / budget.totalBudget * 100).toFixed(1)}%</div>
    </div>
  );
}
```

## 📊 데이터 무결성

### 장점:

1. **감사 추적 완벽**: 모든 변경 이력 보존
2. **이월 자동 계산**: 이벤트 중복 없음
3. **복식부기 검증 가능**: 전체 합계 = 최종 잔액
4. **Time-travel 가능**: 특정 시점 상태 재구성

### 제약:

1. **취소 불가**: 이벤트는 추가만 가능
2. **수정 불가**: 잘못된 이벤트는 상쇄 이벤트 추가
3. **삭제 불가**: Append-Only 방식

## 🔐 취소/수정 처리

잘못된 지출을 취소하려면:

```typescript
// 1. 원본 이벤트 (수정 불가)
{
  sequence: 5,
  eventType: "EXPENSE",
  amount: 50000,
  description: "잘못 입력됨"
}

// 2. 상쇄 이벤트 (음수 지출 = 환불)
{
  sequence: 6,
  eventType: "BUDGET_IN",  // 환불 = 예산 유입
  amount: 50000,
  description: "seq#5 취소"
}

// 3. 올바른 이벤트 재입력
{
  sequence: 7,
  eventType: "EXPENSE",
  amount: 30000,
  description: "수정됨"
}
```

## 🚀 성능 최적화

### 캐싱 전략:

```typescript
// 월별 예산은 캐시 가능 (이벤트가 추가되면 무효화)
const cache = new Map<string, MonthlyBudgetResponse>();

function getCachedBudget(year: number, month: number) {
  const key = `${year}-${month}`;
  if (!cache.has(key)) {
    cache.set(key, calculateMonthlyBudget(year, month));
  }
  return cache.get(key);
}

// 새 이벤트 추가 시
function onEventAdded(event: BudgetEvent) {
  const key = `${event.year}-${event.month}`;
  cache.delete(key); // 해당 월 캐시 무효화
}
```

## 📚 참고 자료

- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
- [CQRS + Event Sourcing](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)
- [Double-Entry Accounting](https://en.wikipedia.org/wiki/Double-entry_bookkeeping)

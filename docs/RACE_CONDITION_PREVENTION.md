# Race Condition 방지 전략

> **참고:** 본 문서는 레거시 `/api/monthly-budgets/*` 엔드포인트 기준 사례를 설명합니다. 현재 서비스는 이벤트 소싱 기반(`POST /api/events`, `GET /api/events/sync`)으로 전환되어 해당 REST 엔드포인트는 제거되었습니다. 원칙과 대응 전략만 참고하세요.

## 🚨 문제 상황

### 시나리오: 두 명의 사용자가 동시에 화면 진입

```typescript
// User A
GET /api/monthly-budgets/2025/1
  → events.length = 0
  → createBudgetEvent() 시작...

// User B (0.1초 후)
GET /api/monthly-budgets/2025/1
  → events.length = 0 (User A의 이벤트가 아직 생성 안됨!)
  → createBudgetEvent() 시작...

// 결과: BUDGET_IN 이벤트가 2개 생성됨! ❌
```

### 문제점:

1. **중복 예산**: 같은 월에 기본 예산이 2번 생성
2. **잘못된 계산**: `budgetIn = 300,000 + 300,000 = 600,000원` (예상: 300,000원)
3. **데이터 무결성 파괴**: 복식부기 원칙 위배

## ✅ 해결 방법: Unique Constraint + Optimistic Locking

### 1. DB Unique Constraint 추가

```prisma
model BudgetEvent {
  sequence    Int      @id @default(autoincrement())
  eventType   String
  year        Int
  month       Int
  authorName  String
  description String?

  // Unique constraint로 중복 방지
  @@unique([year, month, eventType, authorName, description])
}
```

**효과**: 동일한 `(year, month, eventType, authorName, description)` 조합은 한 번만 생성 가능

### 2. Try-Catch + 재조회 패턴

```typescript
export async function getOrCreateMonthlyBudget(
  year: number,
  month: number
): Promise<MonthlyBudgetResponse> {
  // 1단계: 기존 이벤트 확인
  const events = await getEventsByMonth(year, month);
  if (events.length > 0) {
    return calculateMonthlyBudget(year, month);
  }

  // 2단계: 이벤트 생성 시도
  try {
    await createBudgetEvent({
      eventType: 'BUDGET_IN',
      year,
      month,
      authorName: 'SYSTEM',
      amount: defaultBudget,
      description: '기본 월별 예산', // ← Unique constraint의 일부
    });
  } catch (error) {
    // 3단계: Unique constraint 위반 = 다른 요청이 먼저 생성
    // → 에러 무시하고 계속 진행
    console.log(`Budget already created by another request`);
  }

  // 4단계: 항상 재조회 (최신 상태 보장)
  return calculateMonthlyBudget(year, month);
}
```

## 📊 동작 흐름

### 정상 케이스

```
User A:
  1. getEventsByMonth() → 0개
  2. createBudgetEvent() → 성공 ✅
  3. calculateMonthlyBudget() → budgetIn: 300,000원
```

### Race Condition 케이스

```
User A:
  1. getEventsByMonth() → 0개
  2. createBudgetEvent() 시작...

User B (동시):
  1. getEventsByMonth() → 0개 (User A가 아직 저장 안함)
  2. createBudgetEvent() 시작...

User A:
  3. DB INSERT → 성공 ✅

User B:
  3. DB INSERT → Unique constraint 위반! ❌
  4. catch (error) → 에러 무시
  5. calculateMonthlyBudget() → budgetIn: 300,000원 ✅

결과: 모두 올바른 값 반환!
```

## 🧪 테스트 결과

### 동시 요청 3개 테스트

```bash
# 3개의 요청을 동시에 발송
curl -s http://localhost:3001/api/monthly-budgets/2025/3 &
curl -s http://localhost:3001/api/monthly-budgets/2025/3 &
curl -s http://localhost:3001/api/monthly-budgets/2025/3 &

# 결과: 이벤트 1개만 생성됨 ✅
이벤트 개수: 1
  - BUDGET_IN: 300,000원
```

## 🔑 핵심 원칙

### 1. **Idempotent (멱등성)**

- 같은 요청을 여러 번 해도 결과가 동일
- `getOrCreateMonthlyBudget(2025, 1)` 호출 N번 → 이벤트 1개

### 2. **Optimistic Locking**

- 먼저 생성 시도 → 실패하면 재조회
- DB constraint가 동시성 제어

### 3. **Always Re-fetch**

- 생성 성공/실패와 관계없이 항상 재조회
- 최신 상태 보장

## ⚠️ 주의사항

### 1. Description이 다르면 중복 가능

```typescript
// 이벤트 1
{
  year: 2025, month: 1,
  authorName: 'SYSTEM',
  description: '기본 월별 예산'  // ✅
}

// 이벤트 2
{
  year: 2025, month: 1,
  authorName: 'SYSTEM',
  description: '기본예산'  // ❌ 다른 description!
}

// 결과: 둘 다 생성됨 (다른 이벤트로 간주)
```

**해결**: Description을 고정된 상수로 사용

```typescript
const MONTHLY_BUDGET_DESC = '기본 월별 예산';
```

### 2. NULL Description 처리

```typescript
// ❌ 잘못된 방식
description: description || null; // NULL은 unique에서 무시됨

// ✅ 올바른 방식
description: description || '기본 월별 예산'; // 항상 값 지정
```

## 🎯 다른 이벤트의 Race Condition

### EXPENSE는 괜찮음

```typescript
// 지출은 중복되어도 OK (실제로 2번 지출한 것)
createBudgetEvent({
  eventType: 'EXPENSE',
  amount: 50000,
  storeName: '카페', // ← Unique constraint에 포함 안됨
  authorName: '홍길동',
});

// 같은 사람이 같은 날 같은 곳에서 2번 지출 가능
```

**차이점**:

- `BUDGET_IN` (SYSTEM): 한 번만 생성되어야 함
- `EXPENSE` (사용자): 여러 번 생성 가능

## 📈 성능 영향

### Unique Index 생성

```sql
CREATE UNIQUE INDEX idx_unique_budget_event
ON budget_events(year, month, eventType, authorName, description);
```

- **조회 성능**: 영향 없음 (기존 인덱스 활용)
- **삽입 성능**: 약간 느려짐 (unique check)
- **중복 방지**: 완벽 ✅

### Trade-off

```
성능 저하: ~5ms
데이터 무결성: 완벽
→ Trade-off 가치 있음!
```

## 🔄 대안: Distributed Lock

만약 더 복잡한 로직이 필요하다면:

```typescript
// Redis Lock 사용
async function getOrCreateMonthlyBudget(year, month) {
  const lockKey = `budget:${year}:${month}`;
  const lock = await redis.lock(lockKey, 5000); // 5초 TTL

  try {
    const events = await getEventsByMonth(year, month);
    if (events.length === 0) {
      await createBudgetEvent(...);
    }
    return calculateMonthlyBudget(year, month);
  } finally {
    await lock.release();
  }
}
```

**단점**:

- Redis 의존성 추가
- 복잡도 증가
- Single point of failure

**현재 방식이 더 나은 이유**:

- DB native constraint 활용
- 의존성 없음
- 간단하고 명확함

## 📚 참고 자료

- [Database Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [Optimistic vs Pessimistic Locking](https://stackoverflow.com/questions/129329/optimistic-vs-pessimistic-locking)
- [Idempotency in REST APIs](https://restfulapi.net/idempotent-rest-apis/)

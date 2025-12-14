# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

팀 회식비 관리 서비스 - 영수증 OCR 기반 회식비 예산 관리 시스템

**📚 상세 정보**: [README.md](README.md), [OCR 설정](docs/OCR_CONFIGURATION.md)

## Essential Commands

```bash
# 개발 서버
pnpm dev                          # Frontend + Backend 동시 실행

# 코드 품질 (작업 후 필수 실행)
pnpm lint && pnpm format:check   # 검사
pnpm lint:fix && pnpm format     # 자동 수정

# 데이터베이스
cd backend
npx prisma migrate dev           # 마이그레이션
npx prisma studio                # GUI
npx prisma generate              # Client 재생성
```

## Core Architecture

### 1. 자동 월별 예산 이월 시스템

**핵심 개념**: 특정 월 예산 조회 시 없으면 자동 생성 + 이전 달 잔액 자동 이월

```typescript
// budgetService.ts
getOrCreateMonthlyBudget(year, month) {
  // 1. 기존 예산 조회
  // 2. 없으면 생성:
  //    - 이전 달 잔액 → carriedAmount
  //    - 기본 예산 + 이월액 = totalBudget
  // 3. Expense 생성/수정/삭제 시 recalculateMonthlyBudget() 자동 호출
}
```

**중요**: Expense 변경 시 항상 해당 MonthlyBudget 재계산 필요

### 2. OCR Provider Pattern

Factory Pattern으로 OCR 프로바이더 교체 가능:

```typescript
// 환경 변수로 프로바이더 선택
OCR_PROVIDER = openai | google | dummy;

// 새 프로바이더 추가 시:
// 1. IOcrProvider 구현
// 2. OcrProviderFactory에 추가
```

## Critical Points

### Decimal 타입 처리

```typescript
// ❌ 잘못된 방법
budget.baseAmount + 1000;

// ✅ 올바른 방법
import { Decimal } from '@prisma/client/runtime/client';
budget.baseAmount.plus(new Decimal(1000));

// API 응답 시 number로 변환 필수
convertDecimalsToNumbers(budget);
```

### 타입 안전성

- **`any` 사용 금지** - ESLint가 강제함
- Backend/Frontend 타입 공유: `types/index.ts`
- `ApiResponse<T>` 제네릭 사용

### 이미지 처리

1. HEIC → JPEG 자동 변환 (iOS 지원)
2. 800px 리사이징 (성능 최적화)
3. `/uploads` 저장 → 프로덕션에서는 S3 권장

## Environment Variables

```bash
# Backend 필수
DATABASE_URL="file:./dev.db"
OCR_PROVIDER=openai
OPENAI_API_KEY=sk-proj-xxxxx

# Frontend
VITE_API_URL=http://localhost:3001
```

## Quality Assurance

**⚠️ 모든 코드 작업 후 필수 실행**:

```bash
# 1. 코드 품질 검사
pnpm lint && pnpm format:check

# 2. 문제 발견 시 자동 수정
pnpm lint:fix && pnpm format

# 3. TypeScript 컴파일 확인
cd backend && pnpm build
cd frontend && pnpm build
```

**검사 통과 없이 작업 완료 보고 금지**

## Key Files

- `backend/src/services/budgetService.ts` - 예산 이월 로직
- `backend/src/services/ocr/OcrProviderFactory.ts` - OCR 프로바이더 선택
- `backend/prisma/schema.prisma` - 데이터베이스 스키마
- `frontend/src/hooks/` - React Query 기반 API 훅

## 복식부기 원칙 (중요!)

**이월은 이벤트가 아닌 계산된 값입니다!**

### 이벤트 타입 (2가지만):

- `BUDGET_IN`: 예산 유입 (기본 예산, 추가 예산)
- `EXPENSE`: 지출 (영수증 기반)

### 복식부기 공식:

```
이전 달 잔액 + 이번 달 예산 유입 - 이번 달 지출 = 이번 달 잔액
```

### 예시:

```
1월: BUDGET_IN(300,000) - EXPENSE(50,000) = 잔액 250,000
2월: BUDGET_IN(300,000) + 이월(250,000) = 총 550,000
     ↑ 이월은 1월 잔액을 재계산한 값 (이벤트 아님!)
```

**상세 문서**: `docs/DOUBLE_ENTRY_ACCOUNTING.md`

## Race Condition 방지 ⚠️

**문제**: 두 사용자가 동시에 월별 예산 조회 → 중복 생성?

**해결**:

1. **Unique Constraint**: `(year, month, eventType, authorName, description)`
2. **Try-Catch 패턴**: 생성 실패 시 재조회
3. **Idempotent**: 여러 번 호출해도 결과 동일

```typescript
try {
  await createBudgetEvent({ description: '기본 월별 예산' });
} catch (error) {
  // 이미 생성됨 → 무시
}
return calculateMonthlyBudget(year, month);
```

**상세**: `docs/RACE_CONDITION_PREVENTION.md`

## Local First 아키텍처 (중요!)

**핵심 개념**: 네트워크 상태와 무관하게 즉시 반응하는 UI

### 데이터 흐름

```
사용자 작업 → 로컬 DB 즉시 저장 → UI 업데이트 (0ms)
              ↓
         pendingEvents 큐 등록
              ↓
         동기화 루프 (60초 주기)
              ↓
         서버에 Push → Pull 새 이벤트 → 로컬 업데이트
```

### 핵심 구성요소

#### 1. IndexedDB (Dexie)

**4개 테이블**:

- `budgetEvents`: 이벤트 저장소 (sequence: PK)
- `settings`: 로컬 설정
- `syncMetadata`: 동기화 지점 (lastSequence)
- `pendingEvents`: 대기 큐 (pending/syncing/failed)

**인덱스**:

- `[year+month]`: 월별 조회 최적화
- `eventType`, `eventDate`, `authorName`: 필터링
- `referenceSequence`: 이벤트 역참조

#### 2. 임시 Sequence 메커니즘

**로컬 이벤트 생성 시**:

```typescript
const tempSequence = -1 * (Date.now() * 1000 + Math.random() * 1000);
// 예: -1733596800000001 (음수로 서버 sequence와 구분)
```

**동기화 후 교체**:

```typescript
// 로컬: { sequence: -1733596800000001, ... }
// 서버 응답: { sequence: 42, ... }
// → 로컬 이벤트 삭제 → 서버 이벤트 저장
```

#### 3. 대기 큐 (PendingEvents)

**상태 전이**:

```
pending → syncing → (제거) [성공]
pending → syncing → failed [재시도 대기]
```

**PendingEvent 구조**:

```typescript
{
  id: string;                    // UUID
  tempSequence: number;          // 로컬 sequence
  payload: CreateBudgetEventPayload;
  status: 'pending' | 'syncing' | 'failed';
  lastError?: string;
}
```

#### 4. 동기화 루프

**자동 동기화** (60초 주기):

1. **Push**: `pendingEvents` 큐를 비우며 서버에 전송
   - 성공: 임시 sequence → 서버 sequence 교체
   - 실패: 상태를 `failed`로 변경, 다음 루프에서 재시도
2. **Pull**: `lastSequence` 이후의 서버 이벤트 가져오기
3. **업데이트**: 로컬 DB에 새 이벤트 저장
4. **BUDGET_RESET 처리**: 전체 로컬 DB 초기화

### 오프라인 동작

**사용자가 오프라인에서 지출 기록**:

1. `eventService.createLocalEvent()` → Dexie에 즉시 저장
2. `useLiveQuery` 트리거 → UI 즉시 업데이트 (0ms)
3. `pendingEvents` 큐에 추가 (status: pending)
4. 사용자는 정상적으로 앱 사용 가능

**온라인 복귀 시**:

1. 자동 동기화 루프 실행 (또는 수동 트리거)
2. 대기 중인 이벤트들을 순차적으로 서버에 전송
3. 성공한 이벤트는 큐에서 제거
4. 실패한 이벤트는 `failed` 상태로 유지 (재시도 대기)

### 핵심 파일

- `frontend/src/services/db/database.ts` - Dexie 스키마
- `frontend/src/services/local/eventService.ts` - 이벤트 CRUD + 계산
- `frontend/src/services/local/pendingEventService.ts` - 대기 큐 관리
- `frontend/src/services/sync/syncService.ts` - 동기화 루프
- `frontend/src/hooks/useBudget.ts` - React Query 통합

## 아키텍처 준수 현황 (최종 검토: 2025-12-07)

### Event Sourcing 원칙 ✅

| 원칙                | 상태 | 비고                              |
| ------------------- | ---- | --------------------------------- |
| Append-Only         | ✅   | INSERT만 가능, UPDATE/DELETE 불가 |
| Sequence 기반 순서  | ✅   | Auto-increment PK                 |
| 완전 재구성 가능    | ✅   | 모든 이벤트로부터 상태 계산       |
| 복식부기 원칙       | ✅   | 이월 = 계산된 값                  |
| 동기화 지원         | ✅   | Sequence 기반 부분 동기화         |
| Race Condition 방지 | ✅   | Unique constraint + Try-catch     |

### Local First 원칙 ✅

| 원칙              | 상태 | 비고                         |
| ----------------- | ---- | ---------------------------- |
| 오프라인 쓰기     | ✅   | 임시 sequence로 즉시 저장    |
| 즉시 UI 반응      | ✅   | useLiveQuery 자동 업데이트   |
| 백그라운드 동기화 | ✅   | 60초 주기 자동 실행          |
| 충돌 해결         | ✅   | 서버 우선 (Last-Write-Wins)  |
| 대기 큐           | ✅   | pendingEvents 테이블         |
| 재시도 메커니즘   | ✅   | 실패 시 다음 루프에서 재시도 |

### 예외 사항

**월 기본 예산만 예외 처리**:

- `ensureMonthlyBudget()`: 로컬 우선 생성 → 서버 동기화
- Race Condition 방지: TaskMap으로 동시 요청 방지
- 서버 검증: 동일 월 기본 예산 중복 생성 시 에러 무시

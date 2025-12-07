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
import { Decimal } from '@prisma/client/runtime/library';
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

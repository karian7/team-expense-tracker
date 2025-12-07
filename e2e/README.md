# E2E 테스트 가이드

이 디렉토리는 Playwright를 사용한 End-to-End 테스트를 포함합니다.

## 📁 구조

```
e2e/
├── fixtures/          # 테스트 데이터 및 샘플 파일
│   └── test-data.ts   # 테스트용 상수 데이터
├── setup/             # 테스트 환경 설정
│   └── db-setup.ts    # 데이터베이스 초기화
├── tests/             # 테스트 파일
│   ├── 01-initial-setup.spec.ts       # TC-001, TC-002: 초기 설정
│   ├── 02-budget-management.spec.ts   # TC-002-1~3: 예산 관리
│   ├── 03-expense-management.spec.ts  # TC-009~012, TC-018~020: 사용 내역
│   ├── 04-csv-export-import.spec.ts   # TC-013~017: CSV 기능
│   ├── 05-ui-ux.spec.ts               # TC-021~023: UI/UX
│   ├── 06-integration.spec.ts         # TC-024: 통합 시나리오
│   └── 07-security.spec.ts            # TC-027~030: 보안
└── utils/             # 헬퍼 함수
    └── helpers.ts     # 공통 유틸리티

```

## 🚀 실행 방법

### 사전 준비

1. 의존성 설치 (이미 완료된 경우 생략):

   ```bash
   pnpm install
   ```

2. 브라우저 설치 (최초 1회):
   ```bash
   pnpm playwright install chromium
   ```

### 테스트 실행

```bash
# 모든 E2E 테스트 실행 (헤드리스 모드)
pnpm test:e2e

# UI 모드로 실행 (추천 - 디버깅에 유용)
pnpm test:e2e:ui

# 브라우저를 보면서 실행 (헤디드 모드)
pnpm test:e2e:headed

# 특정 테스트 파일만 실행
pnpm test:e2e e2e/tests/01-initial-setup.spec.ts

# 특정 테스트만 실행 (grep)
pnpm test:e2e -g "TC-001"

# 리포트 보기
pnpm test:e2e:report
```

## ⚙️ 설정

### playwright.config.ts

- **Base URL**: `http://localhost:5173` (프론트엔드)
- **Workers**: 1 (순차 실행 - 데이터베이스 충돌 방지)
- **Web Server**: 백엔드(3001), 프론트엔드(5173) 자동 실행
- **Retry**: CI 환경에서 2회 재시도

### 환경 변수

테스트 실행 전 백엔드 `.env` 파일 확인:

```env
DATABASE_URL="file:./dev.db"
OCR_PROVIDER=dummy  # 테스트에서는 dummy 권장
OPENAI_API_KEY=sk-...  # OCR 테스트 시 필요
```

## 📝 테스트 케이스 매핑

| 테스트 파일                     | TEST_CASES.md          | 설명                            |
| ------------------------------- | ---------------------- | ------------------------------- |
| `01-initial-setup.spec.ts`      | TC-001, TC-002         | 초기 예산, 월별 예산 설정       |
| `02-budget-management.spec.ts`  | TC-002-1~3             | 예산 자동 반영, 조정, 중복 방지 |
| `03-expense-management.spec.ts` | TC-009~012, TC-018~020 | 사용 내역 CRUD, 필터링, 경고    |
| `04-csv-export-import.spec.ts`  | TC-013~017             | CSV 백업/복원, 템플릿           |
| `05-ui-ux.spec.ts`              | TC-021~023             | 반응형, 로딩, 에러 메시지       |
| `06-integration.spec.ts`        | TC-024                 | 전체 플로우 통합 테스트         |
| `07-security.spec.ts`           | TC-027~030             | 파일 제한, SQL Injection, XSS   |

## 🔧 헬퍼 함수

### 데이터베이스 관리

- `resetDatabase()` - DB 초기화
- `setInitialBudget(amount)` - 초기 예산 설정
- `setDefaultMonthlyBudget(amount)` - 기본 월별 예산 설정

### 페이지 네비게이션

- `openSettingsPage(page)` - 설정 페이지 열기
- `closeSettingsPage(page)` - 설정 페이지 닫기

### 데이터 조작

- `addExpenseManually(page, expense)` - 수동으로 사용 내역 추가
- `createCSVFile(filename, content)` - CSV 파일 생성

### API 헬퍼

- `getCurrentMonthBudget()` - 현재 월 예산 조회
- `getMonthlyEvents(year, month)` - 월별 이벤트 조회

## 🐛 디버깅

### UI 모드 사용 (추천)

```bash
pnpm test:e2e:ui
```

- 각 단계를 시각적으로 확인
- 타임라인 재생
- DOM 스냅샷 확인

### 스크린샷/비디오

실패 시 자동으로 스크린샷 저장:

```
test-results/
└── 01-initial-setup-TC-001-chromium/
    ├── test-failed-1.png
    └── trace.zip
```

### 로그 확인

```bash
# 백엔드 로그
cd backend && pnpm dev

# 콘솔 로그 포함하여 실행
DEBUG=pw:api pnpm test:e2e
```

## 📊 CI/CD

GitHub Actions 예시:

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm playwright install --with-deps chromium
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## ⚠️ 주의사항

1. **순차 실행**: `workers: 1` - 데이터베이스 공유로 인한 테스트 간 간섭 방지
2. **타임아웃**: 느린 네트워크나 CI 환경을 고려하여 충분한 타임아웃 설정
3. **OCR 테스트**: 실제 OpenAI API 사용 시 비용 발생 - `dummy` 프로바이더 권장
4. **데이터베이스**: 각 테스트 전 `resetDatabase()` 호출로 격리
5. **파일 정리**: CSV 생성 후 `fs.unlinkSync()` 호출로 정리

## 🔄 테스트 추가하기

새로운 테스트 추가 시:

1. `e2e/tests/` 디렉토리에 `.spec.ts` 파일 생성
2. `test.describe()`, `test()` 구조 사용
3. `test.beforeEach()`에서 데이터베이스 초기화
4. 헬퍼 함수 활용으로 중복 최소화
5. `TEST_CASES.md`에 TC 번호 매핑

예시:

```typescript
import { test, expect } from '@playwright/test';
import { resetDatabase, setInitialBudget } from '../utils/helpers';

test.describe('새로운 기능 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase();
    await setInitialBudget(1000000);
    await page.goto('/');
  });

  test('TC-XXX: 새로운 기능', async ({ page }) => {
    // 테스트 로직
    await expect(page.locator('text=기대값')).toBeVisible();
  });
});
```

## 📚 참고 문서

- [Playwright 공식 문서](https://playwright.dev/)
- [TEST_CASES.md](../TEST_CASES.md) - 수동 테스트 케이스
- [CLAUDE.md](../CLAUDE.md) - 프로젝트 아키텍처

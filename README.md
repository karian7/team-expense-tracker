# 팀 회식비 관리 서비스

영수증 사진 업로드 한 번으로 회식비 예산을 자동 집계하고, 복식부기 기반 이벤트 소싱으로 감사 추적이 가능한 로컬 퍼스트 웹·모바일(PWA) 서비스입니다. React 19/Dexie 프론트와 Express 5/Prisma 7 백엔드가 pnpm 모노 레포에서 함께 동작합니다.

## 주요 특징

- **자동 OCR 파이프라인**: OpenAI Vision 또는 Google Cloud Vision 중 선택해 영수증 이미지를 분석하고 금액·일자·상호를 자동 추출
- **복식부기 이벤트 소싱**: `BUDGET_IN`, `EXPENSE`, `EXPENSE_REVERSAL`, `BUDGET_ADJUSTMENT_*`, `BUDGET_RESET` 이벤트만 Append-Only로 기록하여 잔액 = ∑유입−∑지출 공식을 항상 보장
- **로컬 퍼스트 UX**: Dexie 기반 IndexedDB, pending 이벤트 큐, 서비스 워커 캐시로 오프라인에서도 즉시 작성 및 동기화 재시도 지원
- **이미지 BLOB 저장**: HEIC/JPEG → 480px 리사이즈 후 base64(BLOB)로 SQLite에 저장해 파일 시스템 의존 제거 및 백업 단순화
- **PWA + Web Push**: `/sw.js` 서비스 워커, VAPID 기반 푸시 알림, 캐시 전략, 오프라인 라우팅 지원
- **DevOps 친화성**: Docker Compose, Makefile 기반 S3 + CloudFront + PM2 배포, Playwright/Vitest 테스트 및 상세 TEST_CASES 문서 제공

## 기술 스택

### 프론트엔드

- React 19 + TypeScript, Vite 7, Tailwind CSS 4
- Dexie + dexie-react-hooks (IndexedDB), React Query, React Hook Form, Recharts
- Vitest + Testing Library, ESLint 9 + Prettier 3

### 백엔드

- Node.js 20 / Express 5 / TypeScript
- Prisma 7 (`prisma.config.ts`) + Better-SQLite3, Multer memoryStorage, Sharp, Decimal.js
- OCR Provider: OpenAI Vision API 또는 Google Cloud Vision (환경 변수로 선택)
- Web Push (VAPID), tsx/tsup 기반 번들

### 공통 & 인프라

- pnpm 10.x 스크립트, Docker Compose, Makefile 배포 플로우
- Playwright 1.57 E2E (`playwright.config.ts`), ESLint/Prettier/Format 스크립트, 독립형 CI 대응
- Docs: `docs/*.md`

## 아키텍처 개요

### 이벤트 소싱 & 복식부기

- 모든 금액 변화는 Append-Only `BudgetEvent` 로 기록되며 Prisma 모델은 `sequence`(PK), `eventType`, `year/month`, `amount`, `authorName` 등을 포함합니다.
- 허용 이벤트 타입: `BUDGET_IN`, `EXPENSE`, `EXPENSE_REVERSAL`, `BUDGET_ADJUSTMENT_INCREASE`, `BUDGET_ADJUSTMENT_DECREASE`, `BUDGET_RESET`.
- `previousBalance + budgetIn − totalSpent = balance` 공식이 프론트 Dexie 계산(`eventService.calculateMonthlyBudget`)으로 재귀 적용됩니다.
- 중복 예산 방지를 위해 `(year, month, eventType, authorName, description)` Unique Index와 낙관적 잠금 패턴을 사용합니다. 자세한 내용은 `docs/DOUBLE_ENTRY_ACCOUNTING.md`, `docs/RACE_CONDITION_PREVENTION.md` 참고.

### 로컬 퍼스트 & 동기화

- `frontend/src/services/db/database.ts`에서 Dexie 스키마(이벤트/설정/동기화 메타)를 정의하고, `eventService`가 BUDGET_RESET 이후 이벤트만 필터링하여 월별 잔액을 계산합니다.
- `pendingEventService`가 로컬 음수 sequence를 발급해 임시 이벤트를 기록하고 UI에 바로 반영합니다.
- `syncService`는 `eventApi.sync`/`bulk-sync`와 pending 큐를 사용해 서버 sequence를 따라잡고 `ReturnType<typeof setInterval>` 기반 주기로 오프라인에서도 안전하게 재시도합니다.
- 서비스 워커(`/frontend/public/sw.js`)가 정적 자원을 캐시하고 push 이벤트를 처리하며, offline fetch 시 보호 응답을 제공합니다.

### 영수증 & OCR 파이프라인

- Multer memoryStorage + Sharp로 모든 영수증을 480px JPEG로 압축 후 base64로 Prisma `Bytes` 필드에 저장합니다. 상세 절차는 `MIGRATION_IMAGE_TO_BLOB.md` 참고.
- `receiptApi.upload` 응답은 `{ imageBuffer, ocrResult }`를 반환하며, 폼은 이를 즉시 미리보기 및 이벤트 payload에 포함합니다.
- OCR Provider는 `OCR_PROVIDER=openai|google` 또는 기본 `dummy` 설정으로 제어하며, 키 설정은 `docs/OCR_CONFIGURATION.md`에 정리되어 있습니다.

### 알림 & 설정

- `/api/push/*` 라우트가 구독/해제/테스트/VAPID 키 발급을 담당하고, 프론트는 `pushNotificationService`로 구독 상태를 관리합니다.
- `/api/settings` 는 기본 월 예산 및 초기화 API(`/settings/initial-budget`)를 제공하며, `AppSettings`는 Dexie에도 캐시됩니다.

### API 빠른 참고

| Method    | Path                           | 설명                                     |
| --------- | ------------------------------ | ---------------------------------------- |
| `GET`     | `/api/health`                  | 서버 상태 확인                           |
| `POST`    | `/api/events`                  | 예산/지출/조정 이벤트 생성 (Append-Only) |
| `POST`    | `/api/events/bulk-sync`        | 로컬 큐 일괄 전송                        |
| `GET`     | `/api/events/sync?since=<seq>` | 특정 sequence 이후 이벤트 동기화         |
| `POST`    | `/api/receipts/upload`         | 영수증 업로드 + OCR                      |
| `GET/PUT` | `/api/settings`                | 기본 예산 조회/수정                      |
| `POST`    | `/api/settings/initial-budget` | 초기 예산 세팅 및 데이터 리셋            |
| `POST`    | `/api/push/subscribe`          | 푸시 구독 등록                           |
| `POST`    | `/api/push/unsubscribe`        | 푸시 구독 해제                           |
| `POST`    | `/api/push/test`               | 테스트 알림 발송                         |
| `GET`     | `/api/push/public-key`         | VAPID Public Key 제공                    |

## 프로젝트 구조

```
team-expense-tracker/
├── backend/                 # Express + Prisma API
│   ├── prisma/              # 스키마 및 마이그레이션
│   ├── src/                 # controllers/routes/services/types
│   ├── scripts/             # 이미지 마이그레이션, VAPID 키 생성 등
│   ├── Dockerfile
│   └── package.json
├── frontend/                # React + Vite 앱
│   ├── public/sw.js         # PWA 서비스 워커
│   ├── src/components|hooks|services
│   └── package.json
├── docs/                    # 아키텍처/운영 문서
├── docker-compose.yml       # 백/프론트 동시 실행 (개발/테스트)
├── Makefile                 # 빌드·배포·서버 제어 명령어
├── playwright.config.ts     # Playwright 테스트 설정
└── README.md
```

## 시작하기

### 요구사항

- Node.js 20+ / pnpm 10+ (루트·frontend·backend 각각 설치 필요)
- SQLite (better-sqlite3에 포함) 및 libvips(Sharp 변환용) 설치
- Docker & Docker Compose (선택)
- OCR 자격 증명: OpenAI API Key 또는 Google 서비스 계정 JSON
- (선택) Web Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`

### 1. 저장소 클론

```bash
git clone <repository-url>
cd team-expense-tracker
```

### 2. 의존성 설치

```bash
pnpm install                # 루트 dev 스크립트/Playwright 등
pnpm --dir backend install  # 백엔드 전용
pnpm --dir frontend install # 프론트엔드 전용
```

### 3. 환경 변수 준비

백엔드 `.env` 예시:

```bash
PORT=3001
DATABASE_URL="file:./dev.db"
# SHADOW_DATABASE_URL=...
OCR_PROVIDER=openai
OPENAI_API_KEY=sk-...
# 또는 GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
ALLOWED_ORIGINS=http://localhost:5173
JSON_BODY_LIMIT=15mb
MAX_FILE_SIZE=10485760
VAPID_PUBLIC_KEY=<base64>
VAPID_PRIVATE_KEY=<base64>
VAPID_EMAIL=mailto:ops@example.com
```

프론트엔드 `.env` 예시:

```bash
VITE_API_URL=http://localhost:3001
VITE_PUSH_PUBLIC_KEY=<동일한 VAPID Public Key>
```

> 자세한 키 발급/설정은 `docs/OCR_CONFIGURATION.md` 및 `backend/src/scripts/generate-vapid-keys.ts` 참고.

### 4. 데이터베이스 준비

```bash
cd backend
pnpm prisma generate
pnpm prisma migrate dev
```

또는 루트에서 `pnpm db:reset` 으로 `backend/prisma/dev.db` 를 초기화 후 모든 마이그레이션을 다시 적용할 수 있습니다.

## 실행 방법

### pnpm 스크립트

- `pnpm dev` : `frontend`(Vite 5173) + `backend`(Express 3001) 동시 실행
- `pnpm dev:frontend`, `pnpm dev:backend` : 개별 실행
- `pnpm lint`, `pnpm lint:fix`, `pnpm format`, `pnpm format:check` : 코드 품질 관리
- `pnpm db:reset` : Prisma dev DB 초기화 및 마이그레이션 재실행

### Docker Compose (선택)

```bash
docker-compose up --build
```

- `frontend` 는 `VITE_API_URL=http://backend:3001` 으로 빌드되며 SQLite 파일은 볼륨에 저장됩니다.

### 로컬 SQLite 초기화 플로우

1. `pnpm db:reset` (또는 `pnpm --filter team-expense-tracker-backend exec prisma migrate reset --force`)
2. 손상 시 `rm backend/prisma/dev.db` 후 `pnpm --filter team-expense-tracker-backend exec prisma migrate deploy`
3. UI 또는 `POST /api/settings/initial-budget` 로 초기 예산 재설정

## 테스트 & QA

| 범위                 | 명령어                              | 비고                                             |
| -------------------- | ----------------------------------- | ------------------------------------------------ |
| Frontend 단위 테스트 | `cd frontend && pnpm test`          | Vitest + jsdom                                   |
| Frontend TDD         | `pnpm test:watch`, `pnpm test:ui`   | 실시간/브라우저 UI                               |
| End-to-End           | `pnpm test:e2e`                     | `playwright.config.ts` 가 서버 두 개를 자동 기동 |
| E2E UI 모드          | `pnpm test:e2e:ui`                  | 시나리오 디버깅                                  |
| E2E 리포트           | `pnpm test:e2e:report`              | `playwright-report/index.html` 생성              |
| 린트                 | `pnpm lint`                         | 프론트/백엔드 동시 검증                          |
| 포맷                 | `pnpm format` / `pnpm format:check` | Prettier 3                                       |

## 배포

- **Makefile**: `make build`, `make deploy-frontend`(S3 + CloudFront 무효화), `make deploy-backend`(SSH + PM2), `make provision-server`, `make setup-server` 등 운영 명령을 제공합니다.
- **CloudFront 설정**: `cloudfront-*.json` 은 최신 배포 구성 백업이며 `update-cloudfront.py` 로 변경분을 계산합니다.
- **환경 파일 배포**: `make deploy-env` 로 `backend/.env` 를 원격에 전달 (민감 정보 주의).
- **서버 제어**: `make server-start|stop|restart|logs|status` 로 PM2 프로세스를 관리합니다.

## 문서 & 참고 자료

- `docs/DOUBLE_ENTRY_ACCOUNTING.md`: 복식부기 이벤트 모델, 공식, 예시
- `docs/OCR_CONFIGURATION.md`: OpenAI/Google OCR 설정 가이드
- `docs/RACE_CONDITION_PREVENTION.md`: Unique 제약 기반 동시성 제어 패턴
- `docs/MIGRATION_IMAGE_TO_BLOB.md`: 이미지 BLOB 전환 절차 및 스크립트

## 라이선스

MIT

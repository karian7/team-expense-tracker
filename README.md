# 팀 회식비 관리 서비스

영수증 사진 업로드만으로 회식비 사용 내역과 월별 잔액을 자동으로 관리하는 웹 서비스입니다.

## 주요 기능

- 영수증 사진 업로드 및 자동 OCR (OpenAI / Google Vision API 지원)
- 월별 회식비 예산 관리
- 사용 내역 자동 집계 및 잔액 계산
- 월별 자동 이월
- CSV 백업/복원 기능
- 초기 예산 설정 및 데이터 리셋
- 모바일 최적화 (iOS 카메라 지원)

## 기술 스택

### 프론트엔드

- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Query
- React Hook Form

### 백엔드

- Node.js + Express + TypeScript
- Prisma ORM
- SQLite
- OCR: OpenAI Vision API / Google Cloud Vision API (선택 가능)
- Multer (파일 업로드)

## 시작하기

### 사전 요구사항

- Node.js 20+
- npm 또는 yarn
- OCR API 키 (둘 중 하나):
  - OpenAI API Key (권장) 또는
  - Google Cloud Vision API 인증 정보

> **OCR 설정 방법**: 자세한 내용은 [OCR 설정 가이드](docs/OCR_CONFIGURATION.md)를 참고하세요.

### 설치 및 실행

#### 1. 저장소 클론

```bash
git clone <repository-url>
cd team-expense-tracker
```

#### 2. 환경 변수 설정

**백엔드:**

```bash
cd backend
cp .env.example .env
# .env 파일을 열어 OCR 프로바이더와 API 키를 설정하세요
# OCR_PROVIDER=openai (기본값)
# OPENAI_API_KEY=your_api_key_here
```

> **참고**: Google Vision API를 사용하려면 [OCR 설정 가이드](docs/OCR_CONFIGURATION.md)를 참고하세요.

**프론트엔드:**

```bash
cd frontend
cp .env.example .env
```

#### 3. 패키지 설치 및 실행

**Option A: Docker 사용 (권장)**

```bash
# 프로젝트 루트에서
docker-compose up
```

**Option B: 로컬 실행**

터미널 1 - 백엔드:

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

터미널 2 - 프론트엔드:

```bash
cd frontend
npm install
npm run dev
```

#### 4. 접속

- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:3001

### 로컬 SQLite 초기화

로컬 개발 중 DB를 초기값으로 되돌리거나 SQLite 파일이 손상된 경우 아래 절차를 그대로 수행하세요.

1. 루트 디렉터리에서 `pnpm --filter team-expense-tracker-backend exec prisma migrate reset --force` 를 실행하면 `backend/prisma/dev.db` 가 삭제되고 모든 마이그레이션이 다시 적용됩니다.
2. 만약 `database disk image is malformed` 와 같은 손상 오류가 발생하면 `rm backend/prisma/dev.db` 로 파일을 제거한 뒤 `pnpm --filter team-expense-tracker-backend exec prisma migrate deploy` 로 새 DB를 만들고 마이그레이션을 재적용합니다.
3. 위 과정을 마치면 DB는 최신 마이그레이션 기준의 깨끗한 상태가 되며, 필요 시 초기 예산 설정을 다시 진행하면 됩니다.

### Prisma 7 구성

- Prisma CLI는 `backend/prisma.config.ts`를 통해 스키마 경로, 마이그레이션 경로, datasource URL을 단일 소스로 관리합니다. 루트 `pnpm db:reset` 스크립트와 백엔드 내 `prisma:*` 스크립트 모두 이 구성을 자동으로 사용합니다.
- 런타임 PrismaClient는 `@prisma/adapter-better-sqlite3` 기반 커넥터를 통해 SQLite 파일에 직접 연결합니다. `DATABASE_URL` 은 `file:./dev.db` 형식을 유지하며, 필요하면 `SHADOW_DATABASE_URL` 로 마이그레이션용 shadow DB 경로를 덮어쓸 수 있습니다.

## 프로젝트 구조

```
team-expense-tracker/
├── frontend/          # React 프론트엔드
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   └── package.json
├── backend/           # Express 백엔드
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── types/
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
└── docker-compose.yml
```

## 로컬 퍼스트 & 이벤트 소싱 아키텍처

이 서비스는 **로컬 퍼스트(Local-First)** 전략과 **이벤트 소싱(Event Sourcing)** 을 조합해 오프라인에서도 동일한 UX를 제공합니다.

- **단일 이벤트 스트림**: 모든 예산/지출 변경은 `BudgetEvent` 로 기록되며, 프론트엔드 Dexie DB가 서버 이벤트 로그를 그대로 캐싱합니다.
- **로컬 우선 쓰기**: 사용자가 지출을 등록하거나 예산을 조정하면 `eventService.createLocalEvent` 가 즉시 Dexie에 임시 이벤트를 추가하고 `pendingEvents` 큐에 동기화 페이로드를 저장합니다. UI는 이 데이터를 바로 렌더링하므로 네트워크 상태와 무관하게 즉시 반영됩니다.
- **동기화 루프**: `syncService` 는 앱 초기화 및 주기적 타이머(기본 60초)로 실행됩니다.
  1. `pendingEvents` 큐를 비우며 서버에 이벤트를 푸시하고, 성공 시 임시 이벤트를 서버 응답으로 교체합니다.
  2. 가장 최근 sequence 이후의 서버 이벤트를 풀링하여 Dexie `budgetEvents` 와 `syncMetadata` 를 갱신합니다.
- **상태 표시**: 아직 서버에 반영되지 않은 이벤트는 `syncState` 가 `pending/failed` 로 표시되며, 사용자에게 재시도 버튼이 노출됩니다.

> **TIP:** 새로운 변형을 추가할 때도 “로컬에 먼저 이벤트를 적재하고, 큐에 넣은 뒤 syncService 로 전파” 패턴을 지키면 일관성을 유지할 수 있습니다.

## API 엔드포인트

### 이벤트 & 동기화

- `POST /api/events` - 모든 예산/지출/BUDGET_RESET 이벤트 생성
- `GET /api/events/sync?since=:sequence` - 특정 sequence 이후 이벤트 동기화

### 영수증 OCR

- `POST /api/receipts/upload` - 영수증 업로드 및 OCR 분석

### 설정

- `GET /api/settings` - 앱 설정 조회
- `PUT /api/settings` - 기본 월별 예산 설정
- `POST /api/settings/initial-budget` - 초기 예산 설정 (데이터 리셋)

## 사용 시나리오

### 회식 후 기록하기

1. 메인 페이지 접속
2. 본인 이름 입력
3. 영수증 사진 촬영 또는 업로드
4. 자동 인식된 금액/날짜/상호명 확인
5. 필요시 수정 후 저장

### 잔액 확인하기

- 메인 대시보드에서 현재 월 잔액 즉시 확인
- 사용 내역 목록에서 상세 내역 확인
- 날짜 또는 작성자로 필터링

## 테스트

### E2E 테스트

Playwright를 사용한 End-to-End 테스트가 포함되어 있습니다.

```bash
# E2E 테스트 실행 (헤드리스 모드)
pnpm test:e2e

# UI 모드로 실행 (추천)
pnpm test:e2e:ui
```

## TODO

- Tailwind CSS 4.x 도입 검토: 새 preset 및 atomic 스타일링 흐름에 맞춰 디자인 시스템/빌드 구성을 재정비합니다.

```bash
# 브라우저를 보면서 실행
pnpm test:e2e:headed

# 테스트 리포트 보기
pnpm test:e2e:report
```

**테스트 범위**:

- ✅ 초기 설정 및 예산 관리 (TC-001~002-3)
- ✅ 사용 내역 CRUD 및 필터링 (TC-009~012)
- ✅ 자동 잔액 계산 및 경고 (TC-018~020)
- ✅ CSV 백업/복원 (TC-013~017)
- ✅ UI/UX 반응형 (TC-021~023)
- ✅ 통합 시나리오 (TC-024)
- ✅ 보안 (SQL Injection, XSS) (TC-027~030)

자세한 내용은 [E2E 테스트 가이드](e2e/README.md) 및 [TEST_CASES.md](TEST_CASES.md)를 참고하세요.

## 라이선스

MIT

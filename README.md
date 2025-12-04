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

## API 엔드포인트

### 영수증

- `GET /api/receipts/ocr-provider` - 현재 OCR 프로바이더 정보 조회
- `POST /api/receipts/upload` - 영수증 업로드 및 OCR 분석
- `POST /api/receipts/parse` - 재분석

### 사용 내역

- `GET /api/expenses` - 사용 내역 목록 조회
- `POST /api/expenses` - 사용 내역 생성
- `GET /api/expenses/:id` - 특정 내역 조회
- `PUT /api/expenses/:id` - 내역 수정
- `DELETE /api/expenses/:id` - 내역 삭제

### 월별 예산

- `GET /api/monthly-budgets/current` - 현재 월 예산 조회
- `GET /api/monthly-budgets/:year/:month` - 특정 월 예산 조회
- `PUT /api/monthly-budgets/:year/:month` - 예산 설정
- `POST /api/monthly-budgets/rollover` - 월 이월

### 설정

- `GET /api/settings` - 앱 설정 조회
- `PUT /api/settings` - 기본 월별 예산 설정
- `POST /api/settings/initial-budget` - 초기 예산 설정 (데이터 리셋)

### CSV 백업/복원

- `GET /api/export/csv` - 전체 데이터 CSV 백업
- `POST /api/export/import` - CSV 파일로 데이터 복원

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

## 라이선스

MIT

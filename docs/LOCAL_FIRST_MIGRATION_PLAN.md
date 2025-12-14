# Local-First 아키텍처 마이그레이션 계획

> **업데이트:** 계획 작성 시점에 사용하던 `/api/sync/*`, `/api/monthly-budgets/*` 등의 REST 엔드포인트는 2025.02 기준 모두 제거되었으며, 서버는 `POST /api/events` + `GET /api/events/sync` 중심으로 단순화되었습니다. 아래 문서의 절차는 히스토리 보관용으로 유지합니다.

## 개요

현재 전통적인 Client-Server 아키텍처를 **Local-First 아키텍처**로 전환하여 오프라인 우선 동작, 빠른 응답성, 향상된 사용자 경험을 제공합니다.

### 목표

- ✅ **오프라인 우선**: 네트워크 없이도 완전히 작동
- ✅ **즉시 반응**: 모든 작업이 로컬에서 즉시 실행
- ✅ **자동 동기화**: 백그라운드에서 서버와 동기화
- ✅ **백엔드 최소화**: 동기화 + OpenAI API 프록시만 유지

---

## 현재 아키텍처 분석

### 백엔드 (Node.js + Express + Prisma + SQLite)

**비즈니스 로직**:

- `budgetService.ts`: 월별 예산 자동 이월, 재계산 로직
- `expenseService.ts`: 지출 CRUD, 날짜 기반 MonthlyBudget 자동 매핑
- `ocrService.ts`: OpenAI/Google Vision API 호출
- `settingsService.ts`: 앱 설정 관리
- `exportService.ts`: CSV import/export

**데이터 모델** (Prisma):

- `MonthlyBudget`: year, month, baseAmount, carriedAmount, totalBudget, totalSpent, balance
- `Expense`: authorName, amount, expenseDate, storeName, receiptImageUrl, ocrRawData
- `Settings`: key-value 스토어

**API 엔드포인트**: 25개 (budget, expense, receipt, settings, export)

### 프론트엔드 (React + Vite + React Query + Tailwind)

**상태 관리**:

- React Query v5로 서버 상태 캐싱 (staleTime: 10-60초)
- useState로 로컬 UI 상태 관리

**컴포넌트 구조**:

- `HomePage`: 메인 허브 (영수증 업로드 → 지출 입력 → 목록)
- `BudgetSummary`, `ExpenseList`, `ExpenseForm`, `ReceiptUploader`
- `MonthlyReportPage`, `SettingsPage`

**데이터 흐름**:

```
UI 이벤트 → React Query Mutation → API 호출 → 서버 DB 변경 → 쿼리 무효화 → UI 갱신
```

---

## 목표 아키텍처

### 클라이언트 (React + Dexie.js + IndexedDB)

**로컬 데이터베이스**: IndexedDB (Dexie.js wrapper)

- 모든 데이터를 브라우저에 저장
- 비즈니스 로직 실행 (예산 재계산, 이월 등)
- 오프라인에서도 완전 작동

**동기화 시스템**:

- 백그라운드에서 서버와 양방향 동기화
- Last-Write-Wins (LWW) 충돌 해결 전략
- 동기화 큐 (실패 시 재시도)

**데이터 흐름**:

```
UI 이벤트 → 로컬 서비스 → IndexedDB 변경 → 동기화 큐 → 서버 동기화 → UI 갱신
```

### 백엔드 (최소화)

**역할**:

1. **동기화 서버**: 클라이언트 간 데이터 동기화
2. **OpenAI API 프록시**: OCR 처리 (API 키 숨김)
3. **백업 스토리지**: 데이터 영구 보관

**API 엔드포인트** (3개로 축소):

- `POST /api/sync/pull`: 서버 변경사항 다운로드
- `POST /api/sync/push`: 클라이언트 변경사항 업로드
- `POST /api/ocr/analyze`: OCR 처리

---

## 기술 스택

### 클라이언트사이드 DB

**선택: Dexie.js**

- IndexedDB의 간편한 래퍼
- TypeScript 지원 우수
- React hooks 제공 (`dexie-react-hooks`)
- 경량 (~30KB)

**대안 검토**:

- ❌ RxDB: 과도한 복잡성, 큰 번들 크기
- ❌ PouchDB: CouchDB 백엔드 필요, 구조 변경 큼

### 동기화 전략

**Last-Write-Wins (LWW) with Timestamps**

```typescript
interface SyncableEntity {
  id: string;
  updatedAt: string; // ISO timestamp
  version: number; // Optimistic locking
  deleted: boolean; // Soft delete
}
```

**충돌 해결**:

1. `updatedAt`이 더 최신인 레코드가 승리
2. 동일 시간이면 `version` 번호로 판단
3. 충돌 발생 시 사용자에게 알림 (드문 경우)

### 영수증 이미지 저장

**옵션 1: IndexedDB Blob Storage (추천)**

- 장점: 완전한 오프라인 지원
- 단점: 브라우저 저장소 한계 (50MB~수GB)

**옵션 2: 서버 저장 + URL 동기화**

- 장점: 저장소 무제한
- 단점: 이미지 조회 시 네트워크 필요

**결정**: 옵션 1 채택 + 이미지 압축 (최대 800px, 품질 80%)

---

## 데이터 모델 설계

### Dexie.js 스키마

```typescript
import Dexie, { Table } from 'dexie';

interface MonthlyBudget {
  id: string;
  year: number;
  month: number;
  baseAmount: number;
  carriedAmount: number;
  totalBudget: number;
  totalSpent: number;
  balance: number;
  updatedAt: string;
  deleted: boolean;
  version: number;
}

interface Expense {
  id: string;
  monthlyBudgetId: string;
  authorName: string;
  amount: number;
  expenseDate: string;
  storeName?: string;
  receiptImageUrl: string;
  receiptImageBlob?: Blob; // 로컬 저장
  ocrRawData?: string;
  updatedAt: string;
  deleted: boolean;
  version: number;
}

interface Settings {
  key: string; // Primary key
  value: string; // JSON 문자열
  updatedAt: string;
  version: number;
}

interface SyncMetadata {
  entity: string; // 'expenses' | 'budgets' | 'settings'
  lastSyncTime: string; // ISO timestamp
  pendingChanges: number; // 동기화 대기 중인 변경사항 수
}

class ExpenseTrackerDB extends Dexie {
  monthlyBudgets!: Table<MonthlyBudget>;
  expenses!: Table<Expense>;
  settings!: Table<Settings>;
  syncMetadata!: Table<SyncMetadata>;

  constructor() {
    super('ExpenseTrackerDB');

    this.version(1).stores({
      monthlyBudgets: 'id, [year+month], updatedAt, deleted',
      expenses: 'id, monthlyBudgetId, expenseDate, authorName, updatedAt, deleted',
      settings: 'key',
      syncMetadata: 'entity',
    });
  }
}

export const db = new ExpenseTrackerDB();
```

---

## 새로운 클라이언트 서비스 구조

```
frontend/src/services/
├── db/
│   ├── database.ts           # Dexie DB 정의
│   └── schema.ts             # 타입 정의
│
├── local/
│   ├── budgetService.ts      # 예산 비즈니스 로직
│   │   ├── getOrCreateMonthlyBudget()
│   │   ├── recalculateMonthlyBudget()
│   │   ├── rolloverMonth()
│   │   └── getCurrentMonthlyBudget()
│   │
│   ├── expenseService.ts     # 지출 비즈니스 로직
│   │   ├── createExpense()
│   │   ├── updateExpense()
│   │   ├── deleteExpense()
│   │   └── getExpenses()
│   │
│   └── settingsService.ts    # 설정 관리
│       ├── getSettings()
│       ├── updateSettings()
│       └── setInitialBudget()
│
├── sync/
│   ├── syncService.ts        # 동기화 오케스트레이터
│   │   ├── syncAll()         # Pull + Push
│   │   ├── pull()            # 서버 → 클라이언트
│   │   └── push()            # 클라이언트 → 서버
│   │
│   ├── syncQueue.ts          # 동기화 큐 관리
│   │   ├── enqueue()
│   │   ├── dequeue()
│   │   └── retry()
│   │
│   └── conflictResolver.ts   # 충돌 해결
│       └── resolveConflict() # LWW 로직
│
└── api/
    ├── syncApi.ts            # 동기화 API 클라이언트
    └── ocrApi.ts             # OCR API 클라이언트
```

---

## 동기화 프로토콜

### Pull (서버 → 클라이언트)

**API**: `POST /api/sync/pull`

**요청**:

```typescript
{
  entities: ['expenses', 'budgets', 'settings'],
  lastSyncTime: {
    expenses: '2024-12-05T10:30:00Z',
    budgets: '2024-12-05T10:30:00Z',
    settings: '2024-12-05T10:30:00Z'
  }
}
```

**응답**:

```typescript
{
  expenses: [
    { id: '...', updatedAt: '...', deleted: false, ... },
    { id: '...', updatedAt: '...', deleted: true, ... }
  ],
  budgets: [...],
  settings: [...],
  syncTime: '2024-12-05T11:00:00Z'
}
```

**클라이언트 처리**:

1. 각 엔티티를 `updatedAt` 기준으로 병합
2. `deleted: true`인 항목은 로컬에서 삭제
3. 충돌 시 LWW 적용
4. `lastSyncTime` 업데이트

### Push (클라이언트 → 서버)

**API**: `POST /api/sync/push`

**요청**:

```typescript
{
  changes: [
    {
      entity: 'expenses',
      operation: 'create',
      data: { id: '...', updatedAt: '...', ... }
    },
    {
      entity: 'budgets',
      operation: 'update',
      data: { id: '...', updatedAt: '...', ... }
    },
    {
      entity: 'expenses',
      operation: 'delete',
      data: { id: '...', updatedAt: '...', deleted: true }
    }
  ]
}
```

**응답**:

```typescript
{
  accepted: [
    { id: '...', status: 'success' }
  ],
  conflicts: [
    {
      id: '...',
      clientVersion: { updatedAt: '...', version: 1 },
      serverVersion: { updatedAt: '...', version: 2 },
      resolution: 'server_wins'
    }
  ],
  syncTime: '2024-12-05T11:00:00Z'
}
```

**클라이언트 처리**:

1. `accepted` 항목은 동기화 큐에서 제거
2. `conflicts` 발생 시:
   - 서버 버전을 로컬에 병합
   - 사용자에게 알림 (선택적)
   - 재시도 (충돌 해결 후)

### 동기화 트리거

1. **수동 트리거**:
   - 앱 시작 시 (초기 로드)
   - 사용자가 새로고침 버튼 클릭

2. **자동 트리거**:
   - 10분마다 (백그라운드)
   - 네트워크 재연결 시 (`navigator.onLine` 이벤트)
   - 로컬 변경 발생 후 30초 (디바운싱)

3. **실패 처리**:
   - 3회 재시도 (exponential backoff: 1초, 2초, 4초)
   - 실패 시 동기화 큐에 보관
   - 다음 동기화 주기에 재시도

---

## 마이그레이션 단계별 계획

### Phase 1: 기반 구축 (1-2주)

**목표**: 로컬 DB 및 서비스 레이어 구축

**작업**:

1. Dexie.js 설치

   ```bash
   cd frontend
   pnpm add dexie dexie-react-hooks
   ```

2. DB 스키마 정의 (`services/db/database.ts`)
   - MonthlyBudget, Expense, Settings, SyncMetadata 테이블
   - 인덱스 설정 (year+month, expenseDate, authorName 등)

3. 로컬 서비스 생성
   - `budgetService.ts`: 기존 백엔드 로직 복사
   - `expenseService.ts`: 기존 백엔드 로직 복사
   - `settingsService.ts`: 기존 백엔드 로직 복사

4. 기본 CRUD 구현
   - IndexedDB에 읽기/쓰기
   - Decimal 타입 제거 (number로 통일)
   - 예산 재계산 로직 테스트

**검증**:

- 브라우저 DevTools로 IndexedDB 데이터 확인
- 단위 테스트 (Vitest)

---

### Phase 2: 로컬-퍼스트 전환 (2-3주)

**목표**: React Query 훅을 로컬 DB 사용으로 변경

**작업**:

1. React Query 훅 리팩토링
   - `useBudget.ts`: `budgetApi` → `budgetService` (로컬)
   - `useExpenses.ts`: `expenseApi` → `expenseService` (로컬)
   - `useSettings.ts`: `settingsApi` → `settingsService` (로컬)
   - ✅ 2025.02 기준 `budgetApi`/`expenseApi`는 코드베이스에서 완전히 제거됨

2. Dexie-React-Hooks 통합

   ```typescript
   import { useLiveQuery } from 'dexie-react-hooks';

   export function useCurrentBudget() {
     return useLiveQuery(() => {
       const now = new Date();
       return budgetService.getOrCreateMonthlyBudget(now.getFullYear(), now.getMonth() + 1);
     });
   }
   ```

3. 비즈니스 로직 클라이언트 실행
   - 예산 이월 로직 클라이언트에서 실행
   - 지출 생성 시 MonthlyBudget 자동 재계산
   - 모든 계산이 즉시 반영 (동기식)

4. OCR API는 계속 백엔드 호출
   - `receiptApi.upload()` 유지
   - OpenAI API 키 숨김 필요

**검증**:

- 오프라인 모드에서 앱 작동 확인
- 네트워크 탭에서 API 호출 없는지 확인 (OCR 제외)

---

### Phase 3: 동기화 구현 (2-3주)

**목표**: 백그라운드 동기화 시스템 구축

**작업**:

1. 동기화 큐 구현 (`services/sync/syncQueue.ts`)

   ```typescript
   interface SyncQueueItem {
     id: string;
     entity: 'expenses' | 'budgets' | 'settings';
     operation: 'create' | 'update' | 'delete';
     data: any;
     timestamp: string;
     retryCount: number;
   }

   class SyncQueue {
     async enqueue(item: SyncQueueItem): Promise<void>;
     async dequeue(): Promise<SyncQueueItem[]>;
     async remove(id: string): Promise<void>;
     async retry(id: string): Promise<void>;
   }
   ```

2. Pull 구현 (`services/sync/syncService.ts`)

   ```typescript
   async function pull() {
     const metadata = await db.syncMetadata.toArray();
     const lastSyncTimes = metadata.reduce(
       (acc, m) => ({
         ...acc,
         [m.entity]: m.lastSyncTime,
       }),
       {}
     );

     const response = await syncApi.pull({ lastSyncTimes });

     // 서버 데이터를 로컬에 병합 (LWW)
     await mergeServerData(response);

     // lastSyncTime 업데이트
     await updateSyncMetadata(response.syncTime);
   }
   ```

3. Push 구현

   ```typescript
   async function push() {
     const queue = await syncQueue.dequeue();

     const response = await syncApi.push({ changes: queue });

     // 성공한 항목 제거
     for (const item of response.accepted) {
       await syncQueue.remove(item.id);
     }

     // 충돌 처리
     for (const conflict of response.conflicts) {
       await resolveConflict(conflict);
     }
   }
   ```

4. LWW 충돌 해결 (`services/sync/conflictResolver.ts`)

   ```typescript
   async function resolveConflict(conflict: Conflict) {
     const { clientVersion, serverVersion } = conflict;

     if (serverVersion.updatedAt > clientVersion.updatedAt) {
       // 서버 버전 채택
       await db[conflict.entity].put(serverVersion);
     } else if (serverVersion.updatedAt === clientVersion.updatedAt) {
       // 버전 번호로 판단
       if (serverVersion.version > clientVersion.version) {
         await db[conflict.entity].put(serverVersion);
       }
     }
     // 클라이언트가 더 최신이면 무시 (다음 push에서 재시도)
   }
   ```

5. 백엔드 동기화 API 구현

   ```typescript
   // backend/src/routes/syncRoutes.ts
   router.post('/sync/pull', syncController.pull);
   router.post('/sync/push', syncController.push);

   // backend/src/services/syncService.ts
   async function pull(lastSyncTimes) {
     const expenses = await prisma.expense.findMany({
       where: { updatedAt: { gt: lastSyncTimes.expenses } },
     });
     // budgets, settings도 동일

     return { expenses, budgets, settings, syncTime: new Date() };
   }

   async function push(changes) {
     const accepted = [];
     const conflicts = [];

     for (const change of changes) {
       const existing = await prisma[change.entity].findUnique({
         where: { id: change.data.id },
       });

       if (!existing || existing.updatedAt < change.data.updatedAt) {
         // 클라이언트 버전 채택
         await prisma[change.entity].upsert({
           where: { id: change.data.id },
           update: change.data,
           create: change.data,
         });
         accepted.push({ id: change.data.id, status: 'success' });
       } else {
         // 충돌 발생
         conflicts.push({
           id: change.data.id,
           clientVersion: change.data,
           serverVersion: existing,
           resolution: 'server_wins',
         });
       }
     }

     return { accepted, conflicts, syncTime: new Date() };
   }
   ```

6. 주기적 동기화 스케줄러

   ```typescript
   // services/sync/scheduler.ts
   export function startSyncScheduler() {
     // 앱 시작 시
     syncService.syncAll();

     // 10분마다
     setInterval(() => syncService.syncAll(), 10 * 60 * 1000);

     // 네트워크 재연결 시
     window.addEventListener('online', () => syncService.syncAll());

     // 로컬 변경 발생 후 30초 (디바운싱)
     db.on(
       'changes',
       debounce(() => syncService.push(), 30000)
     );
   }
   ```

**검증**:

- 오프라인 → 온라인 전환 시 동기화 확인
- 다른 브라우저/기기에서 동일 데이터 확인
- 충돌 시나리오 테스트 (동시 편집)

---

### Phase 4: 백엔드 슬림화 (1주)

**목표**: 불필요한 백엔드 코드 제거

**작업**:

1. 비즈니스 로직 제거
   - ❌ `budgetService.ts` 삭제 (동기화 로직만 유지)
   - ❌ `expenseService.ts` 삭제
   - ❌ `settingsService.ts` 삭제

2. API 엔드포인트 최소화
   - ✅ (과거 계획) `/api/sync/pull`, `/api/sync/push`
   - ✅ 유지: `/api/ocr/analyze`
   - ✅ 유지: `/health`
   - ❌ 삭제: 기존 25개 CRUD 엔드포인트
   - 📌 현재 구현에서는 `/api/sync/*` 대신 `/api/events` / `/api/events/sync` 만 노출

3. Prisma 스키마 유지
   - 동기화용 DB로 계속 사용
   - 스키마에 `updatedAt`, `version`, `deleted` 필드 추가

4. 파일 구조 정리
   ```
   backend/src/
   ├── server.ts
   ├── routes/
   │   ├── syncRoutes.ts
   │   └── ocrRoutes.ts
   ├── controllers/
   │   ├── syncController.ts
   │   └── ocrController.ts
   ├── services/
   │   ├── syncService.ts
   │   └── ocr/
   │       ├── IOcrProvider.ts
   │       ├── OcrProviderFactory.ts
   │       └── OpenAIOcrProvider.ts
   ├── middleware/
   │   ├── errorHandler.ts
   │   └── upload.ts
   └── utils/
       └── prisma.ts
   ```

**검증**:

- 백엔드 빌드 확인
- API 문서 업데이트
- 프론트엔드에서 모든 기능 작동 확인

---

### Phase 5: 테스트 및 최적화 (1-2주)

**목표**: 안정성 및 성능 검증

**작업**:

1. **동기화 시나리오 테스트**
   - 단일 기기 오프라인 → 온라인
   - 다중 기기 동시 편집
   - 네트워크 불안정 상황 (느린 연결, 간헐적 끊김)
   - 대량 데이터 동기화 (1000개 이상 지출)

2. **충돌 해결 테스트**
   - 동일 레코드 동시 수정
   - 한 곳에서 삭제, 다른 곳에서 수정
   - 타임스탬프 동일한 경우

3. **성능 최적화**
   - IndexedDB 인덱스 최적화
   - 동기화 배치 사이즈 조정 (한 번에 100개씩)
   - 이미지 압축 (WebP 포맷, 품질 80%)
   - React Query 캐시 설정 조정

4. **오류 처리 강화**
   - 동기화 실패 시 UI 피드백
   - 재시도 로직 개선
   - 로그 및 모니터링 추가

5. **단위 테스트 작성**
   - 로컬 서비스 로직 (budgetService, expenseService)
   - 동기화 로직 (syncService, conflictResolver)
   - 충돌 해결 시나리오

**검증**:

- E2E 테스트 (Playwright)
- 성능 프로파일링 (React DevTools Profiler)
- 브라우저 호환성 테스트 (Chrome, Firefox, Safari, Edge)

---

## 데이터 마이그레이션 전략

### 초기 로드 (기존 서버 데이터 → IndexedDB)

**마이그레이션 API**: `GET /api/migration/export`

**응답**:

```typescript
{
  budgets: MonthlyBudget[],
  expenses: Expense[],
  settings: Settings[]
}
```

**클라이언트 처리**:

```typescript
// services/migration/migrator.ts
async function migrateFromServer() {
  const data = await api.get('/api/migration/export');

  await db.transaction('rw', db.monthlyBudgets, db.expenses, db.settings, async () => {
    await db.monthlyBudgets.bulkPut(data.budgets);
    await db.expenses.bulkPut(data.expenses);
    await db.settings.bulkPut(data.settings);
  });

  // 초기 동기화 시간 설정
  await db.syncMetadata.bulkPut([
    { entity: 'budgets', lastSyncTime: new Date().toISOString(), pendingChanges: 0 },
    { entity: 'expenses', lastSyncTime: new Date().toISOString(), pendingChanges: 0 },
    { entity: 'settings', lastSyncTime: new Date().toISOString(), pendingChanges: 0 },
  ]);

  localStorage.setItem('migrationCompleted', 'true');
}

// App.tsx에서 호출
useEffect(() => {
  if (!localStorage.getItem('migrationCompleted')) {
    migrateFromServer();
  }
}, []);
```

---

## 영수증 이미지 처리

### 이미지 저장 전략

**방식**: IndexedDB Blob Storage

```typescript
// services/local/receiptService.ts
async function saveReceiptImage(file: File): Promise<string> {
  // 1. 이미지 압축 (최대 800px, WebP 포맷)
  const compressedBlob = await compressImage(file, {
    maxWidth: 800,
    quality: 0.8,
    format: 'webp',
  });

  // 2. IndexedDB에 Blob 저장
  const id = generateId();
  await db.expenses.update(id, {
    receiptImageBlob: compressedBlob,
  });

  // 3. Blob URL 반환 (표시용)
  return URL.createObjectURL(compressedBlob);
}

async function getReceiptImage(id: string): Promise<string> {
  const expense = await db.expenses.get(id);
  if (expense?.receiptImageBlob) {
    return URL.createObjectURL(expense.receiptImageBlob);
  }
  throw new Error('Image not found');
}
```

**이미지 압축 라이브러리**: `browser-image-compression`

```bash
pnpm add browser-image-compression
```

### 저장소 용량 관리

**브라우저별 제한**:

- Chrome: ~60% 디스크 여유 공간
- Firefox: ~50% 디스크 여유 공간
- Safari: ~1GB (iOS는 더 적음)

**용량 초과 시 전략**:

1. 경고 표시 (90% 도달 시)
2. 오래된 이미지 자동 삭제 (6개월 이상)
3. 서버 백업으로 전환 제안

---

## 리스크 및 완화 전략

### 1. 브라우저 저장소 손실

**리스크**: 사용자가 브라우저 데이터 삭제 시 모든 로컬 데이터 손실

**완화**:

- ✅ 서버에 자동 백업 (동기화)
- ✅ 경고 메시지 표시 ("브라우저 데이터를 삭제하지 마세요")
- ✅ 복구 기능 (서버에서 전체 다운로드)

### 2. 동기화 충돌

**리스크**: 여러 기기에서 동시 편집 시 데이터 손실 가능

**완화**:

- ✅ LWW로 최신 버전 자동 선택
- ✅ 충돌 발생 시 사용자 알림
- ✅ 버전 히스토리 (선택적 구현)

### 3. 영수증 이미지 용량

**리스크**: 이미지가 많으면 저장소 한계 도달

**완화**:

- ✅ 이미지 압축 (WebP, 800px, 품질 80%)
- ✅ 용량 모니터링 및 경고
- ✅ 오래된 이미지 자동 정리

### 4. 네트워크 실패

**리스크**: 동기화 실패 시 데이터 불일치

**완화**:

- ✅ 재시도 로직 (exponential backoff)
- ✅ 동기화 큐 (실패한 항목 보관)
- ✅ 수동 동기화 버튼

### 5. OCR API 비용

**리스크**: OpenAI API 사용량 증가로 비용 상승

**완화**:

- ✅ Dummy OCR 프로바이더로 테스트
- ✅ Google Vision API로 대체 가능
- ✅ 사용량 모니터링

---

## 예상 일정 및 리소스

### 타임라인

| Phase                     | 기간       | 담당                       |
| ------------------------- | ---------- | -------------------------- |
| Phase 1: 기반 구축        | 1-2주      | 백엔드 + 프론트엔드 개발자 |
| Phase 2: 로컬-퍼스트 전환 | 2-3주      | 프론트엔드 개발자          |
| Phase 3: 동기화 구현      | 2-3주      | 풀스택 개발자              |
| Phase 4: 백엔드 슬림화    | 1주        | 백엔드 개발자              |
| Phase 5: 테스트 및 최적화 | 1-2주      | QA + 풀스택 개발자         |
| **총 예상 기간**          | **7-11주** |                            |

### 리소스 요구사항

- **개발자**: 풀스택 1명 (또는 프론트 1명 + 백엔드 0.5명)
- **QA**: 1명 (Phase 5)
- **인프라**: 없음 (기존 서버 활용)

---

## 성공 지표

### 기술 지표

- ✅ **오프라인 동작률**: 100% (OCR 제외)
- ✅ **동기화 성공률**: >99%
- ✅ **충돌 발생률**: <1%
- ✅ **평균 응답 시간**: <50ms (로컬 작업)
- ✅ **동기화 지연**: <5초 (온라인 시)

### 사용자 경험 지표

- ✅ **앱 로딩 속도**: <1초 (IndexedDB 캐시)
- ✅ **지출 입력 → 반영**: 즉시 (동기식)
- ✅ **네트워크 오류율**: 0% (오프라인 지원)

---

## 참고 자료

### 라이브러리 문서

- [Dexie.js](https://dexie.org/)
- [Dexie React Hooks](<https://dexie.org/docs/dexie-react-hooks/useLiveQuery()>)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

### Local-First 아키텍처 참고

- [Local-First Software](https://www.inkandswitch.com/local-first/)
- [Offline First Design Patterns](https://offlinefirst.org/)
- [PouchDB Sync Protocol](https://docs.couchdb.org/en/stable/replication/protocol.html)

### 동기화 전략

- [CRDTs: Conflict-Free Replicated Data Types](https://crdt.tech/)
- [Operational Transformation](https://en.wikipedia.org/wiki/Operational_transformation)
- [Last-Write-Wins (LWW)](https://en.wikipedia.org/wiki/Eventual_consistency)

---

## 다음 단계

1. ✅ **이 계획서 검토 및 승인**
2. 🔄 **Phase 1 착수**: Dexie.js 설치 및 DB 스키마 정의
3. 🔄 **프로토타입 구축**: 간단한 CRUD 작동 확인
4. 🔄 **단계별 진행**: Phase 2 → Phase 5

---

**작성일**: 2024-12-05
**브랜치**: `local-first-architecture`
**작성자**: Claude Code

# 작업 기록: Supabase PostgreSQL 연결 설정

- **날짜**: 2026-01-30
- **범위**: Backend DB 연결을 Supabase PostgreSQL로 전환

## 배경

기존 로컬/직접 PostgreSQL 연결에서 Supabase Pooler 기반 연결로 전환하기 위해 Prisma 7 호환 설정을 진행했다.

## 수행 작업

### 1. Prisma 7 Driver Adapter 도입

Prisma 7은 `client` 엔진이 기본이며 Supabase 연결 시 driver adapter가 필수다.

- `@prisma/adapter-pg` 패키지 설치
- `backend/src/utils/prisma.ts`에서 `PrismaPg` adapter를 사용하도록 변경

```typescript
// before
const prisma = new PrismaClient({ ... });

// after
const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter, ... });
```

### 2. schema.prisma 정리

Prisma 7에서는 `datasource` 블록에 `url`/`directUrl`을 직접 명시하지 않고 `prisma.config.ts`에서 관리한다.

```prisma
datasource db {
  provider = "postgresql"
}
```

### 3. prisma.config.ts 설정

```typescript
export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL, // Transaction Pooler (6543)
    directUrl: process.env.DIRECT_URL, // Session Pooler (5432)
  },
  migrations: { path: './prisma/migrations' },
});
```

### 4. .env 호스트 수정

Supabase pooler 호스트가 `aws-0`이 아닌 `aws-1`이었다. Dashboard > Connect에서 확인 후 수정.

```diff
- aws-0-ap-south-1.pooler.supabase.com
+ aws-1-ap-south-1.pooler.supabase.com
```

### 5. .env.example 업데이트

- `connection_limit` 파라미터 제거 (Supavisor가 서버 측에서 관리)
- 주석을 Supavisor 기준으로 변경
- 호스트의 `aws-N` 번호가 프로젝트별로 다르다는 안내 추가

## 변경 파일

| 파일                           | 변경 내용                            |
| ------------------------------ | ------------------------------------ |
| `backend/package.json`         | `@prisma/adapter-pg` 의존성 추가     |
| `backend/pnpm-lock.yaml`       | lockfile 갱신                        |
| `backend/prisma/schema.prisma` | `datasource`에서 url 제거            |
| `backend/prisma.config.ts`     | `defineConfig`로 url/directUrl 설정  |
| `backend/src/utils/prisma.ts`  | `PrismaPg` adapter 적용              |
| `backend/.env`                 | pooler 호스트 `aws-0` → `aws-1` 수정 |
| `backend/.env.example`         | 주석 개선, `connection_limit` 제거   |

## 검증 결과

| 항목                           | 결과                          |
| ------------------------------ | ----------------------------- |
| DB 연결 (pg 직접)              | 성공 — budget_events 5건 조회 |
| `GET /api/health`              | `{"status":"ok"}`             |
| `GET /api/events/sync?since=0` | 5건 이벤트 정상 반환          |
| `GET /api/settings`            | defaultMonthlyBudget: 300,000 |
| `pnpm lint`                    | 통과                          |
| `pnpm format:check`            | 통과                          |
| `pnpm typecheck`               | 통과                          |
| `pnpm test` (28건)             | 통과                          |
| `pnpm build`                   | 통과                          |

## 트러블슈팅 메모

- **"Tenant or user not found"**: pooler 호스트의 `aws-N` 번호가 틀리면 발생. Dashboard에서 확인 필수.
- **Prisma 7 + Supabase**: `@prisma/adapter-pg` 없이는 연결 불가. adapter에는 Session Pooler(5432) URL을 전달해야 prepared statement 호환 문제가 없다.

# 이미지 저장 방식 변경: 파일 → DB Blob

## 변경 내용

영수증 이미지를 디스크 파일 대신 데이터베이스에 blob으로 저장하도록 변경했습니다.

### 주요 변경사항

1. **이미지 리사이징**: 800px → 480px (성능 최적화)
2. **저장 방식**: 파일 시스템 → DB blob (base64 encoded)
3. **업로드 처리**: multer diskStorage → memoryStorage
4. **OCR 처리**: 파일 경로 기반 → Buffer 기반

## 변경된 파일

### Backend

#### 1. Database Schema (`backend/prisma/schema.prisma`)

```prisma
model Expense {
  // ...
  receiptImageUrl String? // deprecated, 마이그레이션 용도
  receiptImage    Bytes?  // 새로운 blob 필드
  // ...
}
```

#### 2. Upload Middleware (`backend/src/middleware/upload.ts`)

- `multer.diskStorage()` → `multer.memoryStorage()`
- 파일을 메모리에 직접 저장

#### 3. Receipt Controller (`backend/src/controllers/receiptController.ts`)

- `normalizeReceiptImage()` 제거
- `processReceiptImage()` 추가: Buffer 반환
- 480px로 리사이징 + JPEG 변환
- Response: `{ imageId, imageBuffer (base64), ocrResult }`

#### 4. OCR Services

- `IOcrProvider` 인터페이스: `analyzeReceiptFromBuffer(Buffer)` 메서드 추가
- `OpenAIOcrProvider`: Buffer 기반 분석
- `GoogleVisionOcrProvider`: Buffer 기반 분석
- `DummyOcrProvider`: Buffer 기반 분석

#### 5. Expense Service (`backend/src/services/expenseService.ts`)

- `CreateExpenseRequest`: `receiptImage` (base64) 필드 추가
- `toExpenseResponse()`: Buffer를 base64로 자동 변환

#### 6. Types (`backend/src/types/index.ts`)

```typescript
interface BudgetEventResponse {
  // ...
  receiptImage: string | null; // base64 encoded
}

interface ReceiptUploadResponse {
  imageId: string;
  imageBuffer: string; // base64 encoded
  ocrResult: OcrResult;
}
```

### Frontend

#### 1. Database Schema (`frontend/src/services/db/database.ts`)

```typescript
interface Expense {
  receiptImageUrl?: string; // deprecated
  receiptImage?: string; // base64 encoded
}
```

#### 2. Types (`frontend/src/types/index.ts`)

- `Expense`: `receiptImage` 필드 추가
- `ReceiptUploadResponse`: `imageBuffer` 필드로 변경
- `ExpenseFormData`: `receiptImage` 필드 사용

#### 3. API Service (`frontend/src/services/api.ts`)

- `receiptApi.upload()`: base64 이미지 버퍼 반환

#### 4. Components

- `ExpenseForm.tsx`: base64 이미지 표시
- `ExpenseList.tsx`: base64 우선, fallback으로 URL 지원
- `HomePage.tsx`: `imageBuffer` prop 전달

#### 5. Local Service (`frontend/src/services/local/expenseService.ts`)

- `CreateExpenseData`: `receiptImage` 필드 사용

## 마이그레이션

### 실행 방법

```bash
cd backend
npx tsx src/scripts/migrateImagesToBlob.ts
```

### 마이그레이션 스크립트 (`backend/src/scripts/migrateImagesToBlob.ts`)

- 기존 파일 기반 이미지를 DB blob으로 변환
- 480px로 리사이징 + JPEG 변환
- `receiptImageUrl`이 있고 `receiptImage`가 null인 항목만 처리
- 진행 상황과 결과 통계 출력

### 마이그레이션 결과 (예시)

```
🚀 Starting image migration to blob storage...
📊 Found 3 expenses with file-based images

Processing expense xxx...
  ✅ Successfully migrated (48194 bytes)

📈 Migration Summary:
  ✅ Success: 3
  ❌ Failed: 0
  📊 Total: 3
```

## 호환성

### 하위 호환성

- `receiptImageUrl` 필드는 deprecated이지만 유지
- 기존 데이터는 마이그레이션 스크립트로 변환 필요
- Frontend는 `receiptImage` 우선, 없으면 `receiptImageUrl` fallback

### 롤백 가능

- `receiptImageUrl` 필드가 여전히 존재
- 필요시 blob → 파일로 역변환 가능

## 장점

1. **배포 간소화**: 파일 시스템 동기화 불필요
2. **백업 용이**: DB 백업만으로 완전한 데이터 보존
3. **스케일링**: CDN 없이도 다중 서버 구성 가능
4. **이미지 크기 감소**: 480px로 리사이징하여 용량 절감
5. **트랜잭션 보장**: 이미지와 메타데이터의 원자성 보장

## 주의사항

1. **DB 크기 증가**: 이미지가 DB에 저장되므로 크기 증가
2. **쿼리 성능**: 대량의 이미지 조회 시 네트워크 부하 증가
3. **Base64 오버헤드**: 약 33% 크기 증가 (JSON 전송 시)

## 테스트 체크리스트

- [x] 영수증 업로드 및 OCR 분석
- [x] 지출 등록 (이미지 포함)
- [x] 지출 목록 조회 (이미지 표시)
- [x] 지출 상세 모달 (이미지 표시)
- [x] 기존 데이터 마이그레이션
- [x] 서버 시작 및 동작 확인

## 환경 변수

변경 없음 - 기존 설정 그대로 사용

## 성능 최적화 권장사항

1. **이미지 레이지 로딩**: 목록에서는 썸네일만, 상세보기에서 전체 이미지
2. **캐싱**: 브라우저 캐시 활용 (base64 이미지 캐싱)
3. **압축**: Gzip/Brotli 압축으로 전송 크기 감소
4. **프로덕션**: S3 등 오브젝트 스토리지 고려 (대량 이미지 시)

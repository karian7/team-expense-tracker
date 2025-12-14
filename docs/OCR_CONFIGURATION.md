# OCR 설정 가이드

팀 회식비 관리 시스템은 영수증 이미지를 자동으로 분석하기 위해 OCR(Optical Character Recognition) 기술을 사용합니다. 두 가지 OCR 프로바이더를 지원하며, 환경 변수를 통해 쉽게 전환할 수 있습니다.

## 지원하는 OCR 프로바이더

### 1. OpenAI Vision API (기본값)

- **장점**: 높은 정확도, 한글 인식 우수, 간단한 설정
- **단점**: API 호출당 비용 발생
- **추천 대상**: 정확한 OCR이 필요하고 비용을 감수할 수 있는 경우

### 2. Google Cloud Vision API

- **장점**: 안정적인 서비스, 다양한 언어 지원
- **단점**: Google Cloud 계정 및 설정 필요
- **추천 대상**: Google Cloud 인프라를 이미 사용 중인 경우

## 설정 방법

### OpenAI Vision API 설정

1. OpenAI API 키 발급
   - [OpenAI Platform](https://platform.openai.com/api-keys)에서 API 키 생성
   - 결제 정보 등록 필요 (GPT-4o 모델 사용)

2. 환경 변수 설정

   ```bash
   # .env 파일
   OCR_PROVIDER=openai
   OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. 패키지 설치 (이미 설치되어 있음)
   ```bash
   npm install openai
   ```

### Google Cloud Vision API 설정

1. Google Cloud 프로젝트 생성
   - [Google Cloud Console](https://console.cloud.google.com/)에서 새 프로젝트 생성
   - Cloud Vision API 활성화

2. 서비스 계정 생성 및 키 다운로드

   ```
   1. IAM 및 관리자 > 서비스 계정으로 이동
   2. 서비스 계정 만들기
   3. 역할: Cloud Vision API 사용자 (roles/cloudvision.user)
   4. 키 생성 (JSON 형식)
   5. 다운로드한 JSON 파일을 안전한 위치에 저장
   ```

3. 환경 변수 설정

   ```bash
   # .env 파일
   OCR_PROVIDER=google
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
   ```

4. 패키지 설치
   ```bash
   npm install @google-cloud/vision
   ```

## OCR 프로바이더 전환

OCR 프로바이더를 전환하려면 `.env` 파일의 `OCR_PROVIDER` 값만 변경하면 됩니다:

```bash
# OpenAI 사용
OCR_PROVIDER=openai

# 또는 Google Vision 사용
OCR_PROVIDER=google
```

서버를 재시작하면 새로운 설정이 적용됩니다.

## 현재 OCR 프로바이더 확인

이벤트 소싱 이후 불필요한 엔드포인트를 정리하면서 `/api/receipts/ocr-provider` 역시 제거되었습니다. 현재 사용 중인 프로바이더는 서버 로그(부팅 시 `OCR Provider initialized: ...`) 또는 `.env` 값을 직접 확인해주세요.

## OCR 결과 형식

두 프로바이더 모두 동일한 형식으로 결과를 반환합니다:

```typescript
interface OcrResult {
  amount: number | null; // 결제 금액
  date: string | null; // 결제 날짜 (YYYY-MM-DD)
  storeName: string | null; // 상호명
  confidence: number; // 신뢰도 (0.0 ~ 1.0)
  rawText?: string; // 원본 텍스트
  error?: string; // 오류 메시지 (있는 경우)
}
```

## 문제 해결

### OpenAI 관련 문제

**오류: "No response from OpenAI"**

- API 키가 올바른지 확인
- OpenAI 계정에 크레딧이 충분한지 확인
- 네트워크 연결 확인

**오류: "Rate limit exceeded"**

- OpenAI API 사용량 제한 초과
- [Usage Limits](https://platform.openai.com/account/limits) 확인
- 요금제 업그레이드 또는 대기 후 재시도

### Google Vision 관련 문제

**오류: "No text detected in image"**

- 이미지 품질 확인 (해상도, 명확도)
- 영수증이 명확하게 보이는지 확인

**오류: "GOOGLE_APPLICATION_CREDENTIALS not set"**

- 환경 변수가 올바르게 설정되었는지 확인
- JSON 키 파일 경로가 정확한지 확인
- 파일 권한 확인 (읽기 가능해야 함)

**오류: "Permission denied"**

- 서비스 계정에 Cloud Vision API 사용 권한이 있는지 확인
- Google Cloud 프로젝트에서 API가 활성화되었는지 확인

## 비용 비교

### OpenAI Vision API

- GPT-4o 모델: 입력 이미지당 약 $0.00275 (이미지 크기에 따라 다름)
- 텍스트 출력: 1K 토큰당 $0.01
- [OpenAI Pricing](https://openai.com/api/pricing/)

### Google Cloud Vision API

- Text Detection: 1,000회당 $1.50 (월 1,000회까지 무료)
- [Google Cloud Vision Pricing](https://cloud.google.com/vision/pricing)

## 추가 정보

### 커스텀 OCR 프로바이더 추가

새로운 OCR 프로바이더를 추가하려면:

1. `IOcrProvider` 인터페이스 구현
2. `OcrProviderFactory`에 새 프로바이더 타입 추가
3. 환경 변수 설정 업데이트

**예시:**

```typescript
// src/services/ocr/CustomOcrProvider.ts
import { IOcrProvider } from './IOcrProvider';
import { OcrResult } from '../../types';

export class CustomOcrProvider implements IOcrProvider {
  public readonly providerName = 'Custom';

  async analyzeReceipt(imagePath: string): Promise<OcrResult> {
    // OCR 로직 구현
    return {
      amount: null,
      date: null,
      storeName: null,
      confidence: 0,
    };
  }
}
```

### 성능 최적화

1. **이미지 전처리**
   - 업로드 전 이미지 크기 조정 (최대 1MB 권장)
   - 명확도 향상을 위한 이미지 보정

2. **캐싱**
   - 동일 영수증 재분석 시 캐시 활용 고려
   - 데이터베이스에 OCR 결과 저장

3. **배치 처리**
   - 여러 영수증을 한 번에 처리할 경우 병렬 처리 고려

## 참고 자료

- [OpenAI Vision API 문서](https://platform.openai.com/docs/guides/vision)
- [Google Cloud Vision API 문서](https://cloud.google.com/vision/docs)
- [프로젝트 README](/README.md)

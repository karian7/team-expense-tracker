import OpenAI from 'openai';
import { OcrResult } from '../../types';
import { IOcrProvider } from './IOcrProvider';

/**
 * OpenAI Vision API를 사용한 OCR 프로바이더
 */
export class OpenAIOcrProvider implements IOcrProvider {
  private client: OpenAI;
  public readonly providerName = 'OpenAI';

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * OpenAI Vision API를 사용하여 영수증 이미지 분석
   */
  async analyzeReceiptFromBuffer(imageBuffer: Buffer): Promise<OcrResult> {
    try {
      const base64Image = imageBuffer.toString('base64');
      const mimeType = 'image/jpeg';

      const response = await this.client.chat.completions.create({
        model: 'gpt-5.1',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `이미지를 분석하여 영수증인지 확인하고, 영수증인 경우 정보를 추출하세요.
이미지에 명시적으로 표시된 정보만 추출하세요.
추측, 보완 추론, 시간대 변환은 절대 하지 마세요.

⸻

1단계: 영수증 여부 판단

이미지가 다음 조건을 만족하는지 확인하세요:
 • 상호명 또는 사업자 정보가 있음
 • 결제 금액이 명시되어 있음
 • 거래 날짜 또는 시간 정보가 있음
 • 영수증, 계산서, 거래 명세서 형태임

영수증이 아닌 경우 (풍경, 사람, 일반 문서 등):
 • isReceipt: false로 설정
 • 다른 필드는 모두 null
 • confidence: 0.0

⸻

2단계: 정보 추출 (영수증인 경우)

아래 3가지 정보만 추출합니다.
 1. 총 결제 금액
 • 실제로 최종 결제된 금액
 • 숫자만 반환 (통화 기호, 쉼표, 소수점 제거)
 • 여러 금액이 있을 경우 "합계", "총액", "결제금액", "승인금액" 등 최종 금액만 사용
 2. 결제 날짜 및 시간
 • 영수증에 표시된 날짜와 시간은 한국시간(KST) 기준입니다.
 • 시간대 변환을 하지 말고, 표시된 시각을 그대로 사용하세요.
 • 날짜와 시간이 모두 있는 경우
YYYY-MM-DDTHH:mm:ss
 • 시간이 없는 경우
YYYY-MM-DD
 • 여러 날짜가 있을 경우 결제 또는 승인 시점을 우선
 3. 상호명 / 가게 이름
 • 영수증 상단에 표시된 대표 상호명
 • 지점명 포함 가능
 • 개인 이름, 카드사, 결제 플랫폼 이름은 제외

⸻

출력 형식 규칙 (필수)
 • 반드시 JSON 형식으로만 응답
 • 코드블럭(\`\`\`) 사용 금지
 • 필드 누락 금지
 • 값을 확인할 수 없는 경우 null 반환

출력 형식:

{
"isReceipt": true | false,
"amount": 숫자 | null,
"date": "YYYY-MM-DDTHH:mm:ss" | "YYYY-MM-DD" | null,
"storeName": 문자열 | null,
"confidence": 0.0 ~ 1.0
}

⸻

confidence 산정 기준

영수증이 아닌 경우: confidence = 0.0

영수증인 경우, 전체 결과에 대한 단일 신뢰도:
 • 0.9 ~ 1.0 : 금액, 날짜, 상호명 모두 명확
 • 0.7 ~ 0.9 : 일부 정보(시간, 지점명 등)가 불명확
 • 0.4 ~ 0.7 : 핵심 정보 중 하나 이상이 불확실
 • 0.0 ~ 0.4 : 대부분의 정보가 명확하지 않음

⸻

추가 제약
 • 이미지에 직접 보이는 텍스트만 사용
 • "추정", "보임", "아마도" 등의 표현 사용 금지
 • JSON 외의 설명 문장 출력 금지`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // JSON 파싱
      const result = this.parseResponse(content);

      return result;
    } catch (error) {
      console.error('OpenAI OCR Error:', error);

      return {
        amount: null,
        date: null,
        storeName: null,
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * OpenAI 응답을 OcrResult로 파싱
   */
  private parseResponse(content: string): OcrResult {
    try {
      // JSON 블록 추출 (마크다운 코드 블록 제거)
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;

      const parsed = JSON.parse(jsonString);

      return {
        amount: parsed.amount !== null ? parseFloat(parsed.amount) : null,
        date: parsed.date || null,
        storeName: parsed.storeName || null,
        confidence: parsed.confidence || 0,
        isReceipt: parsed.isReceipt !== undefined ? parsed.isReceipt : true, // 기본값 true (하위 호환성)
        rawText: content,
      };
    } catch {
      console.error('Failed to parse OpenAI response:', content);

      // 숫자 패턴 찾기 시도
      const amountMatch = content.match(/(\d{1,3}(?:,\d{3})*|\d+)/);
      const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;

      return {
        amount,
        date: null,
        storeName: null,
        confidence: 0.3,
        isReceipt: false, // 파싱 실패 = 영수증 아님
        rawText: content,
        error: 'Failed to parse structured response',
      };
    }
  }
}

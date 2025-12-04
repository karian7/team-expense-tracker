import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
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
  async analyzeReceipt(imagePath: string): Promise<OcrResult> {
    try {
      // 이미지 파일을 base64로 인코딩
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.getMimeType(imagePath);

      const response = await this.client.chat.completions.create({
        model: 'gpt-5.1',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `다음 영수증 이미지를 분석해주세요. 반드시 JSON 형식으로만 응답해주세요.

필수 추출 정보:
- 총 결제 금액 (숫자만, 쉼표 없이)
- 결제 날짜 (YYYY-MM-DD 형식)
- 상호명 또는 가게 이름

JSON 형식:
{
  "amount": 숫자 또는 null,
  "date": "YYYY-MM-DD" 또는 null,
  "storeName": "상호명" 또는 null,
  "confidence": 0.0~1.0 사이의 숫자
}

정보를 찾을 수 없는 경우 null을 반환하세요.
confidence는 추출한 정보에 대한 확신도입니다 (0.0~1.0).`,
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
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;

      const parsed = JSON.parse(jsonString);

      return {
        amount: parsed.amount !== null ? parseFloat(parsed.amount) : null,
        date: parsed.date || null,
        storeName: parsed.storeName || null,
        confidence: parsed.confidence || 0,
        rawText: content,
      };
    } catch (error) {
      console.error('Failed to parse OpenAI response:', content);

      // 숫자 패턴 찾기 시도
      const amountMatch = content.match(/(\d{1,3}(?:,\d{3})*|\d+)/);
      const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;

      return {
        amount,
        date: null,
        storeName: null,
        confidence: 0.3,
        rawText: content,
        error: 'Failed to parse structured response',
      };
    }
  }

  /**
   * 파일 확장자에서 MIME 타입 추출
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    return mimeTypes[ext] || 'image/jpeg';
  }
}

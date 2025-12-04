import vision, { ImageAnnotatorClient } from '@google-cloud/vision';
import fs from 'fs';
import { OcrResult } from '../../types';
import { IOcrProvider } from './IOcrProvider';

/**
 * Google Cloud Vision API를 사용한 OCR 프로바이더
 */
export class GoogleVisionOcrProvider implements IOcrProvider {
  private client: ImageAnnotatorClient;
  public readonly providerName = 'Google Vision';

  constructor(keyFilename?: string) {
    // keyFilename이 제공되면 사용, 아니면 환경변수(GOOGLE_APPLICATION_CREDENTIALS) 사용
    this.client = new ImageAnnotatorClient(keyFilename ? { keyFilename } : {});
  }

  /**
   * Google Vision API를 사용하여 영수증 이미지 분석
   */
  async analyzeReceipt(imagePath: string): Promise<OcrResult> {
    try {
      // 이미지 파일 읽기
      const imageBuffer = fs.readFileSync(imagePath);

      // Text Detection (OCR) 수행
      const [result] = await this.client.textDetection({
        image: { content: imageBuffer },
      });

      const detections = result.textAnnotations;

      if (!detections || detections.length === 0) {
        return {
          amount: null,
          date: null,
          storeName: null,
          confidence: 0,
          error: 'No text detected in image',
        };
      }

      // 첫 번째 항목은 전체 텍스트
      const fullText = detections[0]?.description || '';

      // OCR 결과 파싱
      const parsedResult = this.parseReceiptText(fullText);

      return {
        ...parsedResult,
        rawText: fullText,
      };
    } catch (error) {
      console.error('Google Vision OCR Error:', error);

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
   * OCR 텍스트에서 영수증 정보 추출
   */
  private parseReceiptText(text: string): Omit<OcrResult, 'rawText'> {
    let amount: number | null = null;
    let date: string | null = null;
    let storeName: string | null = null;
    let confidence = 0;

    // 금액 추출 패턴
    // 예: "합계 15,000", "총액: 15000원", "Total 15,000"
    const amountPatterns = [
      /(?:합계|총액|total|amount|결제금액|지불금액)[\s:]*([0-9,]+)/i,
      /([0-9,]+)[\s]*원/,
      /\b([0-9]{1,3}(?:,[0-9]{3})+)\b/,
    ];

    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        const amountStr = match[1].replace(/,/g, '');
        const parsedAmount = parseInt(amountStr, 10);
        if (!isNaN(parsedAmount) && parsedAmount > 0) {
          amount = parsedAmount;
          confidence += 0.3;
          break;
        }
      }
    }

    // 날짜 추출 패턴
    // 예: "2024-01-15", "2024.01.15", "2024/01/15", "24-01-15"
    const datePatterns = [
      /(\d{4}[-/.]\d{2}[-/.]\d{2})/,
      /(\d{2}[-/.]\d{2}[-/.]\d{2})/,
      /(\d{4}년\s*\d{1,2}월\s*\d{1,2}일)/,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        date = this.normalizeDate(match[1]);
        if (date) {
          confidence += 0.3;
          break;
        }
      }
    }

    // 상호명 추출 (텍스트의 첫 몇 줄에서 추출)
    const lines = text.split('\n').filter((line) => line.trim());
    if (lines.length > 0) {
      // 첫 번째 줄이 일반적으로 상호명
      storeName = lines[0].trim();
      // 너무 긴 경우 제한
      if (storeName.length > 50) {
        storeName = storeName.substring(0, 50);
      }
      confidence += 0.2;
    }

    // 모든 정보를 찾았으면 confidence 최대값
    if (amount && date && storeName) {
      confidence = Math.min(0.95, confidence);
    }

    return {
      amount,
      date,
      storeName,
      confidence,
    };
  }

  /**
   * 날짜 문자열을 YYYY-MM-DD 형식으로 정규화
   */
  private normalizeDate(dateStr: string): string | null {
    try {
      // "2024년 1월 15일" 형식 처리
      const koreanMatch = dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
      if (koreanMatch) {
        const [, year, month, day] = koreanMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

      // "2024-01-15", "2024.01.15", "2024/01/15" 형식 처리
      const fullDateMatch = dateStr.match(/(\d{4})[-/.](\d{2})[-/.](\d{2})/);
      if (fullDateMatch) {
        const [, year, month, day] = fullDateMatch;
        return `${year}-${month}-${day}`;
      }

      // "24-01-15" 형식 처리 (20XX년대 가정)
      const shortDateMatch = dateStr.match(/(\d{2})[-/.](\d{2})[-/.](\d{2})/);
      if (shortDateMatch) {
        const [, year, month, day] = shortDateMatch;
        const fullYear = `20${year}`;
        return `${fullYear}-${month}-${day}`;
      }

      return null;
    } catch (error) {
      console.error('Date normalization error:', error);
      return null;
    }
  }
}

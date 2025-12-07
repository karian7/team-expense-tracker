import { OcrResult } from '../../types';

/**
 * OCR 프로바이더 인터페이스
 * 다양한 OCR 서비스를 추상화하여 동일한 인터페이스로 사용
 */
export interface IOcrProvider {
  /**
   * 영수증 이미지 분석 (Buffer 기반)
   * @param imageBuffer 분석할 이미지 버퍼
   * @returns OCR 분석 결과
   */
  analyzeReceiptFromBuffer(imageBuffer: Buffer): Promise<OcrResult>;

  /**
   * OCR 프로바이더 이름
   */
  readonly providerName: string;
}

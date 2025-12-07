import { IOcrProvider } from './IOcrProvider';
import { OcrResult } from '../../types';

/**
 * 외부 API 호출 없이 고정된 값을 반환하는 더미 OCR 프로바이더
 */
export class DummyOcrProvider implements IOcrProvider {
  public readonly providerName = 'Dummy';

  async analyzeReceiptFromBuffer(imageBuffer: Buffer): Promise<OcrResult> {
    const randomAmount = 10000 + Math.floor(Math.random() * 40000);

    const today = new Date();

    return {
      amount: randomAmount,
      date: today.toISOString(),
      storeName: '더미상점',
      confidence: 0.9,
      rawText: `Dummy OCR for image buffer (${imageBuffer.length} bytes)`,
    };
  }
}

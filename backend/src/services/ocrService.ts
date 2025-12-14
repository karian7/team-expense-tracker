import { OcrResult } from '../types';
import { OcrProviderFactory } from './ocr/OcrProviderFactory';
import { IOcrProvider } from './ocr/IOcrProvider';

/**
 * 싱글톤 OCR 프로바이더 인스턴스
 */
let ocrProvider: IOcrProvider | null = null;

/**
 * OCR 프로바이더 인스턴스 가져오기 (Lazy initialization)
 */
function getOcrProvider(): IOcrProvider {
  if (!ocrProvider) {
    ocrProvider = OcrProviderFactory.createProvider();
    console.log(`OCR Provider initialized: ${ocrProvider.providerName}`);
  }
  return ocrProvider;
}

/**
 * 영수증 이미지 분석 (Buffer 기반)
 */
export async function analyzeReceiptWithBuffer(imageBuffer: Buffer): Promise<OcrResult> {
  const provider = getOcrProvider();
  return provider.analyzeReceiptFromBuffer(imageBuffer);
}

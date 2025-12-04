import { IOcrProvider } from './IOcrProvider';
import { OpenAIOcrProvider } from './OpenAIOcrProvider';
import { GoogleVisionOcrProvider } from './GoogleVisionOcrProvider';
import { DummyOcrProvider } from './DummyOcrProvider';

export type OcrProviderType = 'openai' | 'google' | 'dummy';

/**
 * OCR 프로바이더 팩토리
 * 환경 변수에 따라 적절한 OCR 프로바이더를 생성
 */
export class OcrProviderFactory {
  /**
   * 환경 변수에 설정된 OCR 프로바이더 생성
   * @returns IOcrProvider 인스턴스
   */
  static createProvider(): IOcrProvider {
    const providerType = (process.env.OCR_PROVIDER || 'dummy').toLowerCase() as OcrProviderType;

    switch (providerType) {
      case 'dummy':
        return new DummyOcrProvider();
      case 'google':
        return new GoogleVisionOcrProvider(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      case 'openai':
      default: {
        if (!process.env.OPENAI_API_KEY) {
          console.warn('[OCR] OPENAI_API_KEY is missing. Falling back to Dummy OCR provider.');
          return new DummyOcrProvider();
        }
        return new OpenAIOcrProvider(process.env.OPENAI_API_KEY);
      }
    }
  }

  /**
   * 특정 타입의 OCR 프로바이더 생성
   * @param type 프로바이더 타입
   * @param apiKey 선택적 API 키 또는 인증 정보
   * @returns IOcrProvider 인스턴스
   */
  static createProviderByType(type: OcrProviderType, apiKey?: string): IOcrProvider {
    switch (type) {
      case 'dummy':
        return new DummyOcrProvider();
      case 'google':
        return new GoogleVisionOcrProvider(apiKey);
      case 'openai':
        return new OpenAIOcrProvider(apiKey);
      default:
        throw new Error(`Unknown OCR provider type: ${type}`);
    }
  }
}

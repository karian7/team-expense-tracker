import fs from 'fs';
import path from 'path';
import { IOcrProvider } from './IOcrProvider';
import { OcrResult } from '../../types';

/**
 * 외부 API 호출 없이 고정/추론된 값을 반환하는 더미 OCR 프로바이더
 * - 파일명에 포함된 첫 숫자 시퀀스를 금액으로 사용 (없으면 12000)
 * - 날짜는 오늘 날짜(YYYY-MM-DD)
 * - 상호명은 파일명에서 확장자를 제거한 문자열(없으면 '더미상점')
 */
export class DummyOcrProvider implements IOcrProvider {
  public readonly providerName = 'Dummy';

  async analyzeReceipt(imagePath: string): Promise<OcrResult> {
    // 파일이 실제 존재하는지 한 번 확인해 사용자 오류를 조기 발견
    if (!fs.existsSync(imagePath)) {
      return {
        amount: null,
        date: null,
        storeName: null,
        confidence: 0,
        error: 'Image file not found',
      };
    }

    const fileName = path.basename(imagePath);
    const amountMatch = fileName.match(/\d+/);
    const parsedAmount = amountMatch ? Number(amountMatch[0].slice(0, 6)) : 12000;
    const amount = Number.isFinite(parsedAmount) ? Math.min(parsedAmount || 12000, 200000) : 12000;

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    const storeName = fileName.replace(path.extname(fileName), '') || '더미상점';

    return {
      amount,
      date: `${yyyy}-${mm}-${dd}`,
      storeName,
      confidence: 0.9,
      rawText: `Dummy OCR for ${fileName}`,
    };
  }
}

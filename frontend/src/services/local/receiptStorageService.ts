import { db, now, type LastReceiptImage } from '../db/database';

/**
 * 영수증 이미지 로컬 저장 서비스
 * OCR 실패 시 재시도를 위해 마지막 업로드한 이미지를 보관
 */
export const receiptStorageService = {
  /**
   * 마지막 영수증 이미지 저장
   */
  async saveLastReceipt(imageData: string, fileName: string): Promise<void> {
    const receipt: LastReceiptImage = {
      id: 'last',
      imageData,
      fileName,
      uploadedAt: now(),
    };

    await db.lastReceiptImage.put(receipt);
  },

  /**
   * 마지막 영수증 이미지 가져오기
   */
  async getLastReceipt(): Promise<LastReceiptImage | null> {
    const receipt = await db.lastReceiptImage.get('last');
    return receipt ?? null;
  },

  /**
   * 마지막 영수증 이미지 삭제
   */
  async clearLastReceipt(): Promise<void> {
    await db.lastReceiptImage.delete('last');
  },

  /**
   * 마지막 영수증 이미지가 있는지 확인
   */
  async hasLastReceipt(): Promise<boolean> {
    const receipt = await db.lastReceiptImage.get('last');
    return !!receipt;
  },
};

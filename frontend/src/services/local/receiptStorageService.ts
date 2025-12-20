import { db, now, type LastReceiptImage } from '../db/database';

/**
 * 영수증 이미지 로컬 저장 서비스
 * OCR 실패 시 재시도를 위해 마지막 업로드한 이미지를 보관
 */
export const receiptStorageService = {
  /**
   * 마지막 영수증 이미지 저장
   * @throws {Error} IndexedDB 저장 실패 시
   */
  async saveLastReceipt(imageData: string, fileName: string): Promise<void> {
    try {
      // 데이터 검증
      if (!imageData || !fileName) {
        throw new Error('이미지 데이터와 파일명은 필수입니다');
      }

      const receipt: LastReceiptImage = {
        id: 'last',
        imageData,
        fileName,
        uploadedAt: now(),
      };

      await db.lastReceiptImage.put(receipt);
      console.log('[ReceiptStorage] 영수증 이미지 저장 완료:', fileName);
    } catch (error) {
      console.error('[ReceiptStorage] 영수증 이미지 저장 실패:', error);
      throw error;
    }
  },

  /**
   * 마지막 영수증 이미지 가져오기
   * @returns 저장된 영수증 또는 null
   */
  async getLastReceipt(): Promise<LastReceiptImage | null> {
    try {
      const receipt = await db.lastReceiptImage.get('last');
      if (receipt) {
        console.log('[ReceiptStorage] 영수증 이미지 로드:', receipt.fileName);
      }
      return receipt ?? null;
    } catch (error) {
      console.error('[ReceiptStorage] 영수증 이미지 조회 실패:', error);
      return null;
    }
  },

  /**
   * 마지막 영수증 이미지 삭제
   */
  async clearLastReceipt(): Promise<void> {
    try {
      await db.lastReceiptImage.delete('last');
      console.log('[ReceiptStorage] 영수증 이미지 삭제 완료');
    } catch (error) {
      console.error('[ReceiptStorage] 영수증 이미지 삭제 실패:', error);
      // 삭제 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
  },

  /**
   * 마지막 영수증 이미지가 있는지 확인
   */
  async hasLastReceipt(): Promise<boolean> {
    try {
      const receipt = await db.lastReceiptImage.get('last');
      return !!receipt;
    } catch (error) {
      console.error('[ReceiptStorage] 영수증 존재 여부 확인 실패:', error);
      return false;
    }
  },
};

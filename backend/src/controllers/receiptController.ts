import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { analyzeReceiptWithOpenAI, reanalyzeReceipt, getOcrProviderInfo } from '../services/ocrService';
import { ApiResponse, ReceiptUploadResponse } from '../types';
import { AppError } from '../middleware/errorHandler';

/**
 * POST /api/receipts/upload
 * 영수증 업로드 및 OCR 분석
 */
export async function uploadReceipt(
  req: Request,
  res: Response<ApiResponse<ReceiptUploadResponse>>,
  next: NextFunction
) {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    const imagePath = req.file.path;

    // OpenAI Vision API로 OCR 수행
    const ocrResult = await analyzeReceiptWithOpenAI(imagePath);

    res.json({
      success: true,
      data: {
        imageUrl,
        ocrResult,
      },
      message: 'Receipt uploaded and analyzed successfully',
    });
  } catch (error) {
    // 업로드된 파일이 있으면 삭제
    if (req.file) {
      const fs = require('fs');
      fs.unlinkSync(req.file.path);
    }

    next(error);
  }
}

/**
 * POST /api/receipts/parse
 * 이미 업로드된 영수증 재분석
 */
export async function parseReceipt(
  req: Request<any, any, { imageUrl: string }>,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      throw new AppError('Image URL is required', 400);
    }

    // URL에서 파일 경로 추출
    const filename = path.basename(imageUrl);
    const imagePath = path.join('uploads', filename);

    // 파일 존재 확인
    const fs = require('fs');
    if (!fs.existsSync(imagePath)) {
      throw new AppError('Image file not found', 404);
    }

    // OCR 재실행
    const ocrResult = await reanalyzeReceipt(imagePath);

    res.json({
      success: true,
      data: {
        imageUrl,
        ocrResult,
      },
      message: 'Receipt re-analyzed successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/receipts/ocr-provider
 * 현재 사용 중인 OCR 프로바이더 정보 조회
 */
export async function getOcrProvider(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const providerInfo = getOcrProviderInfo();

    res.json({
      success: true,
      data: providerInfo,
      message: 'OCR provider info retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
}

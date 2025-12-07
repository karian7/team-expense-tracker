import { Request, Response, NextFunction } from 'express';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import {
  analyzeReceiptWithBuffer,
  reanalyzeReceiptFromBlob,
  getOcrProviderInfo,
} from '../services/ocrService';
import { ApiResponse, ReceiptUploadResponse, CreateBudgetEventRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { createBudgetEvent } from '../services/budgetEventService';
import { getCurrentYearMonth } from '../utils/date';

const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

// 이미지 처리 설정
const IMAGE_CONFIG = {
  storage: {
    maxWidth: 480, // 저장용: 적당한 크기로 압축
    quality: 85,
  },
  ocr: {
    sharpenAmount: 1.2, // 선명도 향상 (텍스트 가독성)
    contrastAmount: 1.15, // 대비 증가 (배경/텍스트 구분)
    brightnessAmount: 1.05, // 약간의 밝기 증가
  },
};

/**
 * HEIC를 JPEG로 변환하고 기본 회전 처리
 */
async function convertAndRotate(file: Express.Multer.File): Promise<Buffer> {
  const isHeic =
    HEIC_MIME_TYPES.has(file.mimetype.toLowerCase()) ||
    file.originalname.toLowerCase().endsWith('.heic') ||
    file.originalname.toLowerCase().endsWith('.heif');

  const buffer = isHeic
    ? await heicConvert({
        buffer: file.buffer,
        format: 'JPEG',
        quality: 90,
      })
    : file.buffer;

  // EXIF Orientation 자동 회전
  return await sharp(buffer, { failOnError: false }).rotate().toBuffer();
}

/**
 * 저장용 이미지 생성 (압축만, OCR 처리 없음)
 */
async function createStorageImage(rotatedBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(rotatedBuffer, { failOnError: false }).metadata();
  const shouldResize =
    (metadata.width ?? IMAGE_CONFIG.storage.maxWidth) > IMAGE_CONFIG.storage.maxWidth;

  let transformer = sharp(rotatedBuffer, { failOnError: false });

  if (shouldResize) {
    transformer = transformer.resize({
      width: IMAGE_CONFIG.storage.maxWidth,
      withoutEnlargement: true,
    });
  }

  return await transformer.jpeg({ quality: IMAGE_CONFIG.storage.quality }).toBuffer();
}

/**
 * OCR 처리용 이미지 생성 (선명도/대비/밝기 최적화)
 *
 * 주요 최적화:
 * 1. 선명도(Sharpen) 향상: 텍스트 가독성 증가
 * 2. 대비(Contrast) 조정: 배경과 텍스트 구분 개선
 * 3. 밝기(Brightness) 조정: 어두운 영수증 보정
 * 4. 노이즈 제거: 미디안 필터로 잡티 제거
 *
 * 주의: 해상도는 변경하지 않음 (OCR 비용 절감)
 */
async function createOcrImage(rotatedBuffer: Buffer): Promise<Buffer> {
  return await sharp(rotatedBuffer, { failOnError: false })
    // 1. 노이즈 제거
    .median(3)
    // 2. 선명도 향상 (텍스트 경계 강조)
    .sharpen({
      sigma: IMAGE_CONFIG.ocr.sharpenAmount,
      m1: 0.5,
      m2: 0.5,
    })
    // 3. 히스토그램 정규화 (명암 분포 최적화)
    .normalize()
    // 4. 대비 증가 (텍스트/배경 구분)
    .linear(IMAGE_CONFIG.ocr.contrastAmount, -(128 * IMAGE_CONFIG.ocr.contrastAmount) + 128)
    // 5. 밝기 조정 (어두운 영수증 보정)
    .modulate({
      brightness: IMAGE_CONFIG.ocr.brightnessAmount,
    })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * POST /api/receipts/upload
 * 영수증 업로드 및 OCR 분석 → 즉시 이벤트 생성
 *
 * 처리 흐름:
 * 1. HEIC → JPEG 변환 및 회전
 * 2. 저장용 이미지 생성 (압축)
 * 3. OCR용 이미지 생성 (최적화)
 * 4. OCR 분석 실행
 * 5. EXPENSE 이벤트 생성
 * 6. 생성된 이벤트 반환
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

    const { authorName } = req.body;
    if (!authorName) {
      throw new AppError('Author name is required', 400);
    }

    // 1. 기본 변환 및 회전
    const rotatedBuffer = await convertAndRotate(req.file);

    // 2. 저장용 이미지 생성 (압축만)
    const storageBuffer = await createStorageImage(rotatedBuffer);

    // 3. OCR용 이미지 생성 (최적화 처리)
    const ocrBuffer = await createOcrImage(rotatedBuffer);

    // 4. OCR 분석 (최적화된 이미지 사용)
    const ocrResult = await analyzeReceiptWithBuffer(ocrBuffer);

    // 5. OCR 결과로 이벤트 생성
    const { year, month } = getCurrentYearMonth();
    const eventDate = ocrResult.date ? new Date(ocrResult.date) : new Date();

    const eventData: CreateBudgetEventRequest = {
      eventType: 'EXPENSE',
      eventDate: eventDate.toISOString(),
      year,
      month,
      authorName,
      amount: ocrResult.amount || 0,
      storeName: ocrResult.storeName || undefined,
      receiptImage: storageBuffer.toString('base64'),
      ocrRawData: ocrResult.rawText ? { rawText: ocrResult.rawText } : undefined,
    };

    const event = await createBudgetEvent(eventData);

    res.json({
      success: true,
      data: {
        imageId: `event-${event.sequence}`,
        imageBuffer: storageBuffer.toString('base64'),
        ocrResult,
      },
      message: 'Receipt uploaded and event created successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/receipts/parse
 * 이미 업로드된 영수증 재분석
 *
 * 저장된 이미지를 OCR 최적화하여 재분석
 */
export async function parseReceipt(
  req: Request<Record<string, never>, ApiResponse, { imageBlob: string }>,
  res: Response<ApiResponse>,
  next: NextFunction
) {
  try {
    const { imageBlob } = req.body;

    if (!imageBlob) {
      throw new AppError('Image blob is required', 400);
    }

    // 저장된 이미지를 OCR용으로 최적화
    const storageBuffer = Buffer.from(imageBlob, 'base64');
    const ocrBuffer = await createOcrImage(storageBuffer);

    // OCR 분석 (최적화된 이미지 사용)
    const ocrResult = await reanalyzeReceiptFromBlob(ocrBuffer);

    res.json({
      success: true,
      data: {
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
export async function getOcrProvider(req: Request, res: Response<ApiResponse>, next: NextFunction) {
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

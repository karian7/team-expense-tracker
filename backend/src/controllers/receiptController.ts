import { Request, Response, NextFunction } from 'express';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { randomUUID } from 'crypto';
import { analyzeReceiptWithBuffer } from '../services/ocrService';
import { ApiResponse, ReceiptUploadResponse } from '../types';
import { AppError } from '../middleware/errorHandler';

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
 * 영수증 업로드 및 OCR 분석 결과만 반환 (이벤트 생성 X)
 *
 * 처리 흐름:
 * 1. HEIC → JPEG 변환 및 회전
 * 2. 저장용 이미지 생성 (압축)
 * 3. OCR용 이미지 생성 (최적화)
 * 4. OCR 분석 실행 후 결과/이미지 버퍼 반환
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

    // 1. 기본 변환 및 회전
    const rotatedBuffer = await convertAndRotate(req.file);

    // 2. 저장용 이미지 생성 (압축만)
    const storageBuffer = await createStorageImage(rotatedBuffer);

    // 3. OCR용 이미지 생성 (최적화 처리)
    const ocrBuffer = await createOcrImage(rotatedBuffer);

    // 4. OCR 분석 (최적화된 이미지 사용)
    const ocrResult = await analyzeReceiptWithBuffer(ocrBuffer);

    // 5. 영수증 여부 검증
    if (ocrResult.isReceipt === false) {
      throw new AppError('업로드한 이미지가 영수증이 아닙니다. 영수증 사진을 업로드해주세요.', 400);
    }

    res.json({
      success: true,
      data: {
        imageId: randomUUID(),
        imageBuffer: storageBuffer.toString('base64'),
        ocrResult,
      },
      message: 'Receipt processed successfully',
    });
  } catch (error) {
    next(error);
  }
}

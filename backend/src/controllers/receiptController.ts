import fs from 'fs/promises';
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import {
  analyzeReceiptWithOpenAI,
  reanalyzeReceipt,
  getOcrProviderInfo,
} from '../services/ocrService';
import { ApiResponse, ReceiptUploadResponse } from '../types';
import { AppError } from '../middleware/errorHandler';

const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);
const MAX_IMAGE_WIDTH = 800;

async function normalizeReceiptImage(
  file: Express.Multer.File
): Promise<{ filename: string; path: string }> {
  const originalPath = path.resolve(file.path);
  const uploadsDir = path.resolve(path.dirname(file.path));
  const parsed = path.parse(file.filename);
  const ext = parsed.ext.toLowerCase();
  const isHeic =
    HEIC_MIME_TYPES.has(file.mimetype.toLowerCase()) || ext === '.heic' || ext === '.heif';
  const targetExt = isHeic ? '.jpg' : ext || '.jpg';
  const filename = `${parsed.name}${targetExt}`;
  const outputPath = path.join(uploadsDir, filename);
  const tempOutputPath = path.join(uploadsDir, `tmp-${Date.now()}-${parsed.name}${targetExt}`);

  const sourceBuffer = await fs.readFile(originalPath);

  const inputBuffer = isHeic
    ? await heicConvert({
        buffer: sourceBuffer,
        format: 'JPEG',
        quality: 90,
      })
    : sourceBuffer;

  const metadata = await sharp(inputBuffer, { failOnError: false }).metadata();
  const shouldResize = (metadata.width ?? MAX_IMAGE_WIDTH) > MAX_IMAGE_WIDTH;

  const transformer = sharp(inputBuffer, { failOnError: false }).rotate();

  if (shouldResize) {
    transformer.resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true });
  }

  switch (targetExt) {
    case '.png':
      transformer.png();
      break;
    case '.webp':
      transformer.webp();
      break;
    case '.gif':
      transformer.gif();
      break;
    default:
      transformer.jpeg({ quality: 90 });
      break;
  }

  await transformer.toFile(tempOutputPath);

  // 파일 이름 충돌을 피하기 위해 tempOutputPath로 쓴 뒤 최종 위치로 rename
  await fs.rename(tempOutputPath, outputPath);

  // 원본 파일 정리 (확장자 변환 등으로 이름이 달라진 경우에만 삭제)
  if (originalPath !== outputPath) {
    await fs.unlink(originalPath).catch(() => undefined);
  }

  return { filename, path: outputPath };
}

/**
 * POST /api/receipts/upload
 * 영수증 업로드 및 OCR 분석
 */
export async function uploadReceipt(
  req: Request,
  res: Response<ApiResponse<ReceiptUploadResponse>>,
  next: NextFunction
) {
  let processedFilePath: string | undefined;

  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const { filename, path: imagePath } = await normalizeReceiptImage(req.file);
    processedFilePath = imagePath;

    const imageUrl = `/uploads/${filename}`;

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
    const targetPath = processedFilePath ?? req.file?.path;

    if (targetPath) {
      await fs.unlink(targetPath).catch(() => undefined);
    }

    next(error);
  }
}

/**
 * POST /api/receipts/parse
 * 이미 업로드된 영수증 재분석
 */
export async function parseReceipt(
  req: Request<Record<string, never>, ApiResponse, { imageUrl: string }>,
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

    await fs.access(imagePath).catch(() => {
      throw new AppError('Image file not found', 404);
    });

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

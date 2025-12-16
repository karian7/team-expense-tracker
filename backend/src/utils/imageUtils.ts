import sharp from 'sharp';

/**
 * Push notification용 작은 썸네일 생성
 * 목표: 1-2KB 이하 (base64 인코딩 후 2-3KB, 4KB 제한 준수)
 *
 * @param imageBuffer - 원본 이미지 버퍼
 * @returns data:image/jpeg;base64,... 형식의 Data URL
 */
export async function createNotificationThumbnail(imageBuffer: Buffer): Promise<string> {
  const thumbnail = await sharp(imageBuffer, { failOnError: false })
    .resize({
      width: 120, // 작은 썸네일 (4KB payload 제한 준수)
      withoutEnlargement: true,
    })
    .jpeg({ quality: 50 }) // 낮은 품질 (알림용이므로 충분)
    .toBuffer();

  // Base64 data URL로 변환
  return `data:image/jpeg;base64,${thumbnail.toString('base64')}`;
}

/**
 * 이미 저장된 base64 이미지를 리사이징
 *
 * @param base64Image - data:image/jpeg;base64,... 형식 또는 순수 base64 문자열
 * @returns data:image/jpeg;base64,... 형식의 작은 썸네일
 */
export async function resizeBase64Image(base64Image: string): Promise<string> {
  // data:image/jpeg;base64, 제거
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  return createNotificationThumbnail(buffer);
}

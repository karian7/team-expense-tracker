import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import prisma from '../utils/prisma';

// 저장용 이미지 설정 (receiptController.ts와 동일)
const MAX_IMAGE_WIDTH = 800;

async function processImageFile(imagePath: string): Promise<Buffer | null> {
  try {
    const fileExists = await fs
      .access(imagePath)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      console.log(`  ❌ File not found: ${imagePath}`);
      return null;
    }

    const imageBuffer = await fs.readFile(imagePath);
    const metadata = await sharp(imageBuffer, { failOnError: false }).metadata();
    const shouldResize = (metadata.width ?? MAX_IMAGE_WIDTH) > MAX_IMAGE_WIDTH;

    let transformer = sharp(imageBuffer, { failOnError: false }).rotate();

    if (shouldResize) {
      transformer = transformer.resize({
        width: MAX_IMAGE_WIDTH,
        withoutEnlargement: true,
      });
    }

    transformer = transformer.jpeg({ quality: 85 });

    return await transformer.toBuffer();
  } catch (error) {
    console.error(`  ❌ Error processing ${imagePath}:`, error);
    return null;
  }
}

async function migrateImagesToBlob() {
  console.log('🚀 Starting image migration to blob storage...\n');

  const expenses = await prisma.expense.findMany({
    where: {
      receiptImageUrl: { not: null },
      receiptImage: null,
    },
  });

  console.log(`📊 Found ${expenses.length} expenses with file-based images\n`);

  let successCount = 0;
  let failCount = 0;

  for (const expense of expenses) {
    const imageUrl = expense.receiptImageUrl;
    if (!imageUrl) continue;

    console.log(`Processing expense ${expense.id}...`);
    console.log(`  Image URL: ${imageUrl}`);

    const filename = path.basename(imageUrl);
    const imagePath = path.join('uploads', filename);

    const imageBuffer = await processImageFile(imagePath);

    if (imageBuffer) {
      try {
        await prisma.expense.update({
          where: { id: expense.id },
          data: {
            receiptImage: imageBuffer,
          },
        });
        console.log(`  ✅ Successfully migrated (${imageBuffer.length} bytes)`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ Database update failed:`, error);
        failCount++;
      }
    } else {
      failCount++;
    }

    console.log('');
  }

  console.log('�� Migration Summary:');
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);
  console.log(`  📊 Total: ${expenses.length}`);

  if (successCount > 0) {
    console.log('\n💡 TIP: You can now safely delete the uploads/ directory files');
  }
}

migrateImagesToBlob()
  .then(() => {
    console.log('\n✅ Migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
